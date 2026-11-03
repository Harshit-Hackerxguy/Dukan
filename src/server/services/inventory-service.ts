import { randomUUID } from "node:crypto";
import type { UnitOfWork } from "../repositories/interfaces";
import { inventorySchema } from "../validation";
import { AppError } from "../errors";

export class InventoryService {
  constructor(private uow: UnitOfWork) {}
  list() {
    return this.uow.read((r) => ({
      products: r.products
        .list()
        .filter((p) => !p.archived)
        .map((p) => ({
          id: p.id,
          name: p.name,
          weight: p.weight,
          unit: p.unit,
          quantity: r.inventory.quantity(p.id),
        })),
      history: r.inventory.history(),
    }));
  }
  adjust(input: unknown, actor: string) {
    const request = inventorySchema.parse(input);
    return this.uow.transaction((r) => {
      for (const change of request.changes) {
        const p = r.products.get(change.productId);
        if (!p || p.archived)
          throw new AppError(404, "NOT_FOUND", "Product not found.");
        if (r.inventory.quantity(p.id) !== change.expectedQuantity)
          throw new AppError(
            409,
            "STOCK_EDIT_CONFLICT",
            "Stock was edited elsewhere. Reload before saving.",
          );
      }
      for (const change of request.changes) {
        if (change.quantity === change.expectedQuantity) continue;
        r.inventory.adjust({
          id: randomUUID(),
          productId: change.productId,
          productName: r.products.get(change.productId)!.name,
          before: change.expectedQuantity,
          after: change.quantity,
          reason: request.reason,
          actor,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }
}
