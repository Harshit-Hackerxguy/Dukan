# Dukan — wholesale store UI

A complete Phase 1 frontend for an Indian wholesale grocery store. “dukan” is temporary, configurable branding. All six seed products and prices are demo data.

## Run locally

Use Node.js 22.13+ (Node.js 24 is used in this cloud environment) and npm.

```bash
cd /workspace/Dukan
npm ci
npm run dev
```

The server uses port 3000. Open the root route for the storefront and `/admin` for the store manager. No environment variables, credentials, external services, or database are required. Fonts and product illustrations are served locally.

For a production build:

```bash
npm run build
npm start
```

Stop any server using port 3000 before starting another. The Next.js config permits the loopback hostname used by local tests. If using a development tunnel, add its exact hostname to `allowedDevOrigins` in `next.config.ts`.

## Included

- Responsive storefront with English/Hindi search, category filters, availability filtering, price/name sorting, product detail dialogs, and incremental catalogue loading.
- Android-first layouts with 44 px touch targets, full-width quantity controls, a thumb-reachable bag shortcut, direct catalogue results while searching, and mobile admin product cards.
- Bag drawer with quantities, removal, subtotal, empty states, and local persistence.
- `/admin`: product/category/availability counts derived from the demo catalogue, quick actions, and a catalogue overview.
- `/admin/products`: searchable, sortable, filterable, paginated table; add/edit form; availability switch; photo uploads or URLs; illustrated fallbacks; deletion confirmation.
- `/admin/categories`: category summaries and links to filtered products.
- `/admin/orders`: an explicit future-feature placeholder, without fabricated sales or orders.
- `/admin/settings`: placeholder business details, demo scope, and confirmed demo reset.
- Keyboard-accessible Radix dialogs, focus restoration, mobile menus, reduced-motion support, and live feedback.

## Demo boundaries

There are no backend APIs, database, authentication, payments, real ordering, delivery integration, WhatsApp ordering, notifications, or inventory synchronization. `/admin` is an **unsecured UI preview**, not a production admin system.

Catalogue and bag state are shared by the storefront and admin through React context and optionally persisted in this browser’s `localStorage`, under `dukan-phase1-v1`. Other browsers and devices do not share the data. The demo remains usable in memory when browser storage is unavailable. Uploaded images are limited to 500 KB each to keep this local demo lightweight. Broken image URLs use the selected illustration instead.

Reset original data through `/admin/settings`, or clear that localStorage key. Quantity controls support up to 99 bags per product in this demo. Marking a product unavailable or deleting it removes it from the demo bag. Price edits update the current bag subtotal.

## Customise

- `src/lib/store-config.ts`: temporary store name and contact/location placeholders.
- `src/lib/products.ts`: product types, category definitions, seed products, and price formatting.
- `src/components/store-provider.tsx`: the local data boundary to replace when a backend is introduced.
- `src/components/product-art.tsx`: original product/hero illustrations and photo fallbacks.
- `src/components/storefront/`: customer interactions and catalogue components.
- `src/components/admin/`: store manager layout, dashboard, and forms.
- `src/app/globals.css` and `src/styles/`: shared tokens, storefront/admin styles, and responsive layouts.

No reference screenshot was included in the supplied files; the visual design follows the written brief.

## Validation

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Browser tests cover catalogue interactions, cart totals and persistence, product management, availability and counts, image fallbacks, keyboard dialogs, mobile navigation, responsive overflow at 390/768/1440 px, and automated WCAG AA checks.

An additional Android suite uses Pixel 7 touch emulation to check 320/360/393/412 px phones and 915 px landscape, shopping by touch, reachable bag controls, the mobile product editor, and mobile accessibility. Physical Android hardware has not been used for these automated checks.

Install Playwright’s browser once on your machine, then run the tests:

```bash
npx playwright install chromium
npm test
```

The cloud environment already has Chromium installed; use:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

The test runner starts the dev server automatically, or reuses an existing server on port 3000 outside CI. It uses isolated browser contexts, so tests do not edit the catalogue in your own browser. Automated accessibility checks are a useful baseline, not a substitute for testing with assistive technology.
