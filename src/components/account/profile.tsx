"use client";
import { useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { CustomerLogin, type CustomerIdentity } from "./customer-login";
export function Profile() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="icon-button profile-button"
        aria-label="Profile and sign in"
        onClick={async () => {
          setOpen(true);
          setLoading(true);
          setError("");
          try {
            const session = await api<{
              customer: CustomerIdentity | null;
              admin: unknown;
            }>("auth/session");
            setCustomer(session.customer);
            setAdmin(!!session.admin);
          } catch {
            setError("Could not load your profile. Please try again.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <UserRound size={21} />
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Your profile">
        {loading ? (
          <p>Loading profile…</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            {customer ? (
              <div className="record-form">
                <p>
                  Signed in as {customer.name} · {customer.phone}
                </p>
                <button
                  className="button button-secondary"
                  onClick={async () => {
                    try {
                      await api("auth/customer/logout", "POST");
                      setCustomer(null);
                    } catch {
                      setError("Could not sign out. Please try again.");
                    }
                  }}
                >
                  Sign out as customer
                </button>
              </div>
            ) : (
              <CustomerLogin onSuccess={setCustomer} />
            )}
            <p>
              <Link
                className="button button-secondary"
                href={admin ? "/admin" : "/admin-login"}
              >
                {admin ? "Open admin dashboard" : "Admin login"}
              </Link>
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
