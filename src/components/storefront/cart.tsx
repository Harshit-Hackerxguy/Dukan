"use client";

import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Checkout } from "./checkout";
import { useStore } from "@/components/store-provider";
import { ProductImage } from "@/components/product-art";
import { Modal } from "@/components/ui/modal";
import { formatPrice } from "@/lib/products";

export function QuantityControl({
  id,
  name,
  quantity,
  compact = false,
}: {
  id: string;
  name: string;
  quantity: number;
  compact?: boolean;
}) {
  const { setQuantity } = useStore();
  return (
    <div
      className={`quantity-control ${compact ? "quantity-compact" : ""}`}
      aria-label={`Quantity for ${name}`}
    >
      <button
        aria-label={`Decrease ${name} quantity`}
        onClick={() => setQuantity(id, quantity - 1)}
      >
        <Minus size={15} />
      </button>
      <span aria-live="polite" aria-atomic="true">
        {quantity}
      </span>
      <button
        aria-label={`Increase ${name} quantity`}
        disabled={quantity >= 99}
        onClick={() => setQuantity(id, quantity + 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function Cart({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { products, cart, setQuantity, clearCart, notify, storageAvailable } =
    useStore();
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = products.filter((p) => cart[p.id]);
  const count = items.reduce((sum, p) => sum + cart[p.id], 0);
  const total = items.reduce((sum, p) => sum + p.price * cart[p.id], 0);
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
          if (!value) setCheckout(false);
        }
      }}
      title={checkout ? "Your order request" : "Your bag"}
      description={`${count} ${count === 1 ? "bag" : "bags"} of everyday goodness`}
      className="cart-dialog"
    >
      {checkout ? (
        <Checkout
          onBusy={setBusy}
          onBack={() => {
            setCheckout(false);
            if (!items.length) onOpenChange(false);
          }}
        />
      ) : items.length ? (
        <>
          <div className="cart-note">
            <ShoppingBag size={16} />
            <span>Wholesale essentials, ready for your request.</span>
          </div>
          <div className="cart-items">
            {items.map((p) => (
              <article className="cart-item" key={p.id}>
                <div className={`cart-item-image tone-${p.tone}`}>
                  <ProductImage product={p} />
                </div>
                <div className="cart-item-info">
                  <h3>{p.name}</h3>
                  <p>
                    {p.weight} {p.unit} / bag · {formatPrice(p.price)} each
                  </p>
                  <QuantityControl
                    id={p.id}
                    name={p.name}
                    quantity={cart[p.id]}
                    compact
                  />
                </div>
                <div className="cart-item-right">
                  <strong>{formatPrice(p.price * cart[p.id])}</strong>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${p.name} from bag`}
                    onClick={() => setQuantity(p.id, 0)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            <button
              className="text-button muted"
              onClick={() => {
                clearCart();
                notify("Your bag has been cleared");
              }}
            >
              <Trash2 size={14} /> Clear bag
            </button>
          </div>
          <div className="cart-summary">
            {!storageAvailable && (
              <p className="storage-notice" role="status">
                Browser storage is unavailable or full. Your bag will last for
                this visit only.
              </p>
            )}
            <div className="summary-line">
              <span>
                Grand total{" "}
                <small>
                  ({count} {count === 1 ? "bag" : "bags"})
                </small>
              </span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p>Shipping charges may vary and will be confirmed by the store.</p>
            <button
              className="button button-primary full-width"
              onClick={() => setCheckout(true)}
            >
              Submit Order <ArrowRight size={17} />
            </button>
          </div>
        </>
      ) : (
        <div className="empty-cart">
          <div className="empty-icon">
            <ShoppingBag size={39} strokeWidth={1.3} />
          </div>
          <span className="eyebrow">ROOM FOR GOOD THINGS</span>
          <h3>Your bag is feeling a little light.</h3>
          <p>
            Find your everyday essentials and add a bag or two to get started.
          </p>
          <button
            className="button button-primary"
            onClick={() => {
              onOpenChange(false);
              document
                .getElementById("catalogue")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <ArrowLeft size={17} /> Explore products
          </button>
        </div>
      )}
    </Modal>
  );
}
