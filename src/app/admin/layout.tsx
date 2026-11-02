import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { storeConfig } from "@/lib/store-config";

export const metadata: Metadata = {
  title: `Store manager — ${storeConfig.name} demo`,
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
