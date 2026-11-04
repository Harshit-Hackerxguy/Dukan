import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CashMemoService,
  type CashMemoDocument,
} from "../../src/server/services/cash-memo-service";
const document: CashMemoDocument = {
  memoNumber: "CM-TEST-001",
  createdAt: "2026-11-04T04:00:00Z",
  customer: { name: "परीक्षा Customer", phone: "+919876543210" },
  store: { contact: "Test contact", location: "Test location" },
  totalPaise: 150250,
  items: [
    {
      productId: "rice",
      name: "Rice चावल",
      hindiName: "चावल",
      weight: 30,
      unit: "kg",
      quantity: 2,
      unitPricePaise: 75125,
      totalPaise: 150250,
    },
  ],
};
async function inspect(
  input: CashMemoDocument,
  verify: (text: string, fonts: string) => void,
) {
  const bytes = await new CashMemoService().generate(input);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const directory = await mkdtemp(join(tmpdir(), "dukan-memo-"));
  try {
    const file = join(directory, "memo.pdf");
    await writeFile(file, bytes);
    const text = execFileSync("pdftotext", ["-layout", file, "-"], {
      encoding: "utf8",
    });
    const fonts = execFileSync("pdffonts", [file], { encoding: "utf8" });
    verify(text, fonts);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("Phase 2 cash memo branding, centered headings, table, Hindi, and amounts are retained", async () => {
  await inspect(document, (text, fonts) => {
    for (const value of [
      "Sanjay Store",
      "CASH MEMO",
      document.memoNumber,
      "PRODUCT / PACKAGE",
      "BAGS",
      "RATE",
      "TOTAL",
      "Customer:",
      "चावल",
      "751.25",
      "1,502.50",
      "Grand total",
      "Shipping charges may vary",
      "does not confirm payment",
      "Product availability is subject to confirmation",
      "Page 1 of 1",
    ])
      assert.ok(text.includes(value), `Missing: ${value}`);
    const lines = text.split("\n");
    assert.ok(
      lines
        .find((line) => line.includes("Sanjay Store"))!
        .indexOf("Sanjay Store") > 15,
    );
    assert.ok(
      lines.find((line) => line.includes("CASH MEMO"))!.indexOf("CASH MEMO") >
        15,
    );
    assert.match(fonts, /NotoSans/);
    assert.match(fonts, /NotoSansDevanagari/);
  });
});
test("long bilingual memos paginate with repeated headers and every item preserved", async () => {
  const items = Array.from({ length: 80 }, (_, index) => ({
    ...document.items[0],
    productId: `item-${index}`,
    name: `Item ${String(index + 1).padStart(3, "0")} चावल`,
    hindiName: "प्रीमियम चावल",
    quantity: 1,
    totalPaise: 75125,
  }));
  await inspect(
    { ...document, items, totalPaise: items.length * 75125 },
    (text) => {
      assert.ok((text.match(/PRODUCT \/ PACKAGE/g) || []).length > 1);
      assert.match(text, /Page 1 of [2-9]/);
      for (let index = 1; index <= items.length; index++)
        assert.ok(text.includes(`Item ${String(index).padStart(3, "0")}`));
      assert.ok(text.includes("60,100.00"));
    },
  );
});
