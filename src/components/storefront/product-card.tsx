"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import { ProductImage } from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { formatPrice, formatUnitPrice, type Product } from "@/lib/products";
import { QuantityControl } from "./cart";

export function ProductCard({
  product: p,
  onDetails,
}: {
  product: Product;
  onDetails: (product: Product) => void;
}) {
  const { cart, setQuantity, categoryName } = useStore();
  return (
    <article
      className={`product-card ${!p.available ? "product-unavailable" : ""}`}
    >
      <button
        className={`product-visual tone-${p.tone}`}
        onClick={() => onDetails(p)}
        aria-label={`View ${p.name} details`}
      >
        {p.badge && (
          <span
            className={`product-badge ${p.badge === "Bestseller" ? "badge-green" : ""}`}
          >
            {p.badge === "Bestseller" && <span>✦</span>} {p.badge}
          </span>
        )}
        <ProductImage product={p} className="product-art" />
        <span className="product-weight">
          {p.weight} {p.unit} bag
        </span>
        <span className="quick-view">
          <ArrowUpRight size={17} />
        </span>
      </button>
      <div className="product-info">
        <span className="product-category">{categoryName(p.category)}</span>
        <button className="product-title" onClick={() => onDetails(p)}>
          <h3>{p.name}</h3>
        </button>
        <p className="hindi-name" lang="hi">
          {p.hindiName || "\u00a0"}
        </p>
        <div className="product-bottom">
          <div className="product-price">
            <strong>{formatPrice(p.price)}</strong>
            <span>
              {formatUnitPrice(p.price / p.weight)} / {p.unit}
            </span>
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
