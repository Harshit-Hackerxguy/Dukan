"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Info,
  Leaf,
  Package,
  RotateCcw,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  Store,
  Timer,
  Truck,
} from "lucide-react";
import { useStore } from "@/components/store-provider";
import { Modal } from "@/components/ui/modal";
import { storeConfig } from "@/lib/store-config";

export function OrdersPreview() {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">A LITTLE LOOK AHEAD</span>
          <h1>
            The next chapter<span>.</span>
          </h1>
          <p>More ways to bring good things to your customers.</p>
        </div>
        <span className="coming-soon large-soon">
          <Timer size={14} /> Future feature
        </span>
      </div>
      <section className="orders-preview-panel">
        <div className="orders-illustration">
          <span />
          <div>
            <ShoppingBag size={54} strokeWidth={1.15} />
            <span>
              <Leaf size={19} />
            </span>
          </div>
          <i />
        </div>
        <span className="eyebrow">GOOD THINGS TAKE A LITTLE TIME</span>
        <h2>
          Every order will start
          <br />
          with something good.
        </h2>
        <p>
          One day, this will be the place to follow your orders.
          <br />
          For now, we’re making sure your catalogue feels just right.
        </p>
        <Link href="/admin/products" className="button button-primary">
          Back to your products <ArrowRight size={17} />
        </Link>
        <div className="future-feature-row">
          <span>
            <ClipboardList size={18} /> Order overview
          </span>
          <span>
            <Package size={18} /> Order details
          </span>
          <span>
            <Truck size={18} /> Fulfilment status
          </span>
        </div>
        <div className="orders-preview-note">
          <Info size={16} /> Planned features only. No orders, payments, or
          fulfilment are processed in Phase 1.
        </div>
      </section>
    </>
  );
}

export function SettingsPreview() {
  const { resetDemo } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow muted-eyebrow">
            THE DETAILS BEHIND THE GOODNESS
          </span>
          <h1>
            Make yourself at home<span>.</span>
          </h1>
          <p>A little context for your demo workspace.</p>
        </div>
        <span className="coming-soon large-soon">
          <Settings2 size={14} /> Settings preview
        </span>
      </div>
      <div className="settings-grid">
        <section className="admin-panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <Store size={18} /> Store details
              </h2>
              <p>Placeholder information, ready for your real business.</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Temporary store name</dt>
              <dd>
                {storeConfig.name}
                <span className="preview-label">PLACEHOLDER</span>
              </dd>
            </div>
            <div>
              <dt>Store location</dt>
              <dd>{storeConfig.location}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{storeConfig.contact}</dd>
            </div>
            <div>
              <dt>Opening hours</dt>
              <dd>{storeConfig.hours}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>Indian rupee (₹)</dd>
            </div>
          </dl>
          <div className="settings-note">
            <Info size={15} /> Business settings will be editable in a future
            phase. This preview uses placeholder information.
          </div>
        </section>
        <div>
          <section className="admin-panel settings-panel demo-settings">
            <div className="panel-heading">
              <div>
                <h2>
                  <Leaf size={18} /> About this preview
                </h2>
                <p>A small beginning, with room to grow.</p>
              </div>
            </div>
            <ul>
              <li>
                <Check size={16} /> Local product management
              </li>
              <li>
                <Check size={16} /> Customer catalogue & demo bag
              </li>
              <li>
                <Check size={16} /> Browser-only demo persistence
              </li>
            </ul>
            <div className="security-note">
              <ShieldAlert size={20} />
              <p>
                <strong>An unsecured UI preview.</strong> This admin area has no
                authentication or access controls. It is not a production
                management system.
              </p>
            </div>
          </section>
          <section className="reset-demo-panel">
            <div>
              <RotateCcw size={20} />
              <h3>A fresh start</h3>
            </div>
            <p>
              Restore the six original demo products and clear the bag. This
              removes your local catalogue edits.
            </p>
            <button
              className="button button-secondary"
              onClick={() => setConfirm(true)}
            >
              <RotateCcw size={15} /> Reset demo data
            </button>
          </section>
        </div>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Start fresh?"
        description="This affects only the demo data in this browser."
        className="confirm-dialog"
      >
        <div className="confirm-body">
          <p>
            Your product changes and current bag will be removed. The six
            original demo products will be restored.
          </p>
          <p className="small muted">This reset cannot be undone.</p>
        </div>
        <div className="confirm-actions">
          <button
            className="button button-secondary"
            autoFocus
            onClick={() => setConfirm(false)}
          >
            Keep my changes
          </button>
          <button
            className="button button-danger"
            onClick={() => {
              resetDemo();
              setConfirm(false);
            }}
          >
            Reset demo data
          </button>
        </div>
      </Modal>
    </>
  );
}
