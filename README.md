# Dukan — wholesale grocery ordering

A wholesale grocery ordering app for Indian stores, built with Next.js, React, and TypeScript. Customers browse products, add bags, and submit an order request using only their name and mobile number. Store owners manage their catalogue, manually update stock, and review printable cash memos with WhatsApp notification status.

The responsive storefront retains its green, cream, and white palette, with English/Hindi product names and prices in Indian rupees.

**Current stage: Phase 2 development.** The ordering workflow, admin interface, PDF generation, and provider adapters are implemented. Permanent PostgreSQL storage is planned for Phase 3; the development datastore is blocked in production. Mock OTP and WhatsApp providers send no real messages.

[Implementation guide](docs/phase2.md) · [Validation report](docs/validation.md) · [Environment template](.env.example)

## Features

| Area               | Included                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer catalogue | Search in English/Hindi, category and availability filters, sorting, package sizes, compact product cards, and photo fallbacks                    |
| Shopping bag       | Persistent bag, quantity controls, prices per bag, line totals, removal, and grand total                                                          |
| Guest checkout     | Name and +91 mobile number only, server-side price and availability validation, duplicate-request protection, and rate limiting                   |
| Cash memo PDFs     | Unique reference, customer and product snapshots, Asia/Kolkata timestamps, Hindi and rupee fonts, pagination, and order-request disclaimers       |
| WhatsApp           | Development mock, official Cloud API adapter, document templates, signed delivery webhooks, guarded retries, and manual PDF sharing               |
| Admin access       | Pre-authorized phone identity, OTP provider abstraction, Twilio Verify adapter, and server-authorized sessions                                    |
| Store management   | Dashboard, product/category editing, product archiving, manual stock adjustments with history, order statuses, memo downloads, and store settings |

### Inventory stays under the store's control

Order submissions and changes to order status **never reduce or reserve stock**. Only an explicit admin stock adjustment changes the recorded count. Customers see availability without exact stock quantities. New products start with zero stock and become orderable after an admin records their count.

An order request does not confirm payment or final availability. There are no online payments, customer accounts, or customer OTP requirements.

## Quick start

Use Node.js **22.13 or later** and npm.

```bash
git clone https://github.com/Harshit-Hackerxguy/Dukan.git
cd Dukan
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the storefront or [localhost:3000/admin](http://localhost:3000/admin) for store management. The initial catalogue contains six sample products, including 30 kg and 50 kg rice bags, sugar, and potatoes.

With the example environment, the development admin number is `+919999999999`. Request a sign-in code to display a random development OTP, then enter it to sign in. This is a labeled mock flow; no SMS is sent. Real OTP requires a configured provider and the store's actual pre-authorized admin number.

Product, inventory, order, and session data are stored locally in `.data/phase2.json`. This ignored development file survives local restarts but is unsuitable for production or multiple server instances. The browser stores the shopping bag separately. Keep `.env.local` and development customer data out of version control.

## Store management

| Route               | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `/`                 | Customer catalogue and order submission                                   |
| `/admin`            | Product/category counts, pending requests, and out-of-stock products      |
| `/admin/products`   | Add, edit, price, photograph, and archive products                        |
| `/admin/categories` | Organize catalogue categories                                             |
| `/admin/inventory`  | View exact counts, make bulk stock adjustments, and review history        |
| `/admin/orders`     | Review requests, update status, download memos, and check WhatsApp status |
| `/admin/settings`   | Edit store details and configure the WhatsApp recipient and consent       |

Admin APIs and PDF downloads verify the session on the server. Customer checkout remains available without an account.

## Provider configuration

Copy [`.env.example`](.env.example) to `.env.local` for local development. Provider credentials stay on the server.

| Integration | Development default                                             | Real provider setup                                                                                                          |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Admin OTP   | `ADMIN_OTP_PROVIDER=mock` with `ALLOW_DEV_OTP=true`             | Set the authorized `ADMIN_PHONE`, use `ADMIN_OTP_PROVIDER=twilio`, disable the mock, and configure Twilio Verify credentials |
| WhatsApp    | `WHATSAPP_PROVIDER=mock`; records a mock action without sending | Use `WHATSAPP_PROVIDER=cloud` with the sender phone-number ID, access token, approved document template, and webhook secrets |

The WhatsApp API sender, the admin's sign-in identity, and the recipient number are configured separately. Set the recipient and record consent in authenticated Settings. A recipient number alone cannot enable automatic sending.

The UI distinguishes mock actions, provider acceptance, confirmed delivery, failures, and unknown outcomes. Manual sharing does not claim tracked delivery. Live WhatsApp and SMS delivery require real provider configuration and have not been verified with live credentials.

See the [WhatsApp setup instructions](docs/phase2.md#whatsapp-development-and-live-configuration), [admin authentication guide](docs/phase2.md#admin-authentication), and [complete environment-variable reference](docs/phase2.md#environment-variables).

## Architecture

| Layer          | Implementation                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Application    | Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4                                                              |
| UI             | Radix dialogs, Lucide icons, local fonts, and responsive storefront/admin styles                                             |
| Backend        | Next.js route handlers, Zod validation, and modular checkout, product, inventory, authentication, PDF, and WhatsApp services |
| PDF generation | PDFKit with bundled Noto Sans and Noto Sans Devanagari fonts                                                                 |
| Persistence    | Development file adapter and isolated in-memory test adapter behind repository/unit-of-work contracts                        |
| Testing        | Node.js service tests, Playwright browser tests, and axe accessibility checks                                                |

```text
src/app/                  Customer/admin routes and backend APIs
src/components/           Storefront, bag, checkout, and admin components
src/server/services/      Ordering, inventory, PDF, provider, and auth logic
src/server/repositories/  Repository contracts and development adapters
src/server/container.ts   Service and repository wiring
public/fonts/             PDF/Hindi fonts and their license
tests/                    Service, browser, and Android-layout checks
docs/                     Implementation details and validation results
```

## Validation

The PDF assertions require Poppler's `pdftotext` and `pdffonts` commands (`poppler-utils` on Debian/Ubuntu). Install a Playwright browser before running browser tests:

```bash
npx playwright install chromium
```

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm test
npm run build
```

For an existing Chromium installation:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

The browser suite starts a dedicated development server on port `3100` and uses `work/browser-test-data.json`. It leaves the local store data in `.data/phase2.json` untouched. Tests cover checkout validation, server totals, PDFs, messaging adapters, stock invariants, admin authorization, responsive layouts, and automated accessibility checks. Recorded results are in the [validation report](docs/validation.md).

## Phase 3: permanent storage

The app supports a production build for validation, but the development persistence adapter refuses production runtime requests and mock OTP is disabled in production. Connecting real messaging credentials does not remove this storage requirement.

Phase 3 will connect PostgreSQL through the repository/unit-of-work boundary and provide durable transactions, memo/idempotency constraints, concurrency-safe messaging claims, persistent authentication and rate limits, PDF storage, and backup/retention policies. See the [database integration notes](docs/phase2.md#temporary-storage-and-phase-3) before deploying a live store.
