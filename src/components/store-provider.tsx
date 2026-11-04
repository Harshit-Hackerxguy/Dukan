"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Check, X } from "lucide-react";
import type { Product, Category } from "@/lib/products";
import { storeConfig } from "@/lib/store-config";
import { api } from "@/lib/api";
type Cart = Record<string, number>;
type Settings = {
  name: string;
  contact: string;
  location: string;
  hours: string;
  descriptor: string;
};
type Catalogue = {
  products: Product[];
  categories: Category[];
  settings: Partial<Settings> | null;
};
type StoreContextType = {
  products: Product[];
  categories: Category[];
  cart: Cart;
  hydrated: boolean;
  error: string;
  loading: boolean;
  storeInfo: Settings;
  settings: Settings;
  storageAvailable: boolean;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  clearCart: () => void;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  categoryName: (id: string) => string;
};
const StoreContext = createContext<StoreContextType | null>(null);
const STORAGE_KEY = "dukan-bag-v3";
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = /^\/admin(\/|$)/.test(pathname);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>(storeConfig);
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quantityVersions = useRef<Record<string, number>>({});
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const data = await api<Catalogue>(
        admin ? "admin/catalogue" : "catalogue",
      );
      if (request !== requestId.current) return;
      setProducts(data.products);
      setCart((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) =>
            data.products.some((product) => product.id === id),
          ),
        ),
      );
      setCategories(data.categories);
      setSettings({ ...storeConfig, ...data.settings });
      setError("");
    } catch (e) {
      if (request === requestId.current) {
        setError(e instanceof Error ? e.message : "Could not load catalogue");
        setProducts([]);
      }
    } finally {
      if (request === requestId.current) {
        setHydrated(true);
        setLoading(false);
      }
    }
  }, [admin]);
  useEffect(() => {
    // Synchronize browser storage after hydration without changing the server snapshot.
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(STORAGE_KEY) ||
            localStorage.getItem("dukan-phase2-bag") ||
            "{}",
        );
        const restored: Cart = {};
        for (const [id, quantity] of Object.entries(saved))
          if (
            typeof quantity === "number" &&
            Number.isInteger(quantity) &&
            quantity > 0 &&
            quantity <= 99
          )
            restored[id] = quantity;
        setCart(restored);
      } catch {
        setStorageAvailable(false);
      }
      void refresh();
    });
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      queueMicrotask(() => setStorageAvailable(false));
    }
  }, [cart, hydrated]);
  const setQuantity = async (id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) return;
    const version = (quantityVersions.current[id] || 0) + 1;
    quantityVersions.current[id] = version;
    if (quantity > 0) {
      try {
        const [result] = await api<{ available: boolean }[]>(
          "availability",
          "POST",
          { items: [{ variantId: id, quantity }] },
        );
        if (!result?.available) {
          notify("Requested quantity unavailable.");
          return;
        }
      } catch (e) {
        notify(e instanceof Error ? e.message : "Could not check availability");
        return;
      }
    }
    if (quantityVersions.current[id] !== version) return;
    setCart((current) => {
      const next = { ...current };
      if (quantity) next[id] = quantity;
      else delete next[id];
      return next;
    });
  };
  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        settings,
        cart,
        hydrated,
        error,
        loading,
        storeInfo: settings,
        storageAvailable,
        notify,
        refresh,
        setQuantity,
        categoryName: (id) => categories.find((c) => c.id === id)?.name ?? id,
        saveProduct: async (product) => {
          await api("admin/products", "POST", product);
          await refresh();
          notify("Product saved");
        },
        deleteProduct: async (id) => {
          try {
            await api(`admin/products/${id}`, "DELETE");
            await refresh();
            notify("Product archived");
          } catch (e) {
            notify(
              e instanceof Error ? e.message : "Could not archive product",
            );
          }
        },
        clearCart: () => setCart({}),
      }}
    >
      {children}
      <div
        className={`toast ${toast ? "toast-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <span className="toast-check">
              <Check size={16} />
            </span>
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </StoreContext.Provider>
  );
}
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
