import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { categories, initialProducts } from "@/lib/products";
import type { DevelopmentData } from "../domain";
import { requireDevelopmentStorage } from "../config";
import type { Repositories, UnitOfWork } from "./interfaces";

export function seedData(): DevelopmentData {
  return {
    schema: 2,
    sequence: 0,
    products: initialProducts.map((p) => ({
      ...p,
      badge: undefined,
      archived: false,
    })),
    categories: structuredClone(categories),
    inventory: Object.fromEntries(initialProducts.map((p) => [p.id, 100])),
    adjustments: [],
    orders: [],
    customers: [],
    sessions: [],
    challenges: [],
    rateLimits: {},
    settings: {
      name: "dukan",
      contact: "",
      location: "",
      hours: "",
      whatsappRecipient: "",
      whatsappConsentAt: null,
    },
  };
}

function repositories(data: DevelopmentData): Repositories {
  const save = <T>(list: T[], value: T, matches: (item: T) => boolean) => {
    const index = list.findIndex(matches);
    if (index < 0) list.push(value);
    else list[index] = value;
  };
  return {
    products: {
      list: () => data.products,
      get: (id) => data.products.find((p) => p.id === id),
      save: (p) => save(data.products, p, (i) => i.id === p.id),
      categories: () => data.categories,
      saveCategories: (c) => {
        data.categories = c;
      },
    },
    inventory: {
      quantity: (id) => data.inventory[id] ?? 0,
      adjust: (a) => {
        data.inventory[a.productId] = a.after;
        data.adjustments.unshift(a);
      },
      history: () => data.adjustments,
    },
    orders: {
      list: () => data.orders,
      get: (id) => data.orders.find((o) => o.id === id),
      byIdempotency: (hash) =>
        data.orders.find((o) => o.idempotencyHash === hash),
      save: (o) => save(data.orders, o, (i) => i.id === o.id),
      nextMemo: () => `CM-${String(++data.sequence).padStart(6, "0")}`,
    },
    customers: {
      upsert: (name, phone) => {
        let customer = data.customers.find((c) => c.phone === phone);
        if (!customer) {
          customer = { id: randomUUID(), name, phone };
          data.customers.push(customer);
        } else customer.name = name;
        return structuredClone(customer);
      },
    },
    settings: {
      get: () => data.settings,
      save: (s) => {
        data.settings = s;
      },
    },
    auth: {
      sessions: () => data.sessions.filter((s) => s.expiresAt > Date.now()),
      saveSession: (s) => {
        data.sessions = data.sessions.filter((i) => i.expiresAt > Date.now());
        data.sessions.push(s);
      },
      deleteSession: (hash) => {
        data.sessions = data.sessions.filter((s) => s.tokenHash !== hash);
      },
      challenges: () => data.challenges.filter((c) => c.expiresAt > Date.now()),
      saveChallenge: (c) => {
        data.challenges = data.challenges.filter(
          (i) => i.expiresAt > Date.now(),
        );
        save(data.challenges, c, (i) => i.id === c.id);
      },
      deleteChallenge: (id) => {
        data.challenges = data.challenges.filter((c) => c.id !== id);
      },
      consumeRate: (key, limit, windowMs) => {
        for (const [id, b] of Object.entries(data.rateLimits))
          if (b.expiresAt < Date.now()) delete data.rateLimits[id];
        const bucket = (data.rateLimits[key] ||= {
          count: 0,
          expiresAt: Date.now() + windowMs,
        });
        if (bucket.count >= limit) return false;
        bucket.count++;
        return true;
      },
    },
  };
}

const state = globalThis as typeof globalThis & {
  dukanFileLocks?: Map<string, Promise<unknown>>;
};
state.dukanFileLocks ||= new Map();

// Development only. Atomic file replacement + one-process serialization; no
// cross-process locks, replication, database durability, or production guarantees.
export class DevelopmentFileUnitOfWork implements UnitOfWork {
  constructor(
    private file = resolve(
      /* turbopackIgnore: true */ process.env.DEV_DATA_FILE ||
        ".data/phase2.json",
    ),
  ) {}
  private async run<T>(
    fn: (repos: Repositories) => T | Promise<T>,
    write: boolean,
  ): Promise<T> {
    requireDevelopmentStorage();
    const previous = state.dukanFileLocks!.get(this.file) || Promise.resolve();
    const task = previous
      .catch(() => {})
      .then(async () => {
        let data: DevelopmentData;
        try {
          data = JSON.parse(await readFile(this.file, "utf8"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          data = seedData();
        }
        if (data.schema !== 2)
          throw new Error("Unsupported development data schema");
        const result = await fn(repositories(data));
        if (write) {
          await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
          const temp = `${this.file}.${randomUUID()}.tmp`;
          await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
          await rename(temp, this.file);
        }
        return structuredClone(result);
      });
    state.dukanFileLocks!.set(
      this.file,
      task.catch(() => {}),
    );
    return task;
  }
  read<T>(fn: (repos: Repositories) => T | Promise<T>) {
    return this.run(fn, false);
  }
  transaction<T>(fn: (repos: Repositories) => T | Promise<T>) {
    return this.run(fn, true);
  }
}

export class MemoryUnitOfWork implements UnitOfWork {
  constructor() {
    requireDevelopmentStorage();
  }
  data = seedData();
  private queue: Promise<unknown> = Promise.resolve();
  async read<T>(fn: (repos: Repositories) => T | Promise<T>): Promise<T> {
    await this.queue;
    return structuredClone(await fn(repositories(structuredClone(this.data))));
  }
  transaction<T>(fn: (repos: Repositories) => T | Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.data);
      const result = await fn(repositories(draft));
      this.data = draft;
      return structuredClone(result);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
