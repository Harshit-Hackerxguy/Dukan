import { Suspense } from "react";
import { Products } from "@/components/admin/products";
export default function ProductsPage() {
  return (
    <Suspense
      fallback={<div className="loading-panel">Gathering your essentials…</div>}
    >
      <Products />
    </Suspense>
  );
}
