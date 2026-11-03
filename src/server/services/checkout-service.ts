import { randomUUID } from "node:crypto";
import type { UnitOfWork } from "../repositories/interfaces";
import type { Order } from "../domain";
import { checkoutSchema } from "../validation";
import { AppError } from "../errors";
import { hash } from "./admin-auth-service";
import { CashMemoService } from "./cash-memo-service";
import { WhatsAppService } from "./whatsapp-service";

export class CheckoutService {
  constructor(
    private uow: UnitOfWork,
    private cashMemo: CashMemoService,
    private whatsapp: WhatsAppService,
  ) {}
  async submit(input: unknown, key: string) {
    const request = checkoutSchema.parse(input);
    if (!/^[a-zA-Z0-9_-]{32,100}$/.test(key))
      throw new AppError(
        400,
        "IDEMPOTENCY_REQUIRED",
        "A valid submission reference is required. Please reload the checkout.",
      );
    request.items.sort((a, b) => a.productId.localeCompare(b.productId));
    const idempotencyHash = hash(key),
      requestHash = hash(JSON.stringify(request));
    const result = await this.uow.transaction(async (r) => {
      const previous = r.orders.byIdempotency(idempotencyHash);
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This submission reference belongs to another request.",
          );
        return previous;
      }
      const items = request.items.map((item) => {
        const p = r.products.get(item.productId);
        if (
          !p ||
          p.archived ||
          !p.available ||
          r.inventory.quantity(p.id) === 0
        )
          throw new AppError(
            409,
            "PRODUCT_UNAVAILABLE",
            "An item in your bag is out of stock or no longer available. Please review your bag.",
          );
        if (item.quantity > r.inventory.quantity(p.id))
          throw new AppError(
            409,
            "QUANTITY_UNAVAILABLE",
            "Requested quantity unavailable.",
          );
        const unitPricePaise = Math.round(p.price * 100);
        return {
          productId: p.id,
          name: p.name,
          hindiName: p.hindiName,
          weight: p.weight,
          unit: p.unit,
          quantity: item.quantity,
          unitPricePaise,
          totalPaise: unitPricePaise * item.quantity,
        };
      });
      const order: Order = {
        id: randomUUID(),
        memoNumber: r.orders.nextMemo(),
        createdAt: new Date().toISOString(),
        customer: r.customers.upsert(request.name, request.phone),
        items,
        totalPaise: items.reduce((sum, i) => sum + i.totalPaise, 0),
        status: "pending",
        idempotencyHash,
        requestHash,
        pdfBase64: "",
        store: structuredClone(r.settings.get()),
        whatsapp: {
          status: "pending",
          attempts: 0,
          updatedAt: new Date().toISOString(),
        },
      };
      order.pdfBase64 = (await this.cashMemo.generate(order)).toString(
        "base64",
      );
      r.orders.save(order);
      // No stock adjustment or reservation is permitted here.
      return order;
    });
    let delivery;
    try {
      delivery = await this.whatsapp.dispatch(result.id);
    } catch {
      delivery = result.whatsapp;
    }
    return {
      memoNumber: result.memoNumber,
      totalPaise: result.totalPaise,
      createdAt: result.createdAt,
      whatsappStatus: delivery.status,
      message:
        "Your order request has been recorded. Product availability is subject to confirmation by the store.",
    };
  }
}
