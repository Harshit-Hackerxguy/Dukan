"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Grid2X2,
  Leaf,
  Menu,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sprout,
  Tag,
  Wheat,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import {
  HeroArt,
  ProductImage,
  ProductIllustration,
} from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { Modal } from "@/components/ui/modal";
import {
  categories,
  categoryName,
  formatPrice,
  formatUnitPrice,
  type Product,
} from "@/lib/products";
import { storeConfig } from "@/lib/store-config";
import { Cart, QuantityControl } from "./cart";
import { ProductCard } from "./product-card";

type Sort = "featured" | "price-asc" | "price-desc" | "name";

export function Storefront() {
  const { products, cart, setQuantity, notify } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);
  const selected = products.find((p) => p.id === detailId);
  const count = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  const cartTotal = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0,
  );
  const filtered = useMemo(() => {
    const result = products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!inStock || p.available) &&
        `${p.name} ${p.hindiName} ${categoryName(p.category)} ${p.weight} ${p.unit}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, category, query, sort, inStock]);
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setSort("featured");
    setInStock(false);
    setLimit(12);
  };
  const selectCategory = (value: string) => {
    setCategory(value);
    setLimit(12);
  };
  const openBag = () => {
    notify("");
    setCartOpen(true);
  };

  return (
    <div
      className={`storefront ${count ? "storefront-has-bag" : ""} ${query.trim() ? "storefront-searching" : ""}`}
    >
      <a className="skip-link" href="#catalogue">
        Skip to products
      </a>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>
            <Package size={14} /> Everyday essentials. Wholesale value.
          </span>
          <span className="announcement-demo">
            <span className="status-dot" /> Phase 1 preview <i /> Demo prices
          </span>
        </div>
      </div>
      <header className="store-header">
        <div className="container header-main">
          <Brand />
          <form
            className="header-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              event.currentTarget.querySelector("input")?.blur();
              document
                .getElementById("catalogue")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Search size={19} />
            <input
              aria-label="Search products"
              placeholder="Search rice, sugar, potatoes…"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(12);
              }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={17} />
              </button>
            ) : (
              <kbd>↵</kbd>
            )}
          </form>
          <a className="header-help" href="#about">
            <CircleHelp size={19} />
            <span>
              A simpler way
              <br />
              <strong>to stock up</strong>
            </span>
          </a>
          <button
            className="header-cart"
            onClick={openBag}
            aria-label={`Open bag, ${count} ${count === 1 ? "item" : "items"}`}
          >
            <span className="bag-icon">
              <ShoppingBag size={21} />
              <b>{count}</b>
            </span>
            <span>
              My bag
              <strong>
                {count ? formatPrice(cartTotal) : "Your essentials"}
              </strong>
            </span>
          </button>
          <button
            className="mobile-menu-button icon-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={23} />
          </button>
        </div>
        <div className="header-nav">
          <nav className="container nav-inner" aria-label="Main navigation">
            <a href="#catalogue" className="nav-all" onClick={resetFilters}>
              <Grid2X2 size={16} /> Shop all products <ChevronDown size={14} />
            </a>
            <div className="nav-categories">
              {categories.map((c) => (
                <a
                  href="#catalogue"
                  key={c.id}
                  onClick={() => selectCategory(c.id)}
                >
                  {c.name}
                </a>
              ))}
            </div>
            <a href="#about" className="nav-about">
              A little about us <ArrowUpRight size={14} />
            </a>
          </nav>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="tiny-line" /> GOOD THINGS COME IN BULK
              </span>
              <h1>
                Your essentials.
                <br />
                <span>Better in bulk.</span>
              </h1>
              <p>
                Stock up on the things that bring your kitchen to life.
                <br className="desktop-break" /> Everyday staples, generous
                packs, simple choices.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#catalogue">
                  Shop essentials <ArrowRight size={18} />
                </a>
                <span className="hero-footnote">
                  <span className="mini-check">
                    <Check size={12} />
                  </span>{" "}
                  Big bags. Little effort.
                </span>
              </div>
            </div>
            <HeroArt />
          </div>
          <div className="hero-bottom-line" />
        </section>
        <section className="trust-bar container" aria-label="Store highlights">
          <div>
            <PackageCheck size={21} />
            <span>
              <strong>Made for stocking up</strong>
              <small>Practical 30 kg & 50 kg packs</small>
            </span>
          </div>
          <div>
            <Wheat size={21} />
            <span>
              <strong>Everyday kitchen essentials</strong>
              <small>The staples you come back to</small>
            </span>
          </div>
          <div>
            <Tag size={21} />
            <span>
              <strong>Clear, simple pricing</strong>
              <small>Per-bag and per-unit prices</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={21} />
            <span>
              <strong>Browse at your own pace</strong>
              <small>A simple, no-pressure catalogue</small>
            </span>
          </div>
        </section>
        <section className="catalogue container" id="catalogue">
          <div className="section-heading">
            <div>
              <span className="eyebrow muted-eyebrow">
                THE WELL-STOCKED KITCHEN STARTS HERE
              </span>
              <h2>
                Everyday essentials<span>.</span>
              </h2>
              <p>Good staples. Generous quantities. All in one place.</p>
            </div>
            <span className="catalogue-count">
              <span className="status-dot" /> {products.length} products to
              explore
            </span>
          </div>
          <div className="category-grid">
            <button
              className={`category-tile category-all ${category === "all" ? "category-active" : ""}`}
              onClick={() => selectCategory("all")}
              aria-pressed={category === "all"}
            >
              <span className="category-icon">
                <Grid2X2 size={25} strokeWidth={1.4} />
              </span>
              <span>
                <strong>All essentials</strong>
                <small>{products.length} products</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            {categories.map((c) => {
              const productCount = products.filter(
                (p) => p.category === c.id,
              ).length;
              return (
                <button
                  key={c.id}
                  className={`category-tile ${category === c.id ? "category-active" : ""}`}
                  onClick={() => selectCategory(c.id)}
                  aria-pressed={category === c.id}
                >
                  <span className="category-mini-art">
                    <ProductIllustration
                      kind={c.illustration}
                      tone={c.id === "essentials" ? "cream" : "green"}
                    />
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {productCount}{" "}
                      {productCount === 1 ? "product" : "products"}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
          <div className="catalogue-toolbar">
            <div className="results-label">
              <SlidersHorizontal size={16} />
              <span>
                {query ? (
                  <>
                    Results for <strong>“{query}”</strong>
                  </>
                ) : category === "all" ? (
                  "All products"
                ) : (
                  categoryName(category as Product["category"])
                )}{" "}
                <span className="result-number">{filtered.length}</span>
              </span>
            </div>
            <div className="toolbar-controls">
              <label className="stock-toggle">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                />
                <span>In stock only</span>
              </label>
              <span className="toolbar-divider" />
              <label className="sort-control">
                <span>Sort by:</span>
                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="featured">Recommended</option>
                  <option value="price-asc">Price: Low to high</option>
                  <option value="price-desc">Price: High to low</option>
                  <option value="name">Name: A to Z</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>
          {filtered.length ? (
            <div className="product-grid">
              {filtered.slice(0, limit).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onDetails={(p) => setDetailId(p.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <span className="empty-icon">
                <Search size={31} strokeWidth={1.4} />
              </span>
              <h3>No essentials found just yet.</h3>
              <p>Try a different search or explore another category.</p>
              <button className="button button-primary" onClick={resetFilters}>
                View all products <ArrowRight size={17} />
              </button>
            </div>
          )}
          {filtered.length > limit && (
            <div className="load-more">
              <button
                className="button button-secondary"
                onClick={() => setLimit((n) => n + 12)}
              >
                Show more products <ArrowDown size={16} />
              </button>
              <small>
                Showing {Math.min(limit, filtered.length)} of {filtered.length}{" "}
                products
              </small>
            </div>
          )}
          <div className="catalogue-end">
            <span />
            <Wheat size={18} />
            <p>
              {filtered.length
                ? "Good things, by the bag."
                : "There’s always something good to discover."}
            </p>
            <span />
          </div>
          <div className="price-note">
            <span className="preview-label">A LITTLE HEADS-UP</span>
            <p>
              This is our demo catalogue. All prices, availability, and
              packaging are for preview purposes.
            </p>
          </div>
        </section>
        <section className="about-section" id="about">
          <div className="container about-inner">
            <div className="about-intro">
              <span className="eyebrow">A LITTLE MORE EVERYDAY GOODNESS</span>
              <h2>
                A full pantry.
                <br />A simpler day.
              </h2>
              <p>
                Whether you’re stocking a family kitchen or planning for a
                bigger table, finding the basics should feel easy.
              </p>
              <span className="about-signature">
                <Leaf size={18} /> Your neighbourhood wholesale store
              </span>
            </div>
            <div className="about-features">
              <article>
                <span>01</span>
                <div>
                  <h3>Essentials, thoughtfully organised.</h3>
                  <p>
                    Find your rice, sugar, and produce without the endless
                    scrolling.
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Know exactly what’s in your bag.</h3>
                  <p>
                    Clear pack sizes and simple price comparisons make planning
                    easier.
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>A little local. A lot of possibility.</h3>
                  <p>
                    This is just the beginning. More products and ways to shop
                    are on the way.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
      <footer className="store-footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <Brand />
            <p>
              Everyday essentials.
              <br />
              Wholesale, made simple.
            </p>
            <span className="footer-demo">
              Temporary branding · Phase 1 demo
            </span>
          </div>
          <div>
            <h3>Explore the store</h3>
            <a href="#catalogue" onClick={resetFilters}>
              All products
            </a>
            {categories.map((c) => (
              <a
                href="#catalogue"
                key={c.id}
                onClick={() => selectCategory(c.id)}
              >
                {c.name}
              </a>
            ))}
          </div>
          <div>
            <h3>Come say hello</h3>
            <p>{storeConfig.location}</p>
            <p>{storeConfig.contact}</p>
            <span className="footer-hours">
              <Clock3 size={14} />
              {storeConfig.hours}
            </span>
          </div>
          <div className="footer-note">
            <span>
              <Sprout size={22} />
            </span>
            <h3>Growing something good.</h3>
            <p>
              Our online store is taking shape.
              <br />
              For now, explore and make yourself at home.
            </p>
            <Link href="/admin">
              Explore the admin demo <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {storeConfig.name}. A wholesale store
            UI preview.
          </span>
          <span>
            Made for the everyday. <Leaf size={13} />
          </span>
        </div>
      </footer>
      {count > 0 && (
        <div className="mobile-bag-bar">
          <button
            aria-label={`View bag, ${count} ${count === 1 ? "bag" : "bags"}, ${formatPrice(cartTotal)}`}
            onClick={openBag}
          >
            <span className="mobile-bag-symbol">
              <ShoppingBag size={21} />
              <b>{count}</b>
            </span>
            <span className="mobile-bag-summary">
              <strong>
                {count} {count === 1 ? "bag" : "bags"} <i>·</i>{" "}
                {formatPrice(cartTotal)}
              </strong>
              <small>Your everyday essentials</small>
            </span>
            <span className="mobile-bag-action">
              View bag <ArrowRight size={17} />
            </span>
          </button>
        </div>
      )}
      <Cart open={cartOpen} onOpenChange={setCartOpen} />
      <Modal
        open={mobileMenu}
        onOpenChange={setMobileMenu}
        title="Explore the store"
        className="mobile-nav-dialog"
      >
        <nav aria-label="Mobile navigation">
          <a
            href="#catalogue"
            onClick={() => {
              resetFilters();
              setMobileMenu(false);
            }}
          >
            All products <ArrowRight size={17} />
          </a>
          {categories.map((c) => (
            <a
              href="#catalogue"
              key={c.id}
              onClick={() => {
                selectCategory(c.id);
                setMobileMenu(false);
              }}
            >
              {c.name} <ArrowRight size={17} />
            </a>
          ))}
          <a href="#about" onClick={() => setMobileMenu(false)}>
            About the store <ArrowRight size={17} />
          </a>
          <Link href="/admin">
            Admin demo <ArrowUpRight size={17} />
          </Link>
        </nav>
        <p className="muted small">
          Phase 1 preview · Demo catalogue and prices
        </p>
      </Modal>
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={selected?.name || "Product details"}
        description="A closer look at your everyday essentials"
        className="product-detail-dialog"
      >
        {selected && (
          <div className="product-detail">
            <div className={`detail-visual tone-${selected.tone}`}>
              <ProductImage product={selected} />
            </div>
            <div className="detail-info">
              <span className="eyebrow">{categoryName(selected.category)}</span>
              <p className="detail-hindi" lang="hi">
                {selected.hindiName}
              </p>
              <p>{selected.description}</p>
              <div className="detail-specs">
                <span>
                  <Package size={17} />
                  {selected.weight} {selected.unit} / bag
                </span>
                <span
                  className={selected.available ? "available-text" : "muted"}
                >
                  <span className="status-dot" />
                  {selected.available
                    ? "Available in demo"
                    : "Currently unavailable"}
                </span>
              </div>
              <div className="detail-price">
                <strong>{formatPrice(selected.price)}</strong>
                <span>
                  {formatUnitPrice(selected.price / selected.weight)} /{" "}
                  {selected.unit}
                </span>
              </div>
              {selected.available ? (
                cart[selected.id] ? (
                  <QuantityControl
                    id={selected.id}
                    name={selected.name}
                    quantity={cart[selected.id]}
                  />
                ) : (
                  <button
                    className="button button-primary"
                    onClick={() => {
                      setQuantity(selected.id, 1);
                      notify(`${selected.name} added to your bag`);
                    }}
                  >
                    Add to bag <ShoppingBag size={17} />
                  </button>
                )
              ) : (
                <button className="button button-secondary" disabled>
                  Currently unavailable
                </button>
              )}
              <small className="detail-disclaimer">
                Demo price. No orders or payments are collected.
              </small>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
