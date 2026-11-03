import type { Category, Product } from "@/lib/products";

export type StoredProduct = Product & { archived: boolean };
export type Customer = { id: string; name: string; phone: string };
export type OrderLine = {
  productId: string;
  name: string;
  hindiName: string;
  weight: number;
  unit: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
};
export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type DeliveryStatus =
  | "pending"
  | "not_configured"
  | "mock"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";
export type Delivery = {
  status: DeliveryStatus;
  attempts: number;
  updatedAt: string;
  messageId?: string;
  attemptId?: string;
  recipient?: string;
  error?: string;
  retryable?: boolean;
  nextAttemptAt?: string;
  eventAt?: number;
};
export type StoreSettings = {
  name: string;
  contact: string;
  location: string;
  hours: string;
  whatsappRecipient: string;
  whatsappConsentAt: string | null;
};
export type Order = {
  id: string;
  memoNumber: string;
  createdAt: string;
  customer: Customer;
  items: OrderLine[];
  totalPaise: number;
  status: OrderStatus;
  idempotencyHash: string;
  requestHash: string;
  pdfBase64: string;
  store: StoreSettings;
  whatsapp: Delivery;
};
export type Adjustment = {
  id: string;
  productId: string;
  productName: string;
  before: number;
  after: number;
  reason: string;
  actor: string;
  createdAt: string;
};
export type Session = { tokenHash: string; phone: string; expiresAt: number };
export type Challenge = {
  id: string;
  phone: string;
  hash?: string;
  expiresAt: number;
  attempts: number;
  provider: "mock" | "twilio";
};
export type RateBucket = { count: number; expiresAt: number };
export type DevelopmentData = {
  schema: 2;
  sequence: number;
  products: StoredProduct[];
  categories: Category[];
  inventory: Record<string, number>;
  adjustments: Adjustment[];
  orders: Order[];
  customers: Customer[];
  settings: StoreSettings;
  sessions: Session[];
  challenges: Challenge[];
  rateLimits: Record<string, RateBucket>;
};
export type OrderSummary = Omit<
  Order,
  "pdfBase64" | "idempotencyHash" | "requestHash"
>;
