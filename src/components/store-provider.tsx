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
import {
  categories as seedCategories,
  type Category,
  type Product,
} from "@/lib/products";
import { api } from "@/lib/api";

type Cart = Record<string, number>;
type StoreInfo = {
  name: string;
  contact: string;
  location: string;
  hours: string;
};
type StoreContextType = {
  products: Product[];
  categories: Category[];
  cart: Cart;
  storeInfo: StoreInfo;
  hydrated: boolean;
  loading: boolean;
  error: string;
  storageAvailable: boolean;
  setQuantity: (id: string, quantity: number) => void;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  clearCart: () => void;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};
const StoreContext = createContext<StoreContextType | null>(null);
const STORAGE_KEY = "dukan-phase2-bag";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const admin = usePathname().startsWith("/admin");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState(seedCategories);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    name: "dukan",
    contact: "",
    location: "",
    hours: "",
  });
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [toast, setToast] = useState("");
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await api<{
        products: Product[];
        categories: Category[];
        store?: StoreInfo;
      }>(admin ? "/api/admin/products" : "/api/catalogue");
      if (id !== requestId.current) return;
      setProducts(data.products);
      setCategories(data.categories);
      if (data.store) setStoreInfo(data.store);
      if (!admin)
        setCart((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) =>
              data.products.some((p) => p.id === id && p.available),
            ),
          ),
        );
    } catch (e) {
      if (id === requestId.current) {
        setError((e as Error).message);
        setProducts([]);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [admin]);
  // Synchronize remote data when switching between public and admin routes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const restored: Cart = {};
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved && typeof saved === "object")
        for (const [id, q] of Object.entries(saved).slice(0, 500))
          if (
            /^[a-zA-Z0-9-]+$/.test(id) &&
            Number.isInteger(q) &&
            Number(q) > 0
          )
            restored[id] = Math.min(99, Number(q));
    } catch {
      /* Browser persistence is optional. */
    }
    // Browser storage can only be restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(restored);
    setHydrated(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    // Report the external storage write outcome to the bag UI.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [cart, hydrated]);
  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        cart,
        storeInfo,
        hydrated,
        loading,
        error,
        storageAvailable,
        refresh,
        notify,
        setQuantity: (id, value) => {
          if (!products.some((p) => p.id === id && p.available) && value !== 0)
            return;
          setCart((current) => {
            const next = { ...current };
            const q = Math.min(99, Math.max(0, Math.floor(value)));
            if (q) next[id] = q;
            else delete next[id];
            return next;
          });
        },
        saveProduct: async (product) => {
          await api("/api/admin/products", {
            method: "POST",
            body: JSON.stringify(product),
          });
          await refresh();
          notify("Product saved. Stock is managed separately in Inventory.");
        },
        deleteProduct: async (id) => {
          await api(`/api/admin/products/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          await refresh();
          notify("Product archived. Existing order records are preserved.");
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
