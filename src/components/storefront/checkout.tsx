"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/components/store-provider";
export function Checkout({ onSuccess }: { onSuccess: (memo: string) => void }) {
  const { products, cart, clearCart, refresh } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  return (
    <form
      className="checkout-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const items = Object.entries(cart)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, quantity]) => {
              const p = products.find((p) => p.id === id);
              if (!p)
                throw new Error(
                  "A product is no longer in the catalogue. Clear your bag and add available products.",
                );
              return {
                variantId: id,
                quantity,
                expectedPricePaise: Math.round(p.price * 100),
              };
            });
          const payload = { name: name.trim(), phone, items };
          const fingerprint = JSON.stringify(payload);
          try {
            pending.current ??= JSON.parse(
              sessionStorage.getItem("dukan-pending-checkout") || "null",
            );
          } catch {
            /* memory fallback */
          }
          if (pending.current?.fingerprint !== fingerprint)
            pending.current = { fingerprint, key: crypto.randomUUID() };
          try {
            sessionStorage.setItem(
              "dukan-pending-checkout",
              JSON.stringify(pending.current),
            );
          } catch {
            /* memory fallback */
          }
          const result = await api<{ memoNumber: string }>(
            "checkout",
            "POST",
            payload,
            { "Idempotency-Key": pending.current!.key },
          );
          try {
            sessionStorage.removeItem("dukan-pending-checkout");
          } catch {
            /* memory fallback */
          }
          pending.current = null;
          clearCart();
          onSuccess(result.memoNumber);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not submit request. Retry with the same details.",
          );
          await refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Send your order request</h3>
      <label>
        Your name
        <input
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Mobile number
        <input
          required
          type="tel"
          maxLength={30}
          autoComplete="tel"
          placeholder="e.g. +91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <p>Product availability is subject to confirmation by the store.</p>
      <p>
        Your cash memo will be sent to the store’s WhatsApp. No online payment
        is collected.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary full-width" disabled={busy}>
        {busy ? "Submitting request…" : "Submit order request"}
      </button>
    </form>
  );
}
