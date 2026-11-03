"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { api } from "@/lib/api";
import type { Category } from "@/lib/products";
import { Modal } from "@/components/ui/modal";

export function Categories() {
  const { categories, products, refresh } = useStore();
  const [draft, setDraft] = useState<Category | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      await refresh();
      setDraft(null);
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
          <span className="eyebrow muted-eyebrow">ORGANIZE YOUR CATALOGUE</span>
          <h1>
            Your categories<span>.</span>
          </h1>
          <p>A place for every essential.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            setError("");
            setIsNew(true);
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              illustration: "rice",
            });
          }}
        >
          <Plus size={16} /> Add category
        </button>
      </div>
      {error && !draft && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="category-manager-grid">
        {categories.map((c) => (
          <article key={c.id} className="admin-panel admin-category-card">
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <strong>
              {products.filter((p) => p.category === c.id).length} products
            </strong>
            <Link
              className="text-button"
              href={`/admin/products?category=${c.id}`}
            >
              Explore products
            </Link>
            <div className="category-actions">
              <button
                className="button button-secondary"
                onClick={() => {
                  setError("");
                  setIsNew(false);
                  setDraft({ ...c });
                }}
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                className="button button-secondary"
                aria-label={`Delete ${c.name} category`}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete the ${c.name} category? Products must be moved first.`,
                    )
                  )
                    return;
                  try {
                    await api(`/api/admin/categories/${c.id}`, {
                      method: "DELETE",
                    });
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <Modal
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
        title={isNew ? "Add category" : "Edit category"}
      >
        {draft && (
          <form className="operation-form" onSubmit={save}>
            <div className="field">
              <label htmlFor="category-name">Category name</label>
              <input
                id="category-name"
                required
                minLength={2}
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="category-description">Description</label>
              <input
                id="category-description"
                maxLength={120}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? "Saving…" : "Save category"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
