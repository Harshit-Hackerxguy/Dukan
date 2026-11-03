"use client";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";

type Receipt = {
  memoNumber: string;
  totalPaise: number;
  whatsappStatus: string;
  message: string;
};
const statusText: Record<string, string> = {
  mock: "Development preview: no WhatsApp message was sent.",
  not_configured:
    "Automatic WhatsApp sending is not configured. The store can download and share your memo manually.",
  failed:
    "Your request was saved, but the WhatsApp notification failed. The store can retry or share the memo manually.",
  unknown:
    "Your request was saved. The WhatsApp delivery outcome is not yet known.",
  accepted:
    "The WhatsApp provider accepted the notification. Delivery is not yet confirmed.",
  sent: "The WhatsApp notification was sent. Delivery is not yet confirmed.",
  delivered: "The order memo was delivered to the store’s WhatsApp.",
  read: "The order memo was delivered and marked read on the store’s WhatsApp.",
  pending: "Your request was saved. The WhatsApp notification is pending.",
  sending:
    "Your request was saved. The WhatsApp notification is being processed.",
};
export function Checkout({
  onBack,
  onBusy,
}: {
  onBack: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { products, cart, clearCart } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitting = useRef(false);
  const items = products
    .filter((p) => cart[p.id])
    .map((p) => ({ productId: p.id, quantity: cart[p.id] }));
  const total = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (name.trim().length < 2 || !/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter your name and a valid 10-digit mobile number.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const payload = { name: name.trim(), phone: `+91${phone}`, items };
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(payload)),
      );
      const fingerprint = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      try {
        pending.current ||= JSON.parse(
          sessionStorage.getItem("dukan-checkout-attempt") || "null",
        );
      } catch {
        /* Optional session storage. */
      }
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          "dukan-checkout-attempt",
          JSON.stringify(pending.current),
        );
      } catch {
        /* In-memory retry protection remains. */
      }
      const result = await api<Receipt>("/api/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Idempotency-Key": pending.current!.key },
      });
      setReceipt(result);
      clearCart();
      try {
        sessionStorage.removeItem("dukan-checkout-attempt");
      } catch {
        /* Optional. */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  if (receipt)
    return (
      <div className="checkout-result" role="status">
        <CheckCircle2 size={42} />
        <h3>Order request recorded</h3>
        <p className="memo-reference">{receipt.memoNumber}</p>
        <strong>{formatPrice(receipt.totalPaise / 100)}</strong>
        <p>{receipt.message}</p>
        <p className="delivery-note">
          {statusText[receipt.whatsappStatus] || statusText.pending}
        </p>
        <p>This request does not confirm payment.</p>
        <button className="button button-primary full-width" onClick={onBack}>
          Continue shopping
        </button>
      </div>
    );
  return (
    <form className="checkout-form" onSubmit={submit}>
      <button
        type="button"
        className="text-button"
        onClick={onBack}
        disabled={busy}
      >
        <ArrowLeft size={16} /> Back to bag
      </button>
      <div>
        <h3>Just your name and number.</h3>
        <p>The store will contact you to confirm your request.</p>
      </div>
      <div className="field">
        <label htmlFor="customer-name">Customer name</label>
        <input
          id="customer-name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="customer-phone">Mobile number</label>
        <div className="phone-input">
          <span>+91</span>
          <input
            id="customer-phone"
            name="tel-national"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            disabled={busy}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      <div className="checkout-estimate">
        <span>Bag total</span>
        <strong>{formatPrice(total)}</strong>
      </div>
      <p>
        Current prices and availability are checked when you submit. Your final
        request total will appear on confirmation.
      </p>
      <p className="availability-note">
        Product availability is subject to confirmation by the store.
      </p>
      <p>Shipping charges may vary and will be confirmed by the store.</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="button button-primary full-width"
        disabled={busy || !items.length}
      >
        {busy ? (
          <>
            <LoaderCircle className="spin" size={18} /> Submitting request…
          </>
        ) : (
          "Submit Order"
        )}
      </button>
      <small>
        Your name, phone number, and request will be shared with the store. No
        online payment is collected.
      </small>
    </form>
  );
}
