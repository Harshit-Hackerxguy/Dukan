import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import type { Order } from "../domain";

export type CashMemoDocument = Pick<
  Order,
  "memoNumber" | "createdAt" | "items" | "totalPaise"
> & {
  customer: Pick<Order["customer"], "name" | "phone">;
  store: Pick<Order["store"], "contact" | "location">;
};
export class CashMemoService {
  async generate(order: CashMemoDocument): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margin: 38,
      bufferPages: true,
      autoFirstPage: true,
      font: resolve("assets/fonts/NotoSans-Regular.ttf"),
      info: {
        Title: `CASH MEMO ${order.memoNumber}`,
        Author: "Sanjay Store",
      },
    });
    doc.registerFont("Latin", resolve("assets/fonts/NotoSans-Regular.ttf"));
    doc.registerFont(
      "Hindi",
      resolve("assets/fonts/NotoSansDevanagari-Regular.ttf"),
    );
    const parts: Buffer[] = [];
    const complete = new Promise<Buffer>((accept, reject) => {
      doc.on("data", (part) => parts.push(part));
      doc.on("end", () => accept(Buffer.concat(parts)));
      doc.on("error", reject);
    });
    const money = (paise: number) =>
      `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const mixed = (
      text: string,
      x: number,
      y: number,
      width: number,
      size = 10,
      draw = true,
    ) => {
      const runs =
        text.match(
          /\s+|[\u0900-\u097f\uA8E0-\uA8FF]+|[^\s\u0900-\u097f\uA8E0-\uA8FF]+/g,
        ) || [];
      const lineHeight = size * 1.65;
      let dx = 0,
        dy = 0;
      doc.fontSize(size);
      for (const run of runs) {
        const font = /[\u0900-\u097f]/.test(run) ? "Hindi" : "Latin";
        doc.font(font);
        const widthOfRun = doc.widthOfString(run);
        const pieces =
          widthOfRun > width
            ? Array.from(
                new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(
                  run,
                ),
                (item) => item.segment,
              )
            : [run];
        for (const piece of pieces) {
          const pieceWidth = doc.widthOfString(piece);
          if (dx + pieceWidth > width && dx > 0) {
            dx = 0;
            dy += lineHeight;
          }
          if (/^\s+$/.test(piece) && dx === 0) continue;
          if (draw) doc.text(piece, x + dx, y + dy, { lineBreak: false });
          dx += pieceWidth;
        }
      }
      if (draw) {
        doc.x = x;
        doc.y = y + dy + lineHeight;
      }
      doc.font("Latin");
      return dy + lineHeight;
    };
    const tableHeader = (y: number) => {
      doc.rect(38, y, 519, 28).fill("#245440");
      doc.fillColor("#ffffff").font("Latin").fontSize(11);
      doc.text("PRODUCT / PACKAGE", 48, y + 6, { width: 230 });
      doc.text("BAGS", 295, y + 6, { width: 42, align: "right" });
      doc.text("RATE", 350, y + 6, { width: 80, align: "right" });
      doc.text("TOTAL", 447, y + 6, { width: 100, align: "right" });
      doc.fillColor("#26372e");
    };
    doc.fillColor("#245440");
    doc
      .font("Latin")
      .fontSize(21)
      .text("Sanjay Store", 38, 34, {
        width: doc.page.width - 76,
        align: "center",
      });
    doc.fillColor("#536354");
    const storeDetails = [order.store.contact, order.store.location]
      .filter(Boolean)
      .join(" · ");
    if (storeDetails) mixed(storeDetails, 38, doc.y + 5, 519, 9);
    const headingY = Math.max(72, doc.y + 8);
    doc
      .fillColor("#26372e")
      .font("Latin")
      .fontSize(15)
      .text("CASH MEMO", 38, headingY, {
        width: doc.page.width - 76,
        align: "center",
      });
    doc.fontSize(10).text(`Memo No: ${order.memoNumber}`, 38, headingY + 29);
    const date = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(order.createdAt));
    doc.text(`${date} IST`, 280, headingY + 29, { width: 277, align: "right" });
    mixed(`Customer: ${order.customer.name}`, 38, headingY + 51, 519);
    doc.font("Latin").text(`Phone: ${order.customer.phone}`, 38, doc.y + 7);
    let y = doc.y + 23;
    tableHeader(y);
    y += 34;
    for (const item of order.items) {
      doc.font("Latin").fontSize(11);
      const nameHeight = mixed(
        `${item.name} · ${item.weight} ${item.unit}`,
        0,
        0,
        235,
        11,
        false,
      );
      doc.font("Hindi").fontSize(11);
      const hindiHeight = item.hindiName
        ? mixed(item.hindiName, 0, 0, 235, 11, false)
        : 0;
      const height = Math.max(50, nameHeight + hindiHeight + 22);
      if (y + height > 708) {
        doc.addPage();
        doc
          .font("Latin")
          .fontSize(10)
          .text(`${order.memoNumber} · Continued`, 38, 35);
        tableHeader(60);
        y = 94;
      }
      mixed(`${item.name} · ${item.weight} ${item.unit}`, 48, y + 5, 235, 11);
      if (item.hindiName) {
        doc.fillColor("#536354");
        mixed(item.hindiName, 48, doc.y + 3, 235, 11);
      }
      doc.fillColor("#26372e").font("Latin").fontSize(11);
      doc.text(String(item.quantity), 295, y + 8, {
        width: 42,
        align: "right",
      });
      doc.text(money(item.unitPricePaise), 342, y + 8, {
        width: 88,
        align: "right",
      });
      doc.text(money(item.totalPaise), 435, y + 8, {
        width: 112,
        align: "right",
      });
      y += height;
      doc.moveTo(38, y).lineTo(557, y).strokeColor("#e0e5df").stroke();
    }
    if (y > 620) {
      doc.addPage();
      y = 45;
    }
    doc.rect(325, y + 13, 232, 38).fill("#edf2e8");
    doc
      .fillColor("#245440")
      .font("Latin")
      .fontSize(12)
      .text("Grand total", 337, y + 24);
    doc.text(money(order.totalPaise), 420, y + 24, {
      width: 125,
      align: "right",
    });
    doc.fillColor("#536354").fontSize(9);
    doc.text(
      "Shipping charges may vary and will be confirmed by the store.",
      38,
      y + 76,
      { width: 519 },
    );
    doc.text(
      "This document is an order request and does not confirm payment.",
      38,
      doc.y + 7,
      { width: 519 },
    );
    doc.text(
      "Product availability is subject to confirmation by the store.",
      38,
      doc.y + 7,
      { width: 519 },
    );
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font("Latin").fontSize(8).fillColor("#536354");
      doc.text(
        `${order.memoNumber}  ·  Page ${i + 1} of ${range.count}`,
        38,
        780,
        { width: 519, align: "center", lineBreak: false },
      );
    }
    doc.end();
    return complete;
  }
}
