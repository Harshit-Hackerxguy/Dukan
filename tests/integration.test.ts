import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac, randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { db } from "../src/server/db";
import {
  catalogue,
  saveProduct,
  adjustStock,
  availability,
  archiveProduct,
} from "../src/server/catalogue";
import { checkout, setOrderStatus } from "../src/server/orders";
import {
  processNextJob,
  retryDelivery,
  applyWebhook,
  verifyWebhook,
} from "../src/server/delivery";
import { getAdmin, requestOtp, verifyOtp } from "../src/server/auth";
import { hash } from "../src/server/http";
import type { Product } from "../src/lib/products";
if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error(
    "Integration tests require an isolated database ending in _test",
  );
after(() => db.$disconnect());
test("PostgreSQL business workflows and security invariants", async (t) => {
  const suffix = randomUUID();
  process.env.ADMIN_PHONE = `+9198${String(randomInt(10000000, 99999999))}`;
  const admin = await db.admin.upsert({
    where: { phone: process.env.ADMIN_PHONE! },
    create: { phone: process.env.ADMIN_PHONE!, name: "Test admin" },
    update: {},
  });
  await db.storeSettings.upsert({
    where: { id: "store" },
    create: { name: "दुकान Store", whatsappRecipient: admin.phone },
    update: {},
  });
  const category = await db.category.create({
    data: { name: `Test ${suffix}` },
  });
  const product: Product = {
    id: `test-${suffix}`,
    name: "Rice चावल",
    hindiName: "चावल",
    description: "Test rice",
    category: category.id,
    weight: 30,
    unit: "kg",
    price: 751.25,
    image: "",
    illustration: "rice",
    tone: "green",
    available: true,
  };
  let orderId = "",
    memoId = "",
    pdf: Uint8Array;
  const otherId = `other-${suffix}`;
  await t.test(
    "create a product and an independent package variant",
    async () => {
      await saveProduct(product, admin.id);
      const row = await db.productVariant.findUniqueOrThrow({
        where: { id: product.id },
      });
      await saveProduct(
        {
          ...product,
          id: otherId,
          productId: row.productId,
          weight: 50,
          price: 1200,
        },
        admin.id,
      );
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { variantId: product.id },
          })
        ).quantity,
        0,
      );
      assert.equal(
        (await db.productVariant.findUniqueOrThrow({ where: { id: otherId } }))
          .productId,
        row.productId,
      );
    },
  );
  await t.test(
    "authorized manual set/increase/decrease and atomic bulk updates",
    async () => {
      await adjustStock(
        {
          updates: [
            { variantId: product.id, version: 0, mode: "set", quantity: 10 },
            { variantId: otherId, version: 0, mode: "set", quantity: 5 },
          ],
        },
        admin.id,
      );
      await adjustStock(
        {
          updates: [
            {
              variantId: product.id,
              version: 1,
              mode: "increase",
              quantity: 2,
            },
          ],
        },
        admin.id,
      );
      await adjustStock(
        {
          updates: [
            {
              variantId: product.id,
              version: 2,
              mode: "decrease",
              quantity: 1,
            },
          ],
        },
        admin.id,
      );
      const before = await db.inventoryBalance.findUniqueOrThrow({
        where: { variantId: product.id },
      });
      await assert.rejects(
        adjustStock(
          {
            updates: [
              {
                variantId: product.id,
                version: before.version,
                mode: "set",
                quantity: 20,
              },
              { variantId: otherId, version: 0, mode: "set", quantity: 50 },
            ],
          },
          admin.id,
        ),
        /Stock changed/,
      );
      assert.equal(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { variantId: product.id },
          })
        ).quantity,
        11,
      );
      await assert.rejects(
        adjustStock(
          {
            updates: [
              {
                variantId: product.id,
                version: before.version,
                mode: "set",
                quantity: -1,
              },
            ],
          },
          admin.id,
        ),
      );
      await assert.rejects(
        adjustStock(
          {
            updates: [
              {
                variantId: product.id,
                version: before.version,
                mode: "set",
                quantity: 1.2,
              },
            ],
          },
          admin.id,
        ),
      );
    },
  );
  await t.test(
    "concurrent stock editors cannot overwrite each other",
    async () => {
      const row = await db.inventoryBalance.findUniqueOrThrow({
        where: { variantId: product.id },
      });
      const results = await Promise.allSettled(
        [12, 13].map((quantity) =>
          adjustStock(
            {
              updates: [
                {
                  variantId: product.id,
                  version: row.version,
                  mode: "set",
                  quantity,
                },
              ],
            },
            admin.id,
          ),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      const history = await db.stockAdjustment.findMany({
        where: { variantId: product.id },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(history.length, 4);
      assert.ok(
        history.every(
          (h) =>
            h.difference === h.newQuantity - h.previousQuantity &&
            h.adminId === admin.id,
        ),
      );
    },
  );
  await t.test(
    "public catalogue exposes updated prices but no exact stock",
    async () => {
      const catalog = await catalogue();
      const row = catalog.products.find((p) => p.id === product.id)!;
      assert.equal(row.price, 751.25);
      assert.equal(row.available, true);
      assert.ok(
        !JSON.stringify(row).match(
          /quantity|inventory|stock|updatedBy|version/i,
        ),
      );
      assert.deepEqual(
        await availability([{ variantId: product.id, quantity: 99 }]),
        [{ variantId: product.id, available: false }],
      );
    },
  );
  const payload = {
    name: "परीक्षा Customer",
    phone: "9876543211",
    items: [{ variantId: product.id, quantity: 2, expectedPricePaise: 75125 }],
  };
  await t.test(
    "concurrent checkout retries persist exactly one order, PDF and job without changing stock",
    async () => {
      const before = await db.inventoryBalance.findMany({
        where: { variantId: { in: [product.id, otherId] } },
      });
      const key = randomUUID();
      const results = await Promise.all([
        checkout(payload, key),
        checkout(payload, key),
      ]);
      assert.deepEqual(results[0], results[1]);
      orderId = results[0].orderId;
      const order = await db.orderRequest.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          customer: true,
          memo: { include: { job: true } },
        },
      });
      assert.equal(order.customerPhone, "+919876543211");
      assert.equal(order.customer.phoneVerified, false);
      assert.equal(order.totalPaise, 150250);
      assert.equal(order.items[0].unitPricePaise, 75125);
      assert.ok(order.memo?.job);
      memoId = order.memo.id;
      pdf = order.memo.pdf;
      assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
      assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
      assert.deepEqual(
        await db.inventoryBalance.findMany({
          where: { variantId: { in: [product.id, otherId] } },
        }),
        before,
      );
      await assert.rejects(
        checkout({ ...payload, name: "Different customer" }, key),
        /already been used/,
      );
    },
  );
  await t.test(
    "checkout revalidates price, availability, and quantity",
    async () => {
      await assert.rejects(
        checkout(
          {
            ...payload,
            items: [
              {
                variantId: product.id,
                quantity: 99,
                expectedPricePaise: 75125,
              },
            ],
          },
          randomUUID(),
        ),
        /unavailable/,
      );
      await assert.rejects(
        checkout(
          {
            ...payload,
            items: [
              { variantId: product.id, quantity: 1, expectedPricePaise: 1 },
            ],
          },
          randomUUID(),
        ),
        /price changed/,
      );
      const row = (await catalogue(true)).products.find(
        (p) => p.id === product.id,
      )!;
      await saveProduct({ ...row, available: false }, admin.id);
      await assert.rejects(checkout(payload, randomUUID()), /unavailable/);
      await saveProduct(
        {
          ...(await catalogue(true)).products.find((p) => p.id === product.id)!,
          available: true,
        },
        admin.id,
      );
    },
  );
  await t.test(
    "price/name edits preserve historical prices and memo bytes",
    async () => {
      await saveProduct(
        {
          ...(await catalogue(true)).products.find((p) => p.id === product.id)!,
          price: 800,
          name: "Updated rice",
        },
        admin.id,
      );
      assert.equal(
        (await catalogue()).products.find((p) => p.id === product.id)!.price,
        800,
      );
      const order = await db.orderRequest.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, memo: true },
      });
      assert.equal(order.items[0].name, "Rice चावल");
      assert.equal(order.items[0].unitPricePaise, 75125);
      assert.deepEqual(order.memo!.pdf, pdf);
    },
  );
  await t.test(
    "order completion and cancellation do not affect stock",
    async () => {
      const before = await db.inventoryBalance.findUniqueOrThrow({
        where: { variantId: product.id },
      });
      for (const status of ["CONFIRMED", "COMPLETED", "CANCELLED"])
        await setOrderStatus(orderId, status, admin.id);
      assert.deepEqual(
        await db.inventoryBalance.findUniqueOrThrow({
          where: { variantId: product.id },
        }),
        before,
      );
    },
  );
  await t.test(
    "failed delivery keeps the order and safe retry reuses its memo",
    async () => {
      const before = await db.inventoryBalance.findUniqueOrThrow({
        where: { variantId: product.id },
      });
      while (
        await processNextJob(async () => {
          throw new Error("Simulated provider timeout");
        })
      ) {
        /* drain this isolated test database */
      }
      assert.equal(
        (await db.cashMemo.findUniqueOrThrow({ where: { id: memoId } }))
          .deliveryStatus,
        "UNCERTAIN",
      );
      assert.ok(await db.orderRequest.findUnique({ where: { id: orderId } }));
      await assert.rejects(
        retryDelivery(memoId, admin.id, false),
        /acknowledge/,
      );
      await retryDelivery(memoId, admin.id, true);
      await assert.rejects(
        retryDelivery(memoId, admin.id, true),
        /already queued/,
      );
      let sends = 0;
      const messageId = `provider-${suffix}`;
      await Promise.all([
        processNextJob(async () => {
          sends++;
          return messageId;
        }),
        processNextJob(async () => {
          sends++;
          return messageId;
        }),
      ]);
      assert.equal(sends, 1);
      assert.equal(
        (await db.cashMemo.findUniqueOrThrow({ where: { id: memoId } }))
          .deliveryStatus,
        "SUBMITTED",
      );
      assert.deepEqual(
        await db.inventoryBalance.findUniqueOrThrow({
          where: { variantId: product.id },
        }),
        before,
      );
      const payload = {
        entry: [
          {
            changes: [
              { value: { statuses: [{ id: messageId, status: "delivered" }] } },
            ],
          },
        ],
      };
      process.env.WHATSAPP_APP_SECRET = "integration-only-secret";
      const raw = JSON.stringify(payload);
      verifyWebhook(
        raw,
        `sha256=${createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(raw).digest("hex")}`,
      );
      assert.throws(() => verifyWebhook(raw, "sha256=bad"), /Invalid/);
      await applyWebhook(payload);
      await applyWebhook({
        entry: [
          {
            changes: [
              { value: { statuses: [{ id: messageId, status: "sent" }] } },
            ],
          },
        ],
      });
      assert.equal(
        (await db.cashMemo.findUniqueOrThrow({ where: { id: memoId } }))
          .deliveryStatus,
        "DELIVERED",
      );
    },
  );
  await t.test(
    "repeat phone links guest records without merging order snapshots",
    async () => {
      const next = await checkout(
        {
          ...payload,
          name: "Another stated name",
          items: [
            { variantId: product.id, quantity: 1, expectedPricePaise: 80000 },
          ],
        },
        randomUUID(),
      );
      const [first, second] = await Promise.all(
        [orderId, next.orderId].map((id) =>
          db.orderRequest.findUniqueOrThrow({ where: { id } }),
        ),
      );
      assert.equal(first.customerId, second.customerId);
      assert.equal(first.customerName, "परीक्षा Customer");
      assert.equal(second.customerName, "Another stated name");
    },
  );
  await t.test(
    "unconfigured WhatsApp records a failed attempt without losing a request",
    async () => {
      const token = process.env.WHATSAPP_TOKEN;
      process.env.WHATSAPP_TOKEN = "";
      try {
        while (await processNextJob()) {
          /* all sends fail locally before any provider call */
        }
        const failed = await db.whatsAppDeliveryAttempt.findFirst({
          where: { error: "WhatsApp provider is not configured" },
          orderBy: { createdAt: "desc" },
        });
        assert.ok(failed);
        assert.equal(failed.status, "FAILED");
        assert.ok(
          await db.cashMemo.findUnique({
            where: { id: failed.memoId },
            include: { order: true },
          }),
        );
      } finally {
        if (token === undefined) delete process.env.WHATSAPP_TOKEN;
        else process.env.WHATSAPP_TOKEN = token;
      }
    },
  );
  await t.test(
    "PostgreSQL rejects invalid stock even outside the API",
    async () => {
      await assert.rejects(
        db.inventoryBalance.update({
          where: { variantId: product.id },
          data: { quantity: -1 },
        }),
      );
      assert.ok(
        (
          await db.inventoryBalance.findUniqueOrThrow({
            where: { variantId: product.id },
          })
        ).quantity >= 0,
      );
    },
  );
  await t.test("stock survives a new application process", async () => {
    const before = await db.inventoryBalance.findUniqueOrThrow({
      where: { variantId: product.id },
    });
    const code = `import { db } from './src/server/db'; db.inventoryBalance.findUniqueOrThrow({where:{variantId:${JSON.stringify(product.id)}}}).then(r=>console.log(r.quantity)).finally(()=>db.$disconnect());`;
    const result = execFileSync(
      process.execPath,
      ["--import", "tsx", "-e", code],
      { cwd: process.cwd(), env: process.env, encoding: "utf8" },
    );
    assert.equal(Number(result.trim()), before.quantity);
  });
  await t.test(
    "OTP is restricted, expires, is single use, and stores only session hashes",
    async () => {
      assert.equal(await getAdmin("invalid-token"), null);
      await assert.rejects(requestOtp("+919876543212"), /not authorized/);
      const challenge = await requestOtp(admin.phone);
      await assert.rejects(
        verifyOtp({ challengeId: challenge.challengeId, code: "000000" }),
        /Invalid/,
      );
      const token = await verifyOtp({
        challengeId: challenge.challengeId,
        code: process.env.TEST_OTP,
      });
      assert.equal((await getAdmin(token))?.id, admin.id);
      await assert.rejects(
        verifyOtp({
          challengeId: challenge.challengeId,
          code: process.env.TEST_OTP,
        }),
        /Invalid|already used/,
      );
      const session = await db.adminSession.findUniqueOrThrow({
        where: { tokenHash: hash(token) },
      });
      assert.notEqual(session.tokenHash, token);
      await db.adminSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(0) },
      });
      assert.equal(await getAdmin(token), null);
      const expired = await db.otpChallenge.create({
        data: { phone: admin.phone, expiresAt: new Date(0) },
      });
      await assert.rejects(
        verifyOtp({ challengeId: expired.id, code: process.env.TEST_OTP }),
        /expired/,
      );
    },
  );
  await t.test("archive preserves historical records", async () => {
    await archiveProduct(product.id, admin.id);
    assert.ok(!(await catalogue()).products.some((p) => p.id === product.id));
    assert.ok(await db.cashMemo.findUnique({ where: { id: memoId } }));
    assert.ok(
      await db.stockAdjustment.count({ where: { variantId: product.id } }),
    );
  });
});
