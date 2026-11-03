"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  Info,
  LoaderCircle,
  Package,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ProductImage } from "@/components/product-art";
import { useStore } from "@/components/store-provider";
import { type Product } from "@/lib/products";

const blank: Product = {
  id: "",
  name: "",
  hindiName: "",
  category: "rice",
  weight: 50,
  unit: "kg",
  price: 0,
  image: "",
  illustration: "rice",
  tone: "green",
  description: "",
  available: true,
};

export function ProductForm({
  product,
  onClose,
}: {
  product: Product | "new";
  onClose: () => void;
}) {
  const { saveProduct, categories } = useStore();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Product>(
    product === "new"
      ? { ...blank, category: categories[0]?.id || "rice" }
      : { ...product },
  );
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const loadImage = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Choose an image smaller than 500 KB.");
      return;
    }
    setError("");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      update("image", String(reader.result));
      setUploading(false);
    };
    reader.onerror = () => {
      setError("That image could not be read. Please try another file.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !draft.name.trim() ||
      draft.price <= 0 ||
      draft.weight <= 0 ||
      !Number.isFinite(draft.price) ||
      !Number.isFinite(draft.weight)
    ) {
      setError(
        "Add a product name, a valid weight, and a price greater than zero.",
      );
      return;
    }
    if (draft.image && !draft.image.startsWith("data:image/")) {
      try {
        if (!["https:"].includes(new URL(draft.image).protocol))
          throw new Error();
      } catch {
        setError(
          "Use a full https:// image URL, upload a photo, or leave the field empty.",
        );
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await saveProduct({
        ...draft,
        id: product === "new" ? crypto.randomUUID() : draft.id,
        name: draft.name.trim(),
        hindiName: draft.hindiName.trim(),
        description: draft.description.trim(),
        image: draft.image.trim(),
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={product === "new" ? "Add product" : "Edit product"}
      description={
        product === "new"
          ? "Add a product, then set its stock in Inventory."
          : "Keep your product details looking their best."
      }
      className="product-form-dialog"
    >
      <form onSubmit={submit} className="product-form">
        <div className="product-form-body">
          <div className="form-main">
            <div className="form-section-heading">
              <span>
                <Package size={16} />
              </span>
              <h3>Product details</h3>
            </div>
            <div className="field">
              <label htmlFor="product-name">
                Product name <span>*</span>
              </label>
              <input
                id="product-name"
                required
                maxLength={100}
                placeholder="e.g. Premium Rice"
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="hindi-name">
                Hindi name <small>Optional</small>
              </label>
              <input
                id="hindi-name"
                lang="hi"
                maxLength={100}
                placeholder="जैसे प्रीमियम चावल"
                value={draft.hindiName}
                onChange={(e) => update("hindiName", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-category">
                Category <span>*</span>
              </label>
              <select
                id="product-category"
                value={draft.category}
                onChange={(e) => {
                  const category = e.target.value as Product["category"];
                  setDraft((current) => ({
                    ...current,
                    category,
                    illustration:
                      category === "produce"
                        ? "potatoes"
                        : category === "essentials"
                          ? "sugar"
                          : "rice",
                  }));
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="product-weight">
                  Pack weight <span>*</span>
                </label>
                <input
                  id="product-weight"
                  type="number"
                  required
                  min="0.001"
                  max="100000"
                  step="0.001"
                  value={draft.weight || ""}
                  onChange={(e) => update("weight", Number(e.target.value))}
                />
              </div>
              <div className="field unit-field">
                <label htmlFor="product-unit">Unit</label>
                <select
                  id="product-unit"
                  value={draft.unit}
                  onChange={(e) =>
                    update("unit", e.target.value as Product["unit"])
                  }
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="product-price">
                  Price per bag <span>*</span>
                </label>
                <div className="input-affix">
                  <span>₹</span>
                  <input
                    id="product-price"
                    type="number"
                    required
                    min="1"
                    max="10000000"
                    step="1"
                    value={draft.price || ""}
                    onChange={(e) => update("price", Number(e.target.value))}
                    placeholder="1,200"
                  />
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="product-description">
                Description <small>Optional</small>
              </label>
              <textarea
                id="product-description"
                rows={3}
                maxLength={1000}
                placeholder="Tell customers a little about this product…"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <label className="availability-field">
              <div>
                <strong>Available in catalogue</strong>
                <span>Customers can add this product to their bag.</span>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={draft.available}
                onChange={(e) => update("available", e.target.checked)}
              />
              <span className="switch-visual" />
            </label>
          </div>
          <div className="form-aside">
            <div className="form-section-heading">
              <span>
                <ImagePlus size={16} />
              </span>
              <h3>Product image</h3>
            </div>
            <div className={`form-image-preview tone-${draft.tone}`}>
              <ProductImage product={draft} />
              {draft.image && (
                <button
                  className="icon-button remove-image"
                  type="button"
                  aria-label="Remove product image"
                  onClick={() => update("image", "")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              className="upload-button"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Upload size={16} />
              )}{" "}
              {uploading ? "Reading image…" : "Upload a photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Upload product image"
              onChange={(e) => {
                loadImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="field-help">JPG, PNG, or WebP · Max 500 KB</p>
            {!draft.image.startsWith("data:") && (
              <div className="field">
                <label htmlFor="image-url">Or use an image URL</label>
                <input
                  id="image-url"
                  placeholder="https://example.com/photo.jpg"
                  value={draft.image}
                  onChange={(e) => update("image", e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="illustration">Fallback illustration</label>
              <select
                id="illustration"
                value={draft.illustration}
                onChange={(e) =>
                  update(
                    "illustration",
                    e.target.value as Product["illustration"],
                  )
                }
              >
                <option value="rice">Rice bag</option>
                <option value="sugar">Sugar bag</option>
                <option value="potatoes">Potato sack</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-tone">Card accent</label>
              <select
                id="product-tone"
                value={draft.tone}
                onChange={(e) =>
                  update("tone", e.target.value as Product["tone"])
                }
              >
                <option value="green">Forest green</option>
                <option value="ochre">Warm amber</option>
                <option value="plum">Soft plum</option>
                <option value="blue">Slate blue</option>
                <option value="cream">Natural cream</option>
              </select>
            </div>
          </div>
        </div>
        <div className="form-footer">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <span className="form-demo-note">
            <Info size={15} /> Product details do not change stock counts.
          </span>
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || saving}
              className="button button-primary"
            >
              {product === "new" ? "Add product" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
