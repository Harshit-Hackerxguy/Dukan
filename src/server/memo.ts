import "regenerator-runtime/runtime";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
type MemoInput = {
  number: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  storeName: string;
  storeContact: string;
  totalPaise: number;
  items: {
    name: string;
    packaging: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }[];
};
let fontBytes: Promise<Buffer[]> | undefined;
export async function generateMemo(input: MemoInput) {
  fontBytes ??= Promise.all(
    ["NotoSans-Regular.ttf", "NotoSansDevanagari-Regular.ttf"].map((file) =>
      readFile(path.join(process.cwd(), "assets/fonts", file)),
    ),
  );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(
    (await fontBytes).map((bytes) => pdf.embedFont(bytes, { subset: true })),
  );
  const charsets = fonts.map((font) => new Set(font.getCharacterSet()));
  const runs = (value: string) => {
    const result: { text: string; font: PDFFont }[] = [];
    for (const c of value) {
      const index = charsets.findIndex((set) => set.has(c.codePointAt(0)!));
      const font = fonts[Math.max(index, 0)];
      const text = index < 0 ? "?" : c;
      const last = result[result.length - 1];
      if (last?.font === font) last.text += text;
      else result.push({ text, font });
    }
    return result;
  };
  const width = (value: string, size: number) =>
    runs(value).reduce(
      (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size),
      0,
    );
  let page = pdf.addPage([595, 842]);
  let y = 794;
  const line = (value: string, size = 11) => {
    // Wrap by measured width so long names and multi-page orders remain readable.
    let part = "";
    for (const char of value.replace(/[\r\n\t]/g, " ")) {
      if (width(part + char, size) > 495 && part) {
        draw(part, size);
        part = "";
      }
      part += char;
    }
    draw(part, size);
  };
  const draw = (text: string, size: number) => {
    if (y < 50) {
      page = pdf.addPage([595, 842]);
      y = 794;
    }
    let x = 50;
    for (const run of runs(text)) {
      page.drawText(run.text, {
        x,
        y,
        size,
        font: run.font,
        color: rgb(0.12, 0.2, 0.16),
      });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
    y -= size + 9;
  };
  line(input.storeName, 21);
  line(input.storeContact);
  line(`Cash memo ${input.number}`, 15);
  line(
    input.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) +
      " IST",
  );
  line(`Customer: ${input.customerName}`);
  line(`Mobile: ${input.customerPhone}`);
  y -= 10;
  for (const item of input.items) {
    line(`${item.name} (${item.packaging})`);
    line(
      `${item.quantity} × INR ${(item.unitPricePaise / 100).toFixed(2)} = INR ${(item.lineTotalPaise / 100).toFixed(2)}`,
    );
  }
  y -= 12;
  line(`Total: INR ${(input.totalPaise / 100).toFixed(2)}`, 16);
  line("Order request only. This document is not proof of payment.");
  line("Product availability is subject to confirmation by the store.");
  pdf.setTitle(`Cash memo ${input.number}`);
  pdf.setCreationDate(input.createdAt);
  return Buffer.from(await pdf.save());
}
