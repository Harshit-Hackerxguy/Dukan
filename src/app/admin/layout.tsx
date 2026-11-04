import { redirect } from "next/navigation";
import { getAdmin } from "@/server/auth";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { storeConfig } from "@/lib/store-config";

export const metadata: Metadata = {
  title: `Store manager — ${storeConfig.name}`,
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getAdmin())) redirect("/admin-login");
  return <AdminShell>{children}</AdminShell>;
}
