"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { ProductImage } from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { Modal } from "@/components/ui/modal";
import {
  categories,
  categoryName,
  formatPrice,
  type Product,
} from "@/lib/products";
import { useProductEditor } from "./admin-shell";

export function Products() {
  const { products, deleteProduct } = useStore();
  const edit = useProductEditor();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const [category, setCategory] = useState(
    categories.some((c) => c.id === initialCategory) ? initialCategory : "all",
  );
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const filtered = useMemo(() => {
    const result = products.filter(
      (p) =>
        `${p.name} ${p.hindiName}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (category === "all" || p.category === category) &&
        (availability === "all" ||
          (availability === "available" ? p.available : !p.available)),
    );
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, query, category, availability, sort]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const hasFilters = query || category !== "all" || availability !== "all";
  const reset = () => {
    setQuery("");
    setCategory("all");
    setAvailability("all");
    setPage(1);
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">
            A PLACE FOR EVERY ESSENTIAL
          </span>
          <h1>
            Your products<span>.</span>
          </h1>
          <p>Keep the good things on your shelves looking their best.</p>
        </div>
        <button className="button button-primary" onClick={() => edit("new")}>
          <Plus size={17} /> Add product
        </button>
      </div>
      <div className="product-page-summary">
        <span>
          <Package size={17} />
          <strong>{products.length}</strong> total products
        </span>
        <span>
          <span className="status-dot" />
          <strong>{products.filter((p) => p.available).length}</strong>{" "}
          available
        </span>
        <span>
          <span className="status-dot dot-grey" />
          <strong>{products.filter((p) => !p.available).length}</strong>{" "}
          unavailable
        </span>
      </div>
      <section className="admin-panel products-panel">
        <div className="products-panel-heading">
          <div>
            <h2>
              Product catalogue{" "}
              <span className="result-number">{products.length}</span>
            </h2>
            <p>Your local demo products, all in one place.</p>
          </div>
          <span className="local-data-label">
            <span className="status-dot" /> LOCAL DEMO
          </span>
        </div>
        <div className="admin-table-toolbar">
          <div className="table-search">
            <Search size={17} />
            <input
              placeholder="Find a product…"
              aria-label="Search admin products"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                className="icon-button"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                aria-label="Clear product search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="table-filters">
            <label className="filter-select">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Filter admin products by category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label className="filter-select">
              <select
                aria-label="Filter by availability"
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </div>
        {hasFilters && (
          <div className="active-filter-note">
            <span>
              {filtered.length} matching{" "}
              {filtered.length === 1 ? "product" : "products"}
            </span>
            <button onClick={reset}>
              Clear filters <X size={12} />
            </button>
          </div>
        )}
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th scope="col">
                  <button
                    onClick={() => {
                      setSort(sort === "name" ? "default" : "name");
                      setPage(1);
                    }}
                  >
                    Product <ArrowDown size={12} />
                  </button>
                </th>
                <th scope="col">Category</th>
                <th scope="col">Pack size</th>
                <th scope="col">
                  <button
                    onClick={() => {
                      setSort(
                        sort === "price-asc" ? "price-desc" : "price-asc",
                      );
                      setPage(1);
                    }}
                  >
                    Price / bag <ArrowDown size={12} />
                  </button>
                </th>
                <th scope="col">Availability</th>
                <th scope="col" className="actions-column">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="table-product" onClick={() => edit(p)}>
                      <span className={`admin-product-thumb tone-${p.tone}`}>
                        <ProductImage product={p} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small lang="hi">
                          {p.hindiName || "No Hindi name"}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="table-category">
                      {categoryName(p.category)}
                    </span>
                  </td>
                  <td>
                    <span className="pack-size">
                      {p.weight} {p.unit}
                    </span>
                  </td>
                  <td className="table-price">{formatPrice(p.price)}</td>
                  <td>
                    <span
                      className={`availability-badge ${p.available ? "is-available" : "is-unavailable"}`}
                    >
                      <span className="status-dot" />
                      {p.available ? "Available" : "Unavailable"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${p.name}`}
                        onClick={() => edit(p)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button delete-button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-products-list">
          <label className="mobile-product-sort">
            Sort products
            <select
              aria-label="Sort admin products"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="default">Recommended</option>
              <option value="name">Name: A to Z</option>
              <option value="price-asc">Price: Low to high</option>
              <option value="price-desc">Price: High to low</option>
            </select>
          </label>
          {rows.map((p) => (
            <article className="mobile-admin-product" key={p.id}>
              <div className="mobile-admin-product-top">
                <span className={`admin-product-thumb tone-${p.tone}`}>
                  <ProductImage product={p} />
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <p lang="hi">{p.hindiName}</p>
                  <span>
                    {categoryName(p.category)} · {p.weight} {p.unit} / bag
                  </span>
                </div>
              </div>
              <div className="mobile-admin-product-meta">
                <strong>{formatPrice(p.price)}</strong>
                <span
                  className={`availability-badge ${p.available ? "is-available" : "is-unavailable"}`}
                >
                  <span className="status-dot" />
                  {p.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <div className="mobile-admin-product-actions">
                <button aria-label={`Edit ${p.name}`} onClick={() => edit(p)}>
                  <Pencil size={16} /> Edit product
                </button>
                <button
                  className="mobile-delete-product"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
        {!rows.length && (
          <div className="table-empty">
            <span className="empty-icon">
              <Package size={30} strokeWidth={1.4} />
            </span>
            <h3>
              {hasFilters
                ? "Nothing on this shelf just yet."
                : "Your catalogue starts with one good thing."}
            </h3>
            <p>
              {hasFilters
                ? "Try a different search or clear your filters."
                : "Add your first product to bring your storefront to life."}
            </p>
            <button
              className="button button-primary"
              onClick={hasFilters ? reset : () => edit("new")}
            >
              {hasFilters ? "Clear filters" : "Add a product"}
              <Plus size={16} />
            </button>
          </div>
        )}
        <div className="table-pagination">
          <span>
            {filtered.length
              ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} products`
              : "No products to show"}
          </span>
          <div>
            <button
              aria-label="Previous product page"
              className="icon-button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <button
              aria-label="Next product page"
              className="icon-button"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <div className="admin-product-hint">
        <CircleHelp size={18} />
        <div>
          <strong>Your catalogue, your way.</strong>
          <p>
            Click any product to edit its details. Changes appear in the
            storefront and stay in this browser.
          </p>
        </div>
      </div>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Remove this essential?"
        description="This changes your local demo catalogue only."
        className="confirm-dialog"
      >
        <div className="confirm-body">
          <div className="delete-confirm-icon">
            <Trash2 size={25} />
          </div>
          <p>
            <strong>{deleting?.name}</strong> will be removed from the catalogue
            and from any demo bag that contains it.
          </p>
          <p className="small muted">
            You can add it again, or restore the original catalogue in Settings.
          </p>
        </div>
        <div className="confirm-actions">
          <button
            className="button button-secondary"
            autoFocus
            onClick={() => setDeleting(null)}
          >
            Keep product
          </button>
          <button
            className="button button-danger"
            onClick={() => {
              if (deleting) deleteProduct(deleting.id);
              setDeleting(null);
            }}
          >
            Delete product
          </button>
        </div>
      </Modal>
    </>
  );
}
