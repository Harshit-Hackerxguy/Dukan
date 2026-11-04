"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Leaf,
  Menu,
  Package,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  Sprout,
  Tags,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { ProductForm } from "./product-form";
import type { Product } from "@/lib/products";

const nav = [
  { href: "/admin", name: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", name: "Products", icon: Package },
  { href: "/admin/categories", name: "Categories", icon: Tags },
  { href: "/admin/inventory", name: "Inventory", icon: Package },
  { href: "/admin/customers", name: "Customers", icon: ShoppingBag },
  { href: "/admin/orders", name: "Orders", icon: ShoppingBag },
  { href: "/admin/settings", name: "Settings", icon: Settings2 },
];
const EditorContext = createContext<(product: Product | "new") => void>(
  () => {},
);
export const useProductEditor = () => useContext(EditorContext);

function AdminNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="sidebar-brand">
        <Brand admin />
      </div>
      <div className="sidebar-store">
        <span>
          <Sprout size={18} />
        </span>
        <div>
          <strong>Your wholesale store</strong>
          <small>Store workspace</small>
        </div>
        <ChevronRight size={14} />
      </div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav aria-label="Admin navigation">
        {nav.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className={`sidebar-link ${pathname === item.href ? "sidebar-link-active" : ""}`}
            aria-current={pathname === item.href ? "page" : undefined}
            onClick={onNavigate}
          >
            <item.icon size={19} strokeWidth={1.7} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <Leaf size={25} strokeWidth={1.4} />
          <h3>A little care goes a long way.</h3>
          <p>Keep your essentials organised and your catalogue up to date.</p>
        </div>
        <Link href="/" className="sidebar-storefront" onClick={onNavigate}>
          <ArrowDownLeft size={18} /> Back to storefront{" "}
          <ArrowUpRight size={15} />
        </Link>
        <div className="sidebar-preview">
          <ShieldAlert size={14} /> Authorized admin access
        </div>
      </div>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [editor, setEditor] = useState<Product | "new" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const current =
    nav.find((item) => item.href === pathname)?.name || "Dashboard";
  return (
    <EditorContext.Provider value={setEditor}>
      <div className="admin-app">
        <a className="skip-link" href="#admin-main">
          Skip to main content
        </a>
        <aside className="admin-sidebar">
          <AdminNavigation pathname={pathname} />
        </aside>
        <div className="admin-workspace">
          <header className="admin-topbar">
            <div>
              <button
                className="icon-button admin-menu-toggle"
                aria-label="Open admin navigation"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={21} />
              </button>
              <span className="admin-breadcrumb">
                Workspace <ChevronRight size={13} /> <strong>{current}</strong>
              </span>
            </div>
            <div>
              <span className="demo-pill">
                <span className="status-dot" /> Admin
              </span>
              <Link
                href="/admin/settings"
                className="admin-help icon-button"
                aria-label="Store settings"
              >
                <CircleHelp size={19} />
              </Link>
              <button
                className="text-button"
                onClick={async () => {
                  await api("auth/logout", "POST", {});
                  router.push("/admin-login");
                  router.refresh();
                }}
              >
                Sign out
              </button>
              <span className="admin-avatar" title="Admin workspace">
                D
              </span>
            </div>
          </header>
          <main id="admin-main" className="admin-main">
            {children}
          </main>
          <footer className="admin-footer">
            <span>A little more organised. A lot more effortless.</span>
            <span>
              <Leaf size={13} /> Manual stock management
            </span>
          </footer>
        </div>
      </div>
      <Modal
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Your workspace"
        className="admin-nav-dialog"
      >
        <div className="mobile-admin-navigation">
          <AdminNavigation
            pathname={pathname}
            onNavigate={() => setMenuOpen(false)}
          />
        </div>
      </Modal>
      {editor && (
        <ProductForm
          key={editor === "new" ? "new" : editor.id}
          product={editor}
          onClose={() => setEditor(null)}
        />
      )}
    </EditorContext.Provider>
  );
}
