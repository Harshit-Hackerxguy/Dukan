"use client";

import Link from "next/link";
import { ArrowRight, FolderHeart, Info } from "lucide-react";
import { ProductIllustration } from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { categories } from "@/lib/products";

export function Categories() {
  const { products } = useStore();
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">
            A LITTLE ORGANISATION GOES A LONG WAY
          </span>
          <h1>
            Good things, grouped<span>.</span>
          </h1>
          <p>A home for every essential in your catalogue.</p>
        </div>
        <span className="category-total">
          <FolderHeart size={18} />
          {categories.length} categories
        </span>
      </div>
      <div className="admin-category-grid">
        {categories.map((c, i) => {
          const items = products.filter((p) => p.category === c.id);
          return (
            <article className="admin-category-card" key={c.id}>
              <div className={`admin-category-art category-art-${i}`}>
                <ProductIllustration
                  kind={c.illustration}
                  tone={i === 1 ? "cream" : "green"}
                />
                <span className="category-index">0{i + 1}</span>
              </div>
              <div className="admin-category-body">
                <h2>{c.name}</h2>
                <p>{c.description}</p>
                <div className="category-card-counts">
                  <span>
                    <strong>{items.length}</strong> products
                  </span>
                  <span>
                    <span className="status-dot" />
                    {items.filter((p) => p.available).length} available
                  </span>
                </div>
                <Link href={`/admin/products?category=${c.id}`}>
                  Explore products <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="admin-info-box">
        <Info size={20} />
        <div>
          <h3>Thoughtfully simple, for now.</h3>
          <p>
            These three demo categories keep your catalogue organised. Assign
            products to a category in the product editor. Creating and editing
            categories will be part of a future phase.
          </p>
        </div>
      </div>
    </>
  );
}
