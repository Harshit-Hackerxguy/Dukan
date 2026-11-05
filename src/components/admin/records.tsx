"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShareMemo } from "./share-memo";
import { api } from "@/lib/api";
import { formatPrice, type Category } from "@/lib/products";
import { useStore } from "@/components/store-provider";
const date = (value: string) =>
  new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
function useRemote<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records");
    }
  }, [path]);
  useEffect(() => {
    let alive = true;
    api<T>(path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return { data, error, reload };
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
function Pager({
  skip,
  setSkip,
  count,
}: {
  skip: number;
  setSkip: (value: number) => void;
  count: number;
}) {
  return (
    <div className="record-actions">
      <button
        className="button button-secondary"
        disabled={!skip}
        onClick={() => setSkip(Math.max(0, skip - 50))}
      >
        Previous
      </button>
      <span>Page {Math.floor(skip / 50) + 1}</span>
      <button
        className="button button-secondary"
        disabled={count < 50}
        onClick={() => setSkip(skip + 50)}
      >
        Next
      </button>
    </div>
  );
}
type Variant = {
  id: string;
  weight: string;
  unit: string;
  product: { name: string };
};
type Balance = {
  variantId: string;
  quantity: number;
  version: number;
  updatedAt: string;
  updatedBy: { name: string } | null;
  variant: Variant;
};
type Adjustment = {
  id: string;
  previousQuantity: number;
  newQuantity: number;
  difference: number;
  reason: string;
  createdAt: string;
  admin: { name: string };
  variant: Variant;
};
export function Inventory() {
  const { data, error, reload } = useRemote<Balance[]>("admin/inventory");
  const [skip, setSkip] = useState(0);
  const history = useRemote<Adjustment[]>(`admin/adjustments?skip=${skip}`);
  const [draft, setDraft] = useState<
    Record<string, { quantity: string; mode: string; version: number }>
  >({});
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify, refresh } = useStore();
  async function save(ids: string[]) {
    setBusy(true);
    setFailure("");
    try {
      const updates = ids.map((id) => {
        const d = draft[id];
        if (!/^\d+$/.test(d.quantity))
          throw new Error("Enter nonnegative whole numbers");
        return {
          variantId: id,
          quantity: Number(d.quantity),
          mode: d.mode,
          version: d.version,
          reason,
        };
      });
      await api("admin/inventory", "POST", { updates });
      setDraft((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => !ids.includes(id)),
        ),
      );
      await reload();
      await history.reload();
      await refresh();
      notify("Stock updated");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not update stock");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">PHYSICAL STOCK COUNTS</span>
          <h1>Your inventory.</h1>
          <p>
            Only your manual edits change recorded stock. Orders never deduct or
            reserve it.
          </p>
        </div>
      </div>
      <ErrorMessage error={error || failure} />
      <section className="admin-panel record-panel">
        <div className="record-actions">
          <label>
            Adjustment reason
            <input
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional, e.g. physical count"
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy || !Object.keys(draft).length}
            onClick={() => save(Object.keys(draft))}
          >
            Save all changes
          </button>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={async () => {
              setDraft({});
              await reload();
              setFailure("");
            }}
          >
            Refresh counts
          </button>
        </div>
        <div className="record-table-scroll">
          <table className="record-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current stock</th>
                <th>Change</th>
                <th>New stock / amount</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => {
                const d = draft[row.variantId];
                return (
                  <tr key={row.variantId}>
                    <td>
                      <strong>{row.variant.product.name}</strong>
                      <br />
                      {row.variant.weight} {row.variant.unit}
                      <small>
                        Updated {date(row.updatedAt)} ·{" "}
                        {row.updatedBy?.name || "Initial balance"}
                      </small>
                    </td>
                    <td>{row.quantity}</td>
                    <td>
                      <select
                        aria-label={`Adjustment for ${row.variant.product.name}`}
                        value={d?.mode || "set"}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            [row.variantId]: {
                              quantity: d?.quantity || "",
                              version: d?.version ?? row.version,
                              mode: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="set">Set count</option>
                        <option value="increase">Increase by</option>
                        <option value="decrease">Decrease by</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`New stock for ${row.variant.product.name}`}
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        value={d?.quantity ?? ""}
                        placeholder={String(row.quantity)}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            [row.variantId]: {
                              quantity: e.target.value,
                              mode: d?.mode || "set",
                              version: d?.version ?? row.version,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="button button-secondary"
                        disabled={busy || !d || d.quantity === ""}
                        onClick={() => save([row.variantId])}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!data && !error && <p>Loading stock…</p>}
      </section>
      <section className="admin-panel record-panel">
        <h2>Adjustment history</h2>
        <ErrorMessage error={history.error} />
        <div className="record-table-scroll">
          <table className="record-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Before → After</th>
                <th>Difference</th>
                <th>Admin / Time</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.variant.product.name} · {row.variant.weight}{" "}
                    {row.variant.unit}
                  </td>
                  <td>
                    {row.previousQuantity} → {row.newQuantity}
                  </td>
                  <td>
                    {row.difference > 0 ? "+" : ""}
                    {row.difference}
                  </td>
                  <td>
                    {row.admin.name}
                    <small>{date(row.createdAt)}</small>
                  </td>
                  <td>{row.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          skip={skip}
          setSkip={setSkip}
          count={history.data?.length || 0}
        />
      </section>
    </>
  );
}
type Order = {
  whatsappShareUrl: string | null;
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalPaise: number;
  createdAt: string;
  items: {
    id: string;
    name: string;
    packaging: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }[];
  memo: {
    id: string;
    number: string;
    documentStatus: string;
  } | null;
};
export function Orders() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [skip, setSkip] = useState(0);
  const { data, error, reload } = useRemote<Order[]>(
    `admin/orders?search=${encodeURIComponent(query)}&skip=${skip}`,
  );
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState("");
  async function action(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setFailure("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not update order");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">CUSTOMER REQUESTS & CASH MEMOS</span>
          <h1>Your orders.</h1>
          <p>
            Completion is recorded by you and is not proof of electronic
            payment. Stock stays unchanged.
          </p>
        </div>
        <button className="button button-secondary" onClick={reload}>
          Refresh
        </button>
      </div>
      <form
        className="record-actions"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setSkip(0);
        }}
      >
        <input
          aria-label="Search orders"
          placeholder="Name, phone, or memo number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="button button-secondary">Search</button>
      </form>
      <ErrorMessage error={error || failure} />
      {data?.map((order) => (
        <article
          className="admin-panel record-panel"
          key={order.id}
          id={order.id}
        >
          <div className="record-actions">
            <div>
              <h2>{order.memo?.number || order.id}</h2>
              <p>
                {order.customerName} · {order.customerPhone} (unverified)
              </p>
              <small>{date(order.createdAt)}</small>
            </div>
            <label>
              Order status
              <select
                aria-label={`Status for ${order.memo?.number || order.id}`}
                value={order.status}
                disabled={!!busy}
                onChange={(e) =>
                  action(order.id, () =>
                    api(`admin/orders/${order.id}`, "PATCH", {
                      status: e.target.value,
                    }),
                  )
                }
              >
                {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="record-table-scroll">
            <table className="record-table">
              <thead>
                <tr>
                  <th>Product / package</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name} · {item.packaging}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.unitPricePaise / 100)}</td>
                    <td>{formatPrice(item.lineTotalPaise / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Total {formatPrice(order.totalPaise / 100)}</strong>
          </p>
          {order.memo && (
            <>
              <div className="record-actions">
                <a
                  className="button button-secondary"
                  href={`/api/admin/memos/${order.memo.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview PDF
                </a>
                <a
                  className="button button-secondary"
                  href={`/api/admin/memos/${order.memo.id}?download=1`}
                >
                  Download memo
                </a>
                <ShareMemo
                  memo={order.memo}
                  whatsappShareUrl={order.whatsappShareUrl}
                />
              </div>
            </>
          )}
        </article>
      ))}
      {data?.length === 0 && <p>No order requests found.</p>}
      {!data && !error && <p>Loading requests…</p>}
      <Pager skip={skip} setSkip={setSkip} count={data?.length || 0} />
    </>
  );
}
type Customer = {
  id: string;
  name: string;
  phone: string;
  completedCount: number;
  _count: { orders: number };
  orders: {
    id: string;
    createdAt: string;
    status: string;
    totalPaise: number;
    customerName: string;
  }[];
};
export function Customers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [skip, setSkip] = useState(0);
  const { data, error } = useRemote<Customer[]>(
    `admin/customers?search=${encodeURIComponent(query)}&skip=${skip}`,
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">GUEST CUSTOMER RECORDS</span>
          <h1>Your customers.</h1>
          <p>
            Phone numbers are unverified. Matching numbers link requests; they
            do not prove identity.
          </p>
        </div>
      </div>
      <form
        className="record-actions"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setSkip(0);
        }}
      >
        <input
          aria-label="Search customers"
          placeholder="Name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="button button-secondary">Search</button>
      </form>
      <ErrorMessage error={error} />
      {data?.map((c) => (
        <article className="admin-panel record-panel" key={c.id}>
          <h2>{c.name}</h2>
          <p>
            {c.phone} ·{" "}
            {c._count.orders > 1 ? "Repeat customer" : "New customer"}
          </p>
          <p>
            {c._count.orders} submitted requests · {c.completedCount} explicitly
            completed
          </p>
          <p>Last request: {c.orders[0] ? date(c.orders[0].createdAt) : "—"}</p>
          <details>
            <summary>Recent requests</summary>
            {c.orders.map((o) => (
              <p key={o.id}>
                {date(o.createdAt)} · {o.customerName} · {o.status} ·{" "}
                {formatPrice(o.totalPaise / 100)}
              </p>
            ))}
            <Link href="/admin/orders">View orders and memos</Link>
          </details>
        </article>
      ))}
      {data?.length === 0 && <p>No customers found.</p>}
      <Pager skip={skip} setSkip={setSkip} count={data?.length || 0} />
    </>
  );
}
type SettingsData = {
  name: string;
  contact: string;
  location: string;
  hours: string;
  admin: { name: string; phone: string };
};
export function Settings() {
  const { data, error, reload } = useRemote<SettingsData>("admin/settings");
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const current = draft || data;
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const { notify, refresh } = useStore();
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">BUSINESS DETAILS</span>
          <h1>Store settings.</h1>
        </div>
      </div>
      <ErrorMessage error={error || failure} />
      {current && (
        <form
          className="admin-panel record-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setFailure("");
            try {
              await api("admin/settings", "POST", {
                ...current,
              });
              setDraft(null);
              await reload();
              await refresh();
              notify("Settings saved");
            } catch (e) {
              setFailure(
                e instanceof Error ? e.message : "Could not save settings",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {(
            [
              ["name", "Store name"],
              ["contact", "Contact details"],
              ["location", "Store location"],
              ["hours", "Opening hours"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={key === "name"}
                type="text"
                value={current[key]}
                onChange={(e) =>
                  setDraft({ ...current, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <p>
            Authorized admin: {current.admin.name} · {current.admin.phone}.
            Identity changes require the store owner’s protected server
            configuration process.
          </p>
          <button className="button button-primary" disabled={busy}>
            Save settings
          </button>
        </form>
      )}
    </>
  );
}
export function CategoryManager() {
  const { categories, products, refresh, notify } = useStore();
  const [draft, setDraft] = useState<Category | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">KEEP THINGS ORGANISED</span>
          <h1>Your categories.</h1>
        </div>
        <button
          className="button button-primary"
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              illustration: "rice",
              active: true,
            })
          }
        >
          Add category
        </button>
      </div>
      <ErrorMessage error={error} />
      {draft && (
        <form
          className="admin-panel record-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("admin/categories", "POST", draft);
              await refresh();
              setDraft(null);
              notify("Category saved");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not save category",
              );
            }
          }}
        >
          <label>
            Category name
            <input
              required
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <input
              maxLength={300}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            Illustration
            <select
              value={draft.illustration}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  illustration: e.target.value as Category["illustration"],
                })
              }
            >
              <option value="rice">Rice</option>
              <option value="sugar">Sugar</option>
              <option value="potatoes">Produce</option>
            </select>
          </label>
          <div className="record-actions">
            <button className="button button-primary">Save category</button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="admin-category-grid">
        {categories.map((c) => (
          <article className="admin-panel record-panel" key={c.id}>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <p>
              {products.filter((p) => p.category === c.id).length} package
              variants
            </p>
            <div className="record-actions">
              <button
                className="button button-secondary"
                onClick={() => setDraft(c)}
              >
                Edit category
              </button>
              <Link href={`/admin/products?category=${c.id}`}>
                View products
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export function DashboardRecords() {
  const { data, error } = useRemote<{
    activeProducts: number;
    categories: number;
    pending: number;
    outOfStock: number;
    recentOrders: Order[];
  }>("admin/dashboard");
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">YOUR STORE, AT A GLANCE</span>
          <h1>A good day to grow.</h1>
          <p>Customer requests and manually recorded stock.</p>
        </div>
        <Link className="button button-primary" href="/admin/products">
          Manage products
        </Link>
      </div>
      <ErrorMessage error={error} />
      <div className="metrics-grid">
        {data &&
          [
            ["Active products", data.activeProducts],
            ["Categories", data.categories],
            ["Pending requests", data.pending],
            ["Out of stock", data.outOfStock],
          ].map(([label, value]) => (
            <article className="metric-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
      </div>
      <section className="admin-panel record-panel">
        <h2>Recent requests</h2>
        {data?.recentOrders.map((o) => (
          <p key={o.id}>
            {o.customerName} · {date(o.createdAt)} · {o.status} ·{" "}
            {formatPrice(o.totalPaise / 100)}
          </p>
        ))}
        {data?.recentOrders.length === 0 && <p>No requests yet.</p>}
        <Link href="/admin/orders">View orders and cash memos →</Link>
      </section>
      <div className="record-actions">
        <Link className="button button-secondary" href="/admin/inventory">
          Update physical stock
        </Link>
        <Link className="button button-secondary" href="/admin/customers">
          Customer history
        </Link>
      </div>
    </>
  );
}
