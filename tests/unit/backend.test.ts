import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  MemoryUnitOfWork,
  DevelopmentFileUnitOfWork,
} from "../../src/server/repositories/development";
import { CheckoutService } from "../../src/server/services/checkout-service";
import { CashMemoService } from "../../src/server/services/cash-memo-service";
import {
  CloudWhatsAppProvider,
  MockWhatsAppProvider,
  WhatsAppService,
  type WhatsAppProvider,
} from "../../src/server/services/whatsapp-service";
import { AdminAuthService } from "../../src/server/services/admin-auth-service";
import { InventoryService } from "../../src/server/services/inventory-service";
import { ProductService } from "../../src/server/services/product-service";
import { mockAuthEnabled } from "../../src/server/config";

const original = { ...process.env };
beforeEach(() => {
  process.env.ADMIN_PHONE = "+919999999999";
  process.env.ADMIN_OTP_PROVIDER = "mock";
  process.env.ALLOW_DEV_OTP = "true";
  process.env.WHATSAPP_PROVIDER = "mock";
});
afterEach(() => {
  for (const key of Object.keys(process.env))
    if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});
const request = () => ({
  name: "Rahul Sharma",
  phone: "+919876543210",
  items: [
    { productId: "regular-rice", quantity: 2 },
    { productId: "sugar", quantity: 1 },
  ],
});
function setup(provider?: WhatsAppProvider) {
  const db = new MemoryUnitOfWork();
  const wa = new WhatsAppService(db, provider);
  return {
    db,
    wa,
    checkout: new CheckoutService(db, new CashMemoService(), wa),
    inventory: new InventoryService(db),
    products: new ProductService(db),
    auth: new AdminAuthService(db),
  };
}

test("server prices, cash memo totals, INR/Hindi fonts and exact disclaimers", async () => {
  const { db, checkout } = setup();
  const result = await checkout.submit(request(), randomUUID());
  assert.equal(result.totalPaise, 400000);
  assert.equal(result.memoNumber, "CM-000001");
  assert.equal(result.whatsappStatus, "mock");
  assert.equal(db.data.inventory["regular-rice"], 100);
  assert.equal(db.data.inventory.sugar, 100);
  assert.equal(db.data.adjustments.length, 0);
  const pdf = Buffer.from(db.data.orders[0].pdfBase64, "base64");
  assert.ok(pdf.subarray(0, 4).toString() === "%PDF");
  const dir = await mkdtemp(join(tmpdir(), "dukan-pdf-"));
  try {
    const path = join(dir, "memo.pdf");
    await writeFile(path, pdf);
    const text = execFileSync("pdftotext", ["-layout", path, "-"], {
      encoding: "utf8",
    });
    for (const part of [
      "CASH MEMO",
      "Sanjay Store",
      "CM-000001",
      "Rahul Sharma",
      "₹4,000.00",
      "Shipping charges may vary and will be confirmed by the store.",
      "This document is an order request and does not confirm payment.",
      "IST",
    ])
      assert.ok(text.includes(part), part);
    assert.ok(!text.includes("ORDER REQUEST"));
    assert.match(text, /[\u0900-\u097f]/);
    const fonts = execFileSync("pdffonts", [path], { encoding: "utf8" });
    assert.match(fonts, /NotoSansDevanagari/);
    assert.match(fonts, /NotoSans/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("concurrent identical submissions create one order and one notification", async () => {
  let sends = 0;
  const { db, checkout } = setup({
    send: async () => {
      sends++;
      return { status: "accepted", messageId: "wamid.test" };
    },
  });
  const key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => checkout.submit(request(), key)),
  );
  assert.equal(db.data.orders.length, 1);
  assert.equal(db.data.customers.length, 1);
  assert.equal(sends, 1);
  assert.equal(new Set(results.map((r) => r.memoNumber)).size, 1);
  await assert.rejects(
    checkout.submit({ ...request(), name: "Different customer" }, key),
    /another request/,
  );
});

test("browser prices, duplicate lines, bad customer data, IDs, and quantities are rejected", async () => {
  const { checkout, db } = setup();
  for (const input of [
    { ...request(), total: 1 },
    { ...request(), name: "X" },
    { ...request(), phone: "123" },
    {
      ...request(),
      items: [{ productId: "regular-rice", quantity: 1, price: 1 }],
    },
    {
      ...request(),
      items: [
        { productId: "regular-rice", quantity: 1 },
        { productId: "regular-rice", quantity: 1 },
      ],
    },
    { ...request(), items: [{ productId: "missing", quantity: 1 }] },
    { ...request(), items: [{ productId: "regular-rice", quantity: 0 }] },
    { ...request(), items: [{ productId: "regular-rice", quantity: 1.5 }] },
  ])
    await assert.rejects(checkout.submit(input, randomUUID()));
  await assert.rejects(checkout.submit(request(), "short"));
  assert.equal(db.data.orders.length, 0);
});

test("latest server price wins; overstock and zero-stock responses disclose no counts", async () => {
  const { checkout, db, inventory, products } = setup();
  await inventory.adjust(
    {
      reason: "Physical count",
      changes: [
        { productId: "regular-rice", quantity: 1, expectedQuantity: 100 },
      ],
    },
    "admin",
  );
  await assert.rejects(
    checkout.submit(request(), randomUUID()),
    (e) => (e as Error).message === "Requested quantity unavailable.",
  );
  const catalogue = await products.catalogue();
  assert.ok(!JSON.stringify(catalogue).includes('"inventory"'));
  assert.ok(!JSON.stringify(catalogue).includes('"quantity"'));
  await inventory.adjust(
    {
      reason: "Physical count",
      changes: [
        { productId: "regular-rice", quantity: 0, expectedQuantity: 1 },
      ],
    },
    "admin",
  );
  assert.equal(
    (await products.catalogue()).products.find((p) => p.id === "regular-rice")!
      .available,
    false,
  );
  await assert.rejects(
    checkout.submit(request(), randomUUID()),
    /out of stock/,
  );
  db.data.products.find((p) => p.id === "sugar")!.price = 2000.25;
  const result = await checkout.submit(
    { ...request(), items: [{ productId: "sugar", quantity: 2 }] },
    randomUUID(),
  );
  assert.equal(result.totalPaise, 400050);
});

test("only explicit inventory edits change counts; bulk updates are atomic and conflicts rejected", async () => {
  const { checkout, db, inventory, products } = setup();
  await checkout.submit(request(), randomUUID());
  await db.transaction((r) => {
    const order = r.orders.list()[0];
    for (const status of ["confirmed", "completed", "cancelled"] as const)
      r.orders.save({ ...order, status });
  });
  const { archived: _a, ...p } = db.data.products[0];
  await products.save({ ...p, price: 1234 });
  assert.equal(db.data.inventory["regular-rice"], 100);
  await assert.rejects(
    inventory.adjust(
      {
        reason: "New physical count",
        changes: [
          { productId: "regular-rice", quantity: 80, expectedQuantity: 100 },
          { productId: "sugar", quantity: 40, expectedQuantity: 99 },
        ],
      },
      "admin",
    ),
    /edited elsewhere/,
  );
  assert.equal(db.data.inventory["regular-rice"], 100);
  await inventory.adjust(
    {
      reason: "New physical count",
      changes: [
        { productId: "regular-rice", quantity: 80, expectedQuantity: 100 },
        { productId: "sugar", quantity: 40, expectedQuantity: 100 },
      ],
    },
    "admin",
  );
  assert.equal(db.data.adjustments.length, 2);
  assert.equal(db.data.inventory.sugar, 40);
});

test("product/category/archive and settings are validated; new products have zero stock", async () => {
  const { db, products } = setup();
  const { archived: _a, ...p } = db.data.products[0];
  await products.save({ ...p, id: "lentils", name: "Lentils" });
  assert.equal(
    (await products.catalogue()).products.find((p) => p.id === "lentils")!
      .available,
    false,
  );
  await assert.rejects(products.save({ ...p, category: "unknown" }));
  await assert.rejects(products.save({ ...p, image: "javascript:alert(1)" }));
  await products.saveCategory({
    id: "pulses",
    name: "Pulses",
    description: "Dals",
    illustration: "rice",
  });
  await products.save({ ...p, id: "lentils", category: "pulses" });
  await assert.rejects(products.deleteCategory("pulses"), /Move or archive/);
  await products.archive("lentils");
  await products.deleteCategory("pulses");
  assert.ok(
    !(await products.catalogue()).products.some((p) => p.id === "lentils"),
  );
  await products.saveSettings({
    name: "Store",
    contact: "",
    location: "",
    hours: "",
    whatsappRecipient: "+919999999999",
    whatsappConsent: true,
  });
  assert.ok(db.data.settings.whatsappConsentAt);
  await products.saveSettings({
    name: "Store",
    contact: "",
    location: "",
    hours: "",
    whatsappRecipient: "+919888888888",
    whatsappConsent: false,
  });
  assert.equal(db.data.settings.whatsappConsentAt, null);
});

test("OTP is required; wrong identity, expired or replayed OTPs, and revoked sessions fail", async () => {
  const { auth, db } = setup();
  await assert.rejects(auth.authenticate());
  const wrong = await auth.request({ phone: "+919888888888" }, "a");
  assert.ok(!("developmentCode" in wrong));
  await assert.rejects(
    auth.verify({ challengeId: wrong.challengeId, code: "123456" }, "a"),
  );
  const challenge = await auth.request({ phone: "+919999999999" }, "a");
  assert.ok("developmentCode" in challenge);
  await assert.rejects(
    auth.verify({ challengeId: challenge.challengeId, code: "000000" }, "a"),
  );
  const token = await auth.verify(
    { challengeId: challenge.challengeId, code: challenge.developmentCode },
    "a",
  );
  assert.equal(await auth.authenticate(token), "+919999999999");
  await assert.rejects(
    auth.verify(
      { challengeId: challenge.challengeId, code: challenge.developmentCode },
      "a",
    ),
  );
  assert.ok(!JSON.stringify(db.data.sessions).includes(token));
  await auth.logout(token);
  await assert.rejects(auth.authenticate(token));
  const expired = await auth.request({ phone: "+919999999999" }, "b");
  db.data.challenges[0].expiresAt = Date.now() - 1;
  await assert.rejects(
    auth.verify(
      { challengeId: expired.challengeId, code: expired.developmentCode },
      "b",
    ),
  );
});

test("OTP attempts and request rate limits are enforced", async () => {
  const { auth } = setup();
  const c = await auth.request({ phone: "+919999999999" }, "limits");
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      auth.verify({ challengeId: c.challengeId, code: "000000" }, "limits"),
    );
  await assert.rejects(
    auth.verify(
      { challengeId: c.challengeId, code: c.developmentCode },
      "limits",
    ),
  );
  await auth.rateLimit("test", 1, 60000);
  await assert.rejects(auth.rateLimit("test", 1, 60000), /Too many attempts/);
});

test("production blocks the development database, mock OTP, and mock WhatsApp", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal(mockAuthEnabled(), false);
  await assert.rejects(
    new DevelopmentFileUnitOfWork().read((r) => r.orders.list()),
    /permanent database/,
  );
  assert.equal(
    (await new MockWhatsAppProvider().send()).status,
    "not_configured",
  );
});

function cloudConfig() {
  process.env.WHATSAPP_PROVIDER = "cloud";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.WHATSAPP_ACCESS_TOKEN = "unit-test-token";
  process.env.WHATSAPP_TEMPLATE_NAME = "order_request_memo";
}

test("missing live sender credentials or recipient consent do not claim delivery", async () => {
  const { db, checkout } = setup();
  process.env.WHATSAPP_PROVIDER = "cloud";
  const result = await checkout.submit(request(), randomUUID());
  assert.equal(result.whatsappStatus, "not_configured");
  assert.equal(db.data.orders.length, 1);
  assert.equal(db.data.orders[0].whatsapp.attempts, 0);
  cloudConfig();
  const next = await checkout.submit(request(), randomUUID());
  assert.equal(next.whatsappStatus, "not_configured");
});

test("Cloud adapter uploads PDF then sends approved document template with four body variables", async () => {
  const { db, checkout } = setup();
  await checkout.submit(request(), randomUUID());
  cloudConfig();
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.match(
      String(url),
      /^https:\/\/graph.facebook.com\/v23.0\/123456789\//,
    );
    if (calls === 1) {
      assert.ok(init?.body instanceof FormData);
      const file = (init.body as FormData).get("file") as File;
      assert.equal(file.type, "application/pdf");
      return Response.json({ id: "media1" });
    }
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.type, "template");
    assert.equal(payload.to, "919999999999");
    assert.equal(
      payload.template.components[0].parameters[0].document.id,
      "media1",
    );
    assert.deepEqual(
      payload.template.components[1].parameters.map(
        (p: { text: string }) => p.text,
      ),
      ["CM-000001", "Rahul Sharma", "+919876543210", "₹4,000"],
    );
    assert.equal(
      payload.biz_opaque_callback_data,
      `${db.data.orders[0].id}:attempt1`,
    );
    return Response.json({ messages: [{ id: "wamid.1" }] });
  };
  const result = await new CloudWhatsAppProvider(transport).send(
    db.data.orders[0],
    "+919999999999",
    "attempt1",
  );
  assert.equal(calls, 2);
  assert.deepEqual(result, { status: "accepted", messageId: "wamid.1" });
});

test("ambiguous sends never retry, and upload failures can be retried with backoff", async () => {
  const { db, checkout } = setup();
  await checkout.submit(request(), randomUUID());
  cloudConfig();
  let calls = 0;
  const provider = new CloudWhatsAppProvider(async () => {
    calls++;
    if (calls === 1) return Response.json({ id: "m" });
    throw new Error("timeout");
  });
  assert.equal(
    (await provider.send(db.data.orders[0], "+919999999999", "a")).status,
    "unknown",
  );
  let attempts = 0;
  const s = setup({
    send: async () => {
      attempts++;
      return attempts === 1
        ? { status: "failed", retryable: true, error: "Upload failed" }
        : { status: "accepted", messageId: "ok" };
    },
  });
  await s.checkout.submit(request(), randomUUID());
  const id = s.db.data.orders[0].id;
  await assert.rejects(s.wa.dispatch(id, true), /wait/);
  s.db.data.orders[0].whatsapp.nextAttemptAt = new Date(0).toISOString();
  await s.wa.dispatch(id, true);
  await s.wa.dispatch(id, true);
  assert.equal(attempts, 2);
  s.db.data.orders[0].whatsapp.status = "unknown";
  await s.wa.dispatch(id, true);
  assert.equal(attempts, 2);
});

test("signed-webhook business logic tracks monotonic status, duplicates, recipients and old attempts", async () => {
  const { db, checkout, wa } = setup({
    send: async () => ({ status: "accepted", messageId: "wamid.1" }),
  });
  db.data.settings.whatsappRecipient = "+919999999999";
  await checkout.submit(request(), randomUUID());
  cloudConfig();
  const event = {
    id: "wamid.1",
    status: "delivered",
    timestamp: "100",
    recipient_id: "919999999999",
  };
  await wa.webhook({ ...event, recipient_id: "919888888888" }, "123456789");
  assert.equal(db.data.orders[0].whatsapp.status, "accepted");
  await wa.webhook(event, "123456789");
  await wa.webhook(event, "123456789");
  await wa.webhook({ ...event, status: "sent", timestamp: "101" }, "123456789");
  assert.equal(db.data.orders[0].whatsapp.status, "delivered");
  await wa.webhook({ ...event, status: "read", timestamp: "102" }, "123456789");
  await wa.webhook(
    { ...event, status: "failed", timestamp: "103" },
    "123456789",
  );
  assert.equal(db.data.orders[0].whatsapp.status, "read");
});

test("development file data survives restart; malformed data is never silently reset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dukan-data-"));
  const file = join(dir, "data.json");
  try {
    const first = new DevelopmentFileUnitOfWork(file);
    await first.transaction((r) => {
      r.settings.save({ ...r.settings.get(), name: "Saved store" });
    });
    assert.equal(
      await new DevelopmentFileUnitOfWork(file).read(
        (r) => r.settings.get().name,
      ),
      "Saved store",
    );
    const raw = await readFile(file, "utf8");
    assert.match(raw, /Saved store/);
    await writeFile(file, "invalid");
    await assert.rejects(first.read((r) => r.settings.get()));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("long bilingual memos paginate, repeat headers, and include every line", async () => {
  const { db, checkout } = setup();
  await checkout.submit(request(), randomUUID());
  const order = structuredClone(db.data.orders[0]);
  order.customer.name = "राहुल Sharma";
  order.store.name = "कृषि बाज़ार · Wholesale";
  order.items = Array.from({ length: 50 }, (_, i) => ({
    ...order.items[0],
    productId: `item-${i}`,
    name: `Product ${i + 1} — A long descriptive wholesale rice package name`,
    hindiName: "अच्छी गुणवत्ता वाले साधारण चावल की बोरी",
  }));
  order.totalPaise = order.items.reduce((s, i) => s + i.totalPaise, 0);
  const pdf = await new CashMemoService().generate(order);
  const dir = await mkdtemp(join(tmpdir(), "dukan-long-pdf-"));
  try {
    const path = join(dir, "memo.pdf");
    await writeFile(path, pdf);
    const text = execFileSync("pdftotext", ["-layout", path, "-"], {
      encoding: "utf8",
    });
    for (let i = 1; i <= 50; i++)
      assert.ok(text.includes(`Product ${i} `), `Product ${i}`);
    assert.ok((text.match(/PRODUCT \/ PACKAGE/g) || []).length >= 3);
    assert.ok(text.includes("₹1,00,000.00"));
    assert.ok(text.includes("Shipping charges may vary"));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("live OTP provider verifies before a session can be issued and never returns a development code", async () => {
  process.env.ADMIN_OTP_PROVIDER = "twilio";
  process.env.ALLOW_DEV_OTP = "false";
  const db = new MemoryUnitOfWork();
  let sends = 0;
  const auth = new AdminAuthService(db, {
    send: async () => {
      sends++;
    },
    verify: async (_phone, code) => code === "456789",
  });
  const c = await auth.request({ phone: "+919999999999" }, "live-test");
  assert.equal(sends, 1);
  assert.equal(c.developmentCode, undefined);
  await assert.rejects(
    auth.verify({ challengeId: c.challengeId, code: "123456" }, "live-test"),
  );
  const token = await auth.verify(
    { challengeId: c.challengeId, code: "456789" },
    "live-test",
  );
  assert.equal(await auth.authenticate(token), "+919999999999");
});

test("early delivery webhook cannot be overwritten by a later API acceptance", async () => {
  cloudConfig();
  const db = new MemoryUnitOfWork();
  db.data.settings.whatsappRecipient = "+919999999999";
  const provider: WhatsAppProvider = {
    send: async (order, _recipient, attempt) => {
      await service.webhook(
        {
          id: "early-message",
          status: "delivered",
          timestamp: "100",
          recipient_id: "919999999999",
          biz_opaque_callback_data: `${order.id}:${attempt}`,
        },
        "123456789",
      );
      return { status: "accepted", messageId: "early-message" };
    },
  };
  const service = new WhatsAppService(db, provider);
  const result = await new CheckoutService(
    db,
    new CashMemoService(),
    service,
  ).submit(request(), randomUUID());
  assert.equal(result.whatsappStatus, "delivered");
});
