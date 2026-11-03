import type { UnitOfWork } from "../repositories/interfaces";
import { categorySchema, productSchema, settingsSchema } from "../validation";
import { AppError } from "../errors";
import type { StoredProduct } from "../domain";

export class ProductService {
  constructor(private uow: UnitOfWork) {}
  catalogue() {
    return this.uow.read((r) => ({
      products: r.products
        .list()
        .filter((p) => !p.archived)
        .map((p) => {
          const { archived: _archived, ...publicProduct } = p;
          return {
            ...publicProduct,
            available: p.available && r.inventory.quantity(p.id) > 0,
          };
        }),
      categories: r.products.categories(),
      store: (({ name, contact, location, hours }) => ({
        name,
        contact,
        location,
        hours,
      }))(r.settings.get()),
    }));
  }
  adminList() {
    return this.uow.read((r) => ({
      products: r.products
        .list()
        .filter((p) => !p.archived)
        .map(({ archived: _a, ...p }) => p),
      categories: r.products.categories(),
      store: (({ name, contact, location, hours }) => ({
        name,
        contact,
        location,
        hours,
      }))(r.settings.get()),
    }));
  }
  async save(input: unknown) {
    const p = productSchema.parse(input);
    return this.uow.transaction((r) => {
      if (!r.products.categories().some((c) => c.id === p.category))
        throw new AppError(
          400,
          "INVALID_CATEGORY",
          "Choose an existing category.",
        );
      const existing = r.products.get(p.id);
      if (existing?.archived)
        throw new AppError(409, "ARCHIVED", "This product has been archived.");
      r.products.save({ ...p, archived: false } as StoredProduct);
      // Product edits never mutate inventory; new products start with zero stock.
      return p;
    });
  }
  archive(id: string) {
    return this.uow.transaction((r) => {
      const p = r.products.get(id);
      if (!p) throw new AppError(404, "NOT_FOUND", "Product not found.");
      r.products.save({ ...p, archived: true });
    });
  }
  saveCategory(input: unknown) {
    const category = categorySchema.parse(input);
    return this.uow.transaction((r) => {
      const categories = r.products.categories();
      r.products.saveCategories([
        ...categories.filter((c) => c.id !== category.id),
        category,
      ]);
    });
  }
  deleteCategory(id: string) {
    return this.uow.transaction((r) => {
      if (r.products.list().some((p) => !p.archived && p.category === id))
        throw new AppError(
          409,
          "CATEGORY_IN_USE",
          "Move or archive this category’s products first.",
        );
      r.products.saveCategories(
        r.products.categories().filter((c) => c.id !== id),
      );
    });
  }
  saveSettings(input: unknown) {
    const { whatsappConsent, ...settings } = settingsSchema.parse(input);
    return this.uow.transaction((r) => {
      const previous = r.settings.get();
      r.settings.save({
        ...settings,
        whatsappConsentAt:
          whatsappConsent && settings.whatsappRecipient
            ? (previous.whatsappRecipient === settings.whatsappRecipient &&
                previous.whatsappConsentAt) ||
              new Date().toISOString()
            : null,
      });
    });
  }
}
