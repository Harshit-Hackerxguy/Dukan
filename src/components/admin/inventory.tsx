"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Adjustment } from "@/server/domain";
import { useStore } from "@/components/store-provider";
import { DataState, useAdminData } from "./use-admin-data";

type InventoryData = {
  products: {
    id: string;
    name: string;
    weight: number;
    unit: string;
    quantity: number;
  }[];
  history: Adjustment[];
};
export function Inventory() {
  const remote = useAdminData<InventoryData>("/api/admin/inventory");
  const { notify } = useStore();
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const edits = remote
        .data!.products.filter(
          (p) =>
            changes[p.id] !== undefined && Number(changes[p.id]) !== p.quantity,
        )
        .map((p) => ({
          productId: p.id,
          quantity: Number(changes[p.id]),
          expectedQuantity: p.quantity,
        }));
      if (!edits.length) {
        setError("Change at least one stock quantity.");
        return;
      }
      await api("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({ reason, changes: edits }),
      });
      setChanges({});
      setReason("");
      await remote.reload();
      notify("Stock updated. The adjustment has been recorded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">MANUAL COUNTS</span>
          <h1>
            Your inventory<span>.</span>
          </h1>
          <p>
            Only these explicit stock adjustments change recorded quantities.
          </p>
        </div>
      </div>
      <DataState {...remote} />
      {remote.data && (
        <>
          <form className="admin-panel inventory-panel" onSubmit={save}>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Inventory table"
            >
              <table className="operations-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Package</th>
                    <th>Recorded bags</th>
                    <th>New count</th>
                  </tr>
                </thead>
                <tbody>
                  {remote.data.products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        {p.weight} {p.unit}
                      </td>
                      <td>{p.quantity}</td>
                      <td>
                        <input
                          aria-label={`Stock for ${p.name}`}
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          required
                          value={changes[p.id] ?? p.quantity}
                          onChange={(e) =>
                            setChanges({ ...changes, [p.id]: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="operation-form">
              <div className="field">
                <label htmlFor="stock-reason">Reason for adjustment</label>
                <input
                  id="stock-reason"
                  minLength={3}
                  maxLength={200}
                  required
                  placeholder="e.g. Physical count after shop closing"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-primary" disabled={busy}>
                {busy ? "Saving…" : "Save stock adjustments"}
              </button>
            </div>
          </form>
          <section className="admin-panel history-panel">
            <h2>Adjustment history</h2>
            {!remote.data.history.length ? (
              <p>No stock adjustments yet.</p>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Stock adjustment history"
              >
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Date / IST</th>
                      <th>Product</th>
                      <th>Before → after</th>
                      <th>Reason / admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remote.data.history.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {new Date(a.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td>{a.productName}</td>
                        <td>
                          {a.before} → {a.after}
                        </td>
                        <td>
                          {a.reason}
                          <small>{a.actor}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
