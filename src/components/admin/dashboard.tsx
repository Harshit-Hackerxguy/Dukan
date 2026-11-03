"use client";
import Link from "next/link";
import {
  Package,
  Layers3,
  ClipboardList,
  PackageX,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/components/store-provider";
import { useProductEditor } from "./admin-shell";
import { useAdminData, DataState } from "./use-admin-data";
import type { OrderSummary } from "@/server/domain";

export function Dashboard() {
  const { products, categories } = useStore();
  const orders = useAdminData<{ orders: OrderSummary[] }>("/api/admin/orders");
  const stock = useAdminData<{ products: { quantity: number }[] }>(
    "/api/admin/inventory",
  );
  const edit = useProductEditor();
  const metrics = [
    { title: "Total products", value: products.length, icon: Package },
    { title: "Product categories", value: categories.length, icon: Layers3 },
    {
      title: "Pending customer orders",
      value: orders.data?.orders.filter((o) => o.status === "pending").length,
      icon: ClipboardList,
    },
    {
      title: "Out-of-stock products",
      value: stock.data?.products.filter((p) => p.quantity === 0).length,
      icon: PackageX,
    },
  ];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">YOUR STORE, AT A GLANCE</span>
          <h1>
            Your store today<span>.</span>
          </h1>
          <p>Products, stock, and customer requests in one place.</p>
        </div>
        <button className="button button-primary" onClick={() => edit("new")}>
          <Plus size={17} /> Add product
        </button>
      </div>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <article className="metric-card" key={m.title}>
            <div>
              <span>{m.title}</span>
              <span className="metric-icon metric-green">
                <m.icon size={20} />
              </span>
            </div>
            <strong>
              {m.value === undefined ? "—" : String(m.value).padStart(2, "0")}
            </strong>
          </article>
        ))}
      </div>
      <DataState {...orders} />
      <DataState {...stock} />
      <div className="dashboard-shortcuts">
        {[
          {
            href: "/admin/orders",
            title: "Review order requests",
            text: "Open cash memos, check WhatsApp status, and confirm requests.",
          },
          {
            href: "/admin/inventory",
            title: "Update your stock count",
            text: "Record a physical count or adjust several products together.",
          },
          {
            href: "/admin/settings",
            title: "Set up your store",
            text: "Maintain store details and the WhatsApp recipient.",
          },
        ].map((x) => (
          <Link
            href={x.href}
            className="admin-panel dashboard-shortcut"
            key={x.href}
          >
            <h2>{x.title}</h2>
            <p>{x.text}</p>
            <ArrowRight size={20} />
          </Link>
        ))}
      </div>
      <div className="manual-stock-note">
        <Package size={20} />
        <p>
          <strong>You control your stock.</strong> Order submissions and status
          changes never reduce or reserve recorded inventory.
        </p>
      </div>
    </>
  );
}
