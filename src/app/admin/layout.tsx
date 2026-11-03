import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLogin } from "@/components/admin/login";
import { auth } from "@/server/container";
import { mockAuthEnabled } from "@/server/config";
import { SESSION_COOKIE } from "@/server/services/admin-auth-service";
export const metadata: Metadata = {
  title: "Store manager — dukan",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let authorized = false;
  try {
    await auth.authenticate((await cookies()).get(SESSION_COOKIE)?.value);
    authorized = true;
  } catch {
    /* Render login; all private APIs enforce authorization independently. */
  }
  if (!authorized)
    return (
      <AdminLogin
        developmentPhone={
          mockAuthEnabled() ? process.env.ADMIN_PHONE : undefined
        }
      />
    );
  return <AdminShell>{children}</AdminShell>;
}
