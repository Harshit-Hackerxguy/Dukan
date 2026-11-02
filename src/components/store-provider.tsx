"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { Check, X } from "lucide-react";
import { initialProducts, type Product } from "@/lib/products";

type Cart = Record<string, number>;
type State = { products: Product[]; cart: Cart; hydrated: boolean };
type Action =
  | { type: "hydrate"; products: Product[]; cart: Cart }
  | { type: "quantity"; id: string; quantity: number }
  | { type: "save"; product: Product }
  | { type: "delete"; id: string }
  | { type: "clear" }
  | { type: "reset" };
const STORAGE_KEY = "dukan-phase1-v1";
const initialState: State = {
  products: initialProducts,
  cart: {},
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { products: action.products, cart: action.cart, hydrated: true };
    case "quantity": {
      if (!state.products.some((p) => p.id === action.id && p.available))
        return state;
      const cart = { ...state.cart };
      const quantity = Math.min(99, Math.max(0, Math.floor(action.quantity)));
      if (quantity) cart[action.id] = quantity;
      else delete cart[action.id];
      return { ...state, cart };
    }
    case "save": {
      const exists = state.products.some((p) => p.id === action.product.id);
      const cart = { ...state.cart };
      if (!action.product.available) delete cart[action.product.id];
      return {
        ...state,
        cart,
        products: exists
          ? state.products.map((p) =>
              p.id === action.product.id ? action.product : p,
            )
          : [...state.products, action.product],
      };
    }
    case "delete": {
      const cart = { ...state.cart };
      delete cart[action.id];
      return {
        ...state,
        cart,
        products: state.products.filter((p) => p.id !== action.id),
      };
    }
    case "clear":
      return { ...state, cart: {} };
    case "reset":
      return { products: initialProducts, cart: {}, hydrated: true };
  }
}

function validProducts(value: unknown): value is Product[] {
  return (
    Array.isArray(value) &&
    value.length <= 5000 &&
    value.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.hindiName === "string" &&
        ["rice", "essentials", "produce"].includes(p.category) &&
        ["rice", "sugar", "potatoes"].includes(p.illustration) &&
        ["green", "ochre", "plum", "blue", "cream"].includes(p.tone) &&
        ["kg", "g", "L"].includes(p.unit) &&
        Number.isFinite(p.price) &&
        p.price >= 0 &&
        Number.isFinite(p.weight) &&
        p.weight > 0 &&
        typeof p.image === "string" &&
        typeof p.description === "string" &&
        typeof p.available === "boolean",
    ) &&
    new Set(value.map((p) => p.id)).size === value.length
  );
}

type StoreContextType = State & {
  storageAvailable: boolean;
  setQuantity: (id: string, quantity: number) => void;
  saveProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  clearCart: () => void;
  resetDemo: () => void;
  notify: (message: string) => void;
};
const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toast, setToast] = useReducer((_: string, value: string) => value, "");
  const [storageAvailable, setStorageAvailable] = useReducer(
    (_: boolean, available: boolean) => available,
    true,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    let products = initialProducts;
    const cart: Cart = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (validProducts(saved.products)) products = saved.products;
        if (saved.cart && typeof saved.cart === "object") {
          for (const p of products) {
            const quantity = saved.cart[p.id];
            if (p.available && Number.isInteger(quantity) && quantity > 0)
              cart[p.id] = Math.min(99, quantity);
          }
        }
      }
    } catch {
      /* Storage is optional; the in-memory demo remains usable. */
    }
    dispatch({ type: "hydrate", products, cart });
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ products: state.products, cart: state.cart }),
      );
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [state]);

  return (
    <StoreContext.Provider
      value={{
        ...state,
        storageAvailable,
        setQuantity: (id, quantity) =>
          dispatch({ type: "quantity", id, quantity }),
        saveProduct: (product) => {
          dispatch({ type: "save", product });
          notify("Product saved to your demo catalogue");
        },
        deleteProduct: (id) => {
          dispatch({ type: "delete", id });
          notify("Product removed from the demo catalogue");
        },
        clearCart: () => dispatch({ type: "clear" }),
        resetDemo: () => {
          dispatch({ type: "reset" });
          notify("Demo catalogue restored");
        },
        notify,
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
