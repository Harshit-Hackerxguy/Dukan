import type { Category } from "@/lib/products";
import type {
  Adjustment,
  Challenge,
  Customer,
  Order,
  RateBucket,
  Session,
  StoreSettings,
  StoredProduct,
} from "../domain";

// Phase 3: implement this unit of work using a PostgreSQL transaction. Never expose
// these repositories to client components. Unique keys and locks belong in the DB.
export interface ProductRepository {
  list(): StoredProduct[];
  get(id: string): StoredProduct | undefined;
  save(product: StoredProduct): void;
  categories(): Category[];
  saveCategories(categories: Category[]): void;
}
export interface InventoryRepository {
  quantity(id: string): number;
  adjust(change: Adjustment): void;
  history(): Adjustment[];
}
export interface OrderRepository {
  list(): Order[];
  get(id: string): Order | undefined;
  byIdempotency(hash: string): Order | undefined;
  save(order: Order): void;
  nextMemo(): string;
}
export interface CustomerRepository {
  upsert(name: string, phone: string): Customer;
}
export interface AuthRepository {
  sessions(): Session[];
  saveSession(session: Session): void;
  deleteSession(hash: string): void;
  challenges(): Challenge[];
  saveChallenge(challenge: Challenge): void;
  deleteChallenge(id: string): void;
  consumeRate(key: string, limit: number, windowMs: number): boolean;
}
export interface Repositories {
  products: ProductRepository;
  inventory: InventoryRepository;
  orders: OrderRepository;
  customers: CustomerRepository;
  auth: AuthRepository;
  settings: { get(): StoreSettings; save(settings: StoreSettings): void };
}
export interface UnitOfWork {
  read<T>(fn: (repos: Repositories) => T | Promise<T>): Promise<T>;
  transaction<T>(fn: (repos: Repositories) => T | Promise<T>): Promise<T>;
}
export type { RateBucket };
