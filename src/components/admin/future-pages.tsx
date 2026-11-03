"use client";
import { useState } from "react";
import { Download, RefreshCw, Share2, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import type { OrderSummary, StoreSettings } from "@/server/domain";
import { useStore } from "@/components/store-provider";
import { DataState, useAdminData } from "./use-admin-data";

const deliveryLabels: Record<string, string> = {
  pending: "Pending send",
  not_configured: "Not configured",
  mock: "Mock only · not sent",
  sending: "Sending · unconfirmed",
  accepted: "Accepted · delivery unconfirmed",
  sent: "Sent · delivery unconfirmed",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  unknown: "Delivery unknown",
};
export function OrdersPreview() {
  const remote = useAdminData<{ orders: OrderSummary[] }>("/api/admin/orders");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { notify } = useStore();
  async function mutate(id: string, action: string, value: unknown) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/orders/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(value),
      });
      await remote.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function share(order: OrderSummary) {
    setBusy(order.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "The memo could not be downloaded. Sign in again if your session expired.",
        );
      const file = new File(
        [await response.blob()],
        `${order.memoNumber}.pdf`,
        { type: "application/pdf" },
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: order.memoNumber,
          text: `${order.memoNumber} · ${order.customer.name} · ${order.customer.phone} · ${formatPrice(order.totalPaise / 100)}`,
        });
        notify(
          "Manual share action finished. WhatsApp delivery is not tracked for manual sharing.",
        );
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        notify(
          "PDF downloaded. Open WhatsApp, choose your store recipient, and attach this file manually.",
        );
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const orders =
    remote.data?.orders.filter(
      (o) => filter === "all" || o.status === filter,
    ) || [];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">CUSTOMER REQUESTS</span>
          <h1>
            Your orders<span>.</span>
          </h1>
          <p>
            Review requests and cash memos. Status changes do not change stock.
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={() => void remote.reload()}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <div className="orders-toolbar">
        <label>
          Show requests{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {["pending", "confirmed", "completed", "cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span>{orders.length} requests</span>
      </div>
      <DataState {...remote} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {remote.data && !orders.length && (
        <section className="admin-panel admin-empty">
          <ShoppingBag size={36} />
          <h2>No order requests here yet.</h2>
          <p>Requests submitted from the catalogue will appear here.</p>
        </section>
      )}
      <div className="order-list">
        {orders.map((o) => (
          <article className="admin-panel order-card" key={o.id}>
            <div className="order-card-heading">
              <div>
                <h2>{o.memoNumber}</h2>
                <p>
                  {new Date(o.createdAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </p>
              </div>
              <label>
                Request status
                <select
                  aria-label={`Status for ${o.memoNumber}`}
                  value={o.status}
                  disabled={busy === o.id}
                  onChange={(e) =>
                    void mutate(o.id, "status", { status: e.target.value })
                  }
                >
                  {["pending", "confirmed", "completed", "cancelled"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="order-customer">
              <strong>{o.customer.name}</strong>
              <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label={`Products in ${o.memoNumber}`}
            >
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Requested product</th>
                    <th>Bags</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.productId}>
                      <td>
                        {i.name}
                        <small>
                          {i.weight} {i.unit} ·{" "}
                          <span lang="hi">{i.hindiName}</span>
                        </small>
                      </td>
                      <td>{i.quantity}</td>
                      <td>{formatPrice(i.unitPricePaise / 100)}</td>
                      <td>{formatPrice(i.totalPaise / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-total">
              <span>Grand total</span>
              <strong>{formatPrice(o.totalPaise / 100)}</strong>
            </div>
            <div className="whatsapp-status">
              <strong>WhatsApp: {deliveryLabels[o.whatsapp.status]}</strong>
              {o.whatsapp.error && <p>{o.whatsapp.error}</p>}
              <small>
                {o.whatsapp.attempts} send attempts. Refresh to see delivery
                updates.
              </small>
            </div>
            <div className="order-actions">
              <a
                className="button button-secondary"
                href={`/api/admin/orders/${o.id}/pdf`}
              >
                <Download size={16} /> Download memo
              </a>
              <button
                className="button button-secondary"
                disabled={busy === o.id}
                onClick={() => void share(o)}
              >
                <Share2 size={16} /> Share PDF manually
              </button>
              {["failed", "not_configured"].includes(o.whatsapp.status) && (
                <button
                  className="button button-primary"
                  disabled={busy === o.id || o.whatsapp.attempts >= 3}
                  onClick={() => void mutate(o.id, "retry", {})}
                >
                  <RefreshCw size={16} /> Retry WhatsApp
                </button>
              )}
            </div>
            <p className="manual-share-note">
              Manual fallback: choose the store recipient in WhatsApp and attach
              the PDF. Check any uncertain send before sharing; manual delivery
              is not tracked.
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

type SettingsData = {
  settings: StoreSettings;
  adminPhone: string;
  mockAuth: boolean;
  whatsapp: {
    mode: string;
    configured: boolean;
    senderId: string;
    template: string;
    language: string;
  };
};
export function SettingsPreview() {
  const remote = useAdminData<SettingsData>("/api/admin/settings");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">STORE DETAILS</span>
          <h1>
            Your settings<span>.</span>
          </h1>
          <p>Keep store information and notification preferences up to date.</p>
        </div>
      </div>
      <DataState {...remote} />
      {remote.data && (
        <SettingsForm
          key={JSON.stringify(remote.data)}
          data={remote.data}
          reload={remote.reload}
        />
      )}
    </>
  );
}
function SettingsForm({
  data,
  reload,
}: {
  data: SettingsData;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    ...data.settings,
    whatsappConsent: !!data.settings.whatsappConsentAt,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notify, refresh } = useStore();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { whatsappConsentAt: _at, ...input } = draft;
      await api("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await reload();
      await refresh();
      notify("Store settings saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <form
        className="admin-panel operation-form settings-form"
        onSubmit={submit}
      >
        <h2>Store information</h2>
        {(
          [
            { key: "name", label: "Store name", max: 80 },
            { key: "contact", label: "Store contact information", max: 120 },
            { key: "location", label: "Store location", max: 160 },
            { key: "hours", label: "Opening hours", max: 80 },
          ] as const
        ).map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`setting-${f.key}`}>{f.label}</label>
            <input
              id={`setting-${f.key}`}
              required={f.key === "name"}
              maxLength={f.max}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <h2>WhatsApp recipient</h2>
        <p>
          This is the number that receives order PDFs. It is separate from the
          API sender and admin sign-in identity.
        </p>
        <div className="field">
          <label htmlFor="wa-recipient">Recipient mobile number</label>
          <input
            id="wa-recipient"
            type="tel"
            placeholder="+91 followed by 10 digits"
            value={draft.whatsappRecipient}
            onChange={(e) =>
              setDraft({
                ...draft,
                whatsappRecipient: e.target.value,
                whatsappConsent: false,
              })
            }
          />
        </div>
        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={draft.whatsappConsent}
            onChange={(e) =>
              setDraft({ ...draft, whatsappConsent: e.target.checked })
            }
          />
          <span>
            This recipient has agreed to receive order request notifications on
            WhatsApp.
          </span>
        </label>
        <p>A recipient number alone does not enable automatic sending.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
      <div className="settings-side">
        <section className="admin-panel operation-form">
          <h2>Authorized admin</h2>
          <strong>{data.adminPhone}</strong>
          <p>
            {data.mockAuth
              ? "Development-only mock OTP is enabled. No SMS is sent."
              : "Sign-in codes are handled by the configured OTP provider."}
          </p>
          <p>
            The authorized identity is configured securely on the server. There
            is no public admin registration.
          </p>
        </section>
        <section className="admin-panel operation-form">
          <h2>WhatsApp connection</h2>
          <dl className="connection-details">
            <div>
              <dt>Provider</dt>
              <dd>{data.whatsapp.mode}</dd>
            </div>
            <div>
              <dt>API sender ID</dt>
              <dd>{data.whatsapp.senderId || "Not configured"}</dd>
            </div>
            <div>
              <dt>Document template</dt>
              <dd>{data.whatsapp.template || "Not configured"}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{data.whatsapp.language}</dd>
            </div>
          </dl>
          <p>
            {data.whatsapp.mode === "mock"
              ? "Mock sends are recorded for development. They do not contact WhatsApp."
              : data.whatsapp.configured
                ? "API fields are configured. Approved template, recipient consent, and delivery webhooks are still required."
                : "Automatic sending is unavailable until the server credentials and an approved document template are configured."}
          </p>
          <p>API credentials remain on the server and are never shown here.</p>
        </section>
      </div>
    </div>
  );
}
