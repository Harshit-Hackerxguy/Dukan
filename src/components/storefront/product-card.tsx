"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import { ProductImage } from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { formatPrice, type Product } from "@/lib/products";
import { QuantityControl } from "./cart";

export function ProductCard({
  product: p,
  onDetails,
}: {
  product: Product;
  onDetails: (product: Product) => void;
}) {
  const { cart, setQuantity, notify } = useStore();
  return (
    <article
      className={`product-card ${!p.available ? "product-unavailable" : ""}`}
    >
      <button
        className={`product-visual tone-${p.tone}`}
        onClick={() => onDetails(p)}
        aria-label={`View ${p.name} details`}
      >
        <ProductImage product={p} className="product-art" />
        <span className="product-weight">
          {p.weight} {p.unit} bag
        </span>
        <span className="quick-view">
          <ArrowUpRight size={17} />
        </span>
      </button>
      <div className="product-info">
        <span
          className={`product-availability ${p.available ? "" : "unavailable"}`}
        >
          <span className="status-dot" />
          {p.available ? "Available" : "Out of stock"}
        </span>
        <button className="product-title" onClick={() => onDetails(p)}>
          <h3>{p.name}</h3>
        </button>
        <p className="hindi-name" lang="hi">
          {p.hindiName || "\u00a0"}
        </p>
        <div className="product-bottom">
          <div className="product-price">
            <strong>{formatPrice(p.price)}</strong>
            <span>/ bag</span>
          </div>
          {!p.available ? (
            <span className="sold-out-label">Out of stock</span>
          ) : cart[p.id] ? (
            <QuantityControl id={p.id} name={p.name} quantity={cart[p.id]} />
          ) : (
            <button
              className="add-button"
              aria-label={`Add ${p.name} to bag`}
              onClick={() => {
                setQuantity(p.id, 1);
                notify(`${p.name} added to your bag`);
              }}
            >
              ADD <Plus size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
