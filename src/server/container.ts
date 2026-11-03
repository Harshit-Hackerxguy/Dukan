import { DevelopmentFileUnitOfWork } from "./repositories/development";
import { ProductService } from "./services/product-service";
import { InventoryService } from "./services/inventory-service";
import { CashMemoService } from "./services/cash-memo-service";
import { WhatsAppService } from "./services/whatsapp-service";
import { CheckoutService } from "./services/checkout-service";
import { AdminAuthService } from "./services/admin-auth-service";

export const uow = new DevelopmentFileUnitOfWork();
export const products = new ProductService(uow);
export const inventory = new InventoryService(uow);
export const cashMemo = new CashMemoService();
export const whatsapp = new WhatsAppService(uow);
export const checkout = new CheckoutService(uow, cashMemo, whatsapp);
export const auth = new AdminAuthService(uow);
