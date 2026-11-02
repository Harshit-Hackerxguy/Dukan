"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Layers3,
  Package,
  PackageCheck,
  Plus,
  ShoppingBag,
  Sprout,
  Tags,
} from "lucide-react";
import { useStore } from "@/components/store-provider";
import { ProductImage } from "@/components/product-art";
import { categories, categoryName, formatPrice } from "@/lib/products";
import { useProductEditor } from "./admin-shell";

export function Dashboard() {
  const { products } = useStore();
  const edit = useProductEditor();
  const available = products.filter((p) => p.available).length;
  const unavailable = products.length - available;
  const metrics = [
    {
      title: "Total products",
      value: products.length,
      subtitle: "Essentials in your catalogue",
      icon: Package,
      tone: "green",
    },
    {
      title: "Categories",
      value: categories.length,
      subtitle: "Thoughtfully organised",
      icon: Layers3,
      tone: "ochre",
    },
    {
      title: "Available products",
      value: available,
      subtitle: "Ready to add to a demo bag",
      icon: PackageCheck,
      tone: "green",
    },
    {
      title: "Unavailable",
      value: unavailable,
      subtitle: unavailable
        ? "Not currently available"
        : "Everything is looking good",
      icon: ClipboardList,
      tone: "blue",
    },
  ];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">YOUR STORE, AT A GLANCE</span>
          <h1>
            A good day to grow<span>.</span>
          </h1>
          <p>Here’s a little overview of your everyday essentials.</p>
        </div>
        <button className="button button-primary" onClick={() => edit("new")}>
          <Plus size={17} /> Add product
        </button>
      </div>
      <div className="admin-welcome">
        <div>
          <span className="welcome-icon">
            <Sprout size={25} strokeWidth={1.5} />
          </span>
          <div>
            <h2>Small store. Big possibilities.</h2>
            <p>
              Your catalogue is the heart of your store. Let’s keep it looking
              its best.
            </p>
          </div>
        </div>
        <Link href="/">
          View storefront <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.title}>
            <div>
              <span>{metric.title}</span>
              <span className={`metric-icon metric-${metric.tone}`}>
                <metric.icon size={19} strokeWidth={1.7} />
              </span>
            </div>
            <strong>{metric.value.toString().padStart(2, "0")}</strong>
            <p>{metric.subtitle}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="admin-panel catalogue-overview">
          <div className="panel-heading">
            <div>
              <h2>Your catalogue</h2>
              <p>A quick look at what’s on the shelf.</p>
            </div>
            <Link href="/admin/products">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="dashboard-product-list">
            {products.slice(0, 5).map((p) => (
              <button
                className="dashboard-product"
                key={p.id}
                onClick={() => edit(p)}
              >
                <span className={`admin-product-thumb tone-${p.tone}`}>
                  <ProductImage product={p} />
                </span>
                <span className="dashboard-product-name">
                  <strong>{p.name}</strong>
                  <small>
                    {categoryName(p.category)} <i>·</i> {p.weight} {p.unit}
                  </small>
                </span>
                <span className="dashboard-product-price">
                  {formatPrice(p.price)}
                </span>
                <span
                  className={`availability-badge ${p.available ? "is-available" : "is-unavailable"}`}
                >
                  <span className="status-dot" />
                  {p.available ? "Available" : "Unavailable"}
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {!products.length && (
              <div className="panel-empty">
                <Package size={29} />
                <p>Your first essential starts here.</p>
                <button className="text-button" onClick={() => edit("new")}>
                  Add a product <Plus size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="panel-bottom">
            <Package size={15} />
            <span>{products.length} products in your demo catalogue</span>
            <span className="local-data-label">LOCAL DATA</span>
          </div>
        </section>
        <div className="dashboard-right">
          <section className="admin-panel quick-actions">
            <div className="panel-heading">
              <div>
                <h2>A little head start</h2>
                <p>Your everyday shortcuts.</p>
              </div>
            </div>
            <button onClick={() => edit("new")}>
              <span className="quick-action-icon">
                <Plus size={20} />
              </span>
              <span>
                <strong>Add a new product</strong>
                <small>Make room for something good</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <Link href="/admin/categories">
              <span className="quick-action-icon amber-icon">
                <Tags size={19} />
              </span>
              <span>
                <strong>Explore categories</strong>
                <small>A place for every essential</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/">
              <span className="quick-action-icon blue-icon">
                <ExternalLink size={18} />
              </span>
              <span>
                <strong>Visit your storefront</strong>
                <small>See it through a customer’s eyes</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="availability-panel">
            <div>
              <h3>On your shelves</h3>
              <span className="mini-check">
                <Check size={12} />
              </span>
            </div>
            <div className="availability-stats">
              <strong>
                {available}
                <small> / {products.length}</small>
              </strong>
              <span>products available</span>
            </div>
            <div className="availability-track">
              <span
                style={{
                  width: `${products.length ? (available / products.length) * 100 : 0}%`,
                }}
              />
            </div>
            <p>
              {unavailable
                ? `${unavailable} ${unavailable === 1 ? "product is" : "products are"} marked unavailable.`
                : products.length
                  ? "All your essentials are available in the demo."
                  : "Add a product to start your catalogue."}
            </p>
          </section>
        </div>
      </div>
      <section className="admin-panel future-orders">
        <div className="future-orders-icon">
          <ShoppingBag size={31} strokeWidth={1.4} />
        </div>
        <div>
          <span className="coming-soon">THE NEXT CHAPTER</span>
          <h2>Good things are on the way.</h2>
          <p>
            This space is reserved for future order insights. No orders or sales
            are being tracked in this demo.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin/orders">
          What’s coming <ArrowRight size={16} />
        </Link>
      </section>
      <div className="admin-inline-note">
        <span className="status-dot" /> These numbers come from your local demo
        catalogue. No live sales or inventory data.
      </div>
    </>
  );
}
