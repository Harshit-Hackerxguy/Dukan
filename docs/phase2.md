# Phase 2 implementation guide

## What changed

The existing Next.js application and components were retained. The forest green (`#245440`), cream, sage, and white palette remains intact. The hero is shorter, category filters are compact, and the catalogue is the main focus. Cards show a plain sack illustration or an administrator-provided photo, English/Hindi names, package weight, availability, price per bag, and ADD/quantity controls. Illustrations are placeholders, not fictional branded products.

The bag now shows unit prices, line totals, removal controls, and a grand total. Submit Order opens a form with only customer name and an Indian mobile number, defaulting to +91. There are loading, empty, validation, retry, and submission-result states. The mobile bag shortcut and keyboard-accessible Radix dialogs are retained.

Admin pages now include a dashboard with real development-data counts, product/category management, exact inventory and bulk adjustments with history, customer order requests, cash memo downloads, status changes, and store/WhatsApp settings. Archived products disappear from the catalogue while existing order snapshots remain unchanged.

## Checkout and inventory rules

`CheckoutService` validates product IDs, unique line items, integer quantities (1–99 bags per product; up to 50 distinct products), customer name, and a valid Indian mobile number. It rejects extra fields, including client prices/totals. Prices come from the product repository; calculations use integer paise. It rechecks stock and enabled/archive status inside the unit of work.

The order stores immutable customer, store, product, quantity, and price snapshots. The PDF is generated from those snapshots on the server. If PDF generation fails, the transaction does not save a partial order. The complete order and memo are saved before attempting WhatsApp, so a messaging failure does not discard the request.

**Order submission and all request status changes never decrease or reserve stock.** Only `InventoryService.adjust`, called through the authenticated stock-edit API, changes inventory. It checks the expected previous quantity to prevent overwriting a concurrent admin adjustment. Bulk edits are atomic and record before/after values, reason, admin identity, and time. Product edits do not set stock; newly added products start at zero.

The public API never returns exact counts. Zero stock displays “Out of stock.” An overstock request returns “Requested quantity unavailable.” Checkout displays “Product availability is subject to confirmation by the store.”

An `Idempotency-Key` of 32–100 letters, numbers, underscores, or hyphens is required. The UI uses a random UUID and keeps the attempt key plus a SHA-256 payload fingerprint in session storage; customer names and phone numbers are not written there. Identical retries return the existing request; changed payloads with the same key are rejected. This protects simultaneous duplicate submissions within the development adapter's single-process boundary.

## Backend APIs

All JSON and private PDF responses use `Cache-Control: no-store`. Admin endpoints independently check the secure session; the admin layout also gates rendering. Mutations require a matching browser Origin. No private PDF is placed in `public/` or given a public guessing-based URL.

| Method     | Route                          | Purpose                                                                               |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| GET        | `/api/catalogue`               | Public product details, categories, configured store contact details; no stock counts |
| POST       | `/api/checkout`                | Validate and save an order, generate PDF, attempt WhatsApp                            |
| POST       | `/api/auth/request`            | Request an OTP for the pre-authorized admin number                                    |
| POST       | `/api/auth/verify`             | Verify one-time code and create session                                               |
| POST       | `/api/auth/logout`             | Revoke session and remove cookie                                                      |
| GET / POST | `/api/admin/products`          | List or save products                                                                 |
| DELETE     | `/api/admin/products/:id`      | Archive a product                                                                     |
| POST       | `/api/admin/categories`        | Add or edit a category                                                                |
| DELETE     | `/api/admin/categories/:id`    | Delete an unused category                                                             |
| GET / POST | `/api/admin/inventory`         | Read counts/history or explicitly adjust stock                                        |
| GET        | `/api/admin/orders`            | List requests, line snapshots, and notification statuses                              |
| GET        | `/api/admin/orders/:id/pdf`    | Authorized cash memo download                                                         |
| POST       | `/api/admin/orders/:id/status` | Pending, confirmed, completed, or cancelled                                           |
| POST       | `/api/admin/orders/:id/retry`  | Guarded WhatsApp retry                                                                |
| GET / POST | `/api/admin/settings`          | Store details, recipient and consent; no API tokens returned                          |
| GET / POST | `/api/webhooks/whatsapp`       | Meta challenge verification and signed delivery updates                               |

JSON requests are size-limited (800 KB, allowing raster photo uploads up to 500 KB); webhook bodies are capped at 1 MB. Invalid data, unknown products, stock conflicts, unauthorized access, and rate limits return appropriate HTTP status codes and safe errors. Provider response bodies, credentials, stacks, and customer details are not logged as errors.

Rate limits are held server-side in the development adapter: checkout 60 requests per 10 minutes per trusted client key and 10 per customer phone; OTP requests 10 per client key and 4 per phone per 15 minutes; OTP verification 20 per client key per 15 minutes plus five attempts per challenge. With `TRUST_PROXY_IP=false`, clients share one server bucket. Only enable the forwarded IP option behind a proxy that strips/replaces client-supplied headers. Phase 3 should add a distributed limiter and appropriate edge protection.

## Cash memo PDFs

`CashMemoService` uses PDFKit, not screenshots. A4 memos contain the exact heading **CASH MEMO — ORDER REQUEST**, store details when configured, sequential reference (`CM-000001`), Asia/Kolkata date/time, customer name/phone, package sizes, quantities in bags, rates, line totals, and grand total. Large orders continue onto additional pages with repeated table headers and page numbers.

Noto Sans and Noto Sans Devanagari fonts are bundled under `public/fonts/`, licensed under the included SIL Open Font License. They are embedded in the PDF for rupee symbols and Hindi shaping. The build tracing configuration includes both fonts for server routes. Product/store/customer text is laid out as text, with explicit mixed-font wrapping.

Every PDF includes:

> Shipping charges may vary and will be confirmed by the store.
>
> This document is an order request and does not confirm payment.
>
> Product availability is subject to confirmation by the store.

There are no invented GST numbers, tax charges, or payment assertions. Admin downloads use the stored memo snapshot so subsequent product or store edits do not change historical documents.

## WhatsApp: development and live configuration

`WhatsAppService` uses the `WhatsAppProvider` interface. The development mock records **Mock only · not sent**, never delivered. `CloudWhatsAppProvider` implements the official Meta upload and template-message APIs. It is exercised in tests using a stubbed HTTP transport; no real credentials or real message delivery were available during implementation.

The three identities/configuration groups are separate:

1. **Sender:** `WHATSAPP_PHONE_NUMBER_ID`, the registered WhatsApp Business sender ID from Meta, not an ordinary recipient number.
2. **Recipient:** one Indian mobile number configured by an authenticated admin in Settings, with explicit recorded recipient consent. This may differ from the admin sign-in number.
3. **Credentials:** access token, app secret, and verification token held only in server environment variables. Settings never returns these values.

To connect live sending:

1. Create/configure a Meta Business app with WhatsApp and a WhatsApp Business Account. Register the sending number and obtain its **phone number ID**. Complete the applicable business/sender checks and add permitted test recipients while using Meta's test mode.
2. Create a server-side system-user access token with the necessary WhatsApp messaging/media permissions and access to the correct business assets. Store it as `WHATSAPP_ACCESS_TOKEN`; rotate it using your deployment's secret store. Do not place it in source, client variables, or the admin form.
3. Create and obtain approval for a template, for example `order_request_memo`, in the chosen language (default `en`). Request an appropriate utility classification subject to Meta review. It must have a **DOCUMENT header** and exactly four body text parameters in this order: memo number, customer name, customer phone, total. A compatible body is:

   ```text
   New order request {{1}}.
   Customer: {{2}}
   Phone: {{3}}
   Order total: {{4}}.
   The attached cash memo is an order request and does not confirm payment.
   ```

   Upload a sample document during template review if Meta requires it. Use the exact approved template name and language code. Template approval/classification is determined by Meta.

4. Set `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE`. The configurable Graph API version defaults to `v23.0`; select a version still supported by your Meta app and verify it before live use.
5. In authenticated Settings, enter the recipient in +91 format and record their consent. The store must obtain and retain valid consent, respect opt-outs, and follow WhatsApp messaging policy. Unchecking consent blocks future automatic sends.
6. Expose `/api/webhooks/whatsapp` over public HTTPS on a server connected to the appropriate repository. Set a strong `WHATSAPP_WEBHOOK_VERIFY_TOKEN` for the GET challenge and the Meta application secret as `WHATSAPP_APP_SECRET`. Subscribe the app/WABA to message status webhooks. POSTs verify `X-Hub-Signature-256` over the request body before processing events.
7. Set `SITE_ORIGIN` to the external website origin, including HTTPS, especially behind a reverse proxy. Allow outbound HTTPS to `graph.facebook.com` in the deployment environment. Restart/redeploy after changing server configuration.
8. Submit a small test request from the catalogue. Verify PDF content, sender and recipient, an API message ID, and a signed `delivered` webhook. Test invalid templates, expired tokens, recipient restrictions, timeouts, and consent revocation before live operation.

An approved document template is always used; the adapter does not assume the recipient has an active 24-hour messaging window. A recipient number by itself never enables live sending. A production deployment still requires the Phase 3 persistence/security adapters described below; changing provider variables does not remove the production storage guard.

The adapter uploads the PDF to `/{phone-number-id}/media`, then sends `/{phone-number-id}/messages` with the media ID, memo filename, and four body variables. An opaque order/attempt correlation value connects early webhooks to the correct send. Webhooks verify sender identity, recipient, message/attempt correlation, timestamps, and status progression. Duplicate/out-of-order events cannot downgrade delivered/read states.

Status meanings:

| Status           | Meaning                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| Not configured   | Missing live configuration or recipient consent; order remains saved                 |
| Mock             | Development action only; no message sent                                             |
| Sending          | An attempt was claimed; outcome is not yet known                                     |
| Accepted         | Meta returned a message ID; delivery is not confirmed                                |
| Sent             | Signed status says sent; delivery is not confirmed                                   |
| Delivered / Read | Corresponding signed provider status received                                        |
| Failed           | A known upload/send/delivery failure; the memo remains downloadable                  |
| Unknown          | Timeout, ambiguous response, or interrupted in-flight send; automatic resend blocked |

Retries are explicit admin actions, with a persisted attempt claim, up to three attempts, and exponential minimum delays after failures (30 seconds, then 60 seconds). Replaying checkout does not resend accepted or failed messages. Accepted/sent/delivered/read and unknown attempts cannot be resent through the retry endpoint. Known failures can be retried after correcting configuration. There is no background queue or scheduled summary in Phase 2. A worker crash may require an admin to inspect the attempt; a stale in-flight claim becomes unknown on a later dispatch check rather than being blindly resent.

**Manual fallback:** Download memo always provides the authenticated PDF. Share PDF manually uses the device's file share sheet when supported; otherwise it downloads the file and explains how to attach it in WhatsApp. The admin must select the intended recipient. A share-sheet action never marks an order delivered. Check uncertain delivery before manual sharing to avoid duplication.

## Admin authentication

The pre-authorized `ADMIN_PHONE` is set on the server; there is no public admin registration and no customer login. Settings displays the configured identity but cannot change it. Change identity through trusted server configuration, then restart/redeploy; existing sessions are rechecked against the currently authorized identity.

Development mock authentication requires **both** `ADMIN_OTP_PROVIDER=mock` and `ALLOW_DEV_OTP=true`, and refuses to activate in `NODE_ENV=production`. It creates a random six-digit, five-minute code shown only for the configured demo number. This mock is intentionally not secure live authentication and must remain local/development-only.

For real OTP, set `ADMIN_OTP_PROVIDER=twilio`, `ALLOW_DEV_OTP=false`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` from a configured Twilio Verify service. Permit outbound HTTPS to `verify.twilio.com`. Twilio trial accounts may require verified recipients; configure local SMS requirements and spending limits in the provider account. No fallback to mock occurs when real OTP fails.

A successful verification consumes the challenge and creates a cryptographically random opaque session. Only a SHA-256 token hash is stored. Cookies are HttpOnly, SameSite=Strict, eight-hour lifetime, and Secure in production. Logout revokes the stored session. Knowledge of the admin phone number or an order UUID does not grant API or PDF access. Webhook signature/verification secrets are separate from admin sessions.

## Environment variables

See `.env.example` for an editable template. None of these values use `NEXT_PUBLIC_`.

| Variable                              | Purpose / default                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `DEV_DATA_FILE`                       | Local development JSON file; `.data/phase2.json` by default                     |
| `ADMIN_PHONE`                         | Pre-authorized +91 admin identity; no real-number default in server code        |
| `ADMIN_OTP_PROVIDER`                  | `mock` for explicit local testing or `twilio`; otherwise sign-in is unavailable |
| `ALLOW_DEV_OTP`                       | Must be `true` to enable the development OTP mock; ignored in production        |
| `TWILIO_ACCOUNT_SID`                  | Twilio account identifier for the real OTP adapter                              |
| `TWILIO_AUTH_TOKEN`                   | Secret Twilio API credential                                                    |
| `TWILIO_VERIFY_SERVICE_SID`           | Verify service identifier beginning with `VA`                                   |
| `WHATSAPP_PROVIDER`                   | `disabled` (server default), `mock` (development only), or `cloud`              |
| `WHATSAPP_PHONE_NUMBER_ID`            | Meta's numeric API sender ID                                                    |
| `WHATSAPP_ACCESS_TOKEN`               | Secret Meta access token                                                        |
| `WHATSAPP_API_VERSION`                | Supported Graph API version; default `v23.0`                                    |
| `WHATSAPP_TEMPLATE_NAME`              | Approved document-header template                                               |
| `WHATSAPP_TEMPLATE_LANGUAGE`          | Exact approved language code; default `en`                                      |
| `WHATSAPP_APP_SECRET`                 | Meta application secret for signed delivery webhooks                            |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`       | Your strong secret for Meta's GET verification challenge                        |
| `SITE_ORIGIN`                         | External origin used for mutation checks; set explicitly behind proxies         |
| `TRUST_PROXY_IP`                      | `false` unless the reverse proxy overwrites client IP headers                   |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Optional path to an existing Chromium for tests                                 |

The recipient, store name, contact, location, hours, and consent timestamp are development repository settings edited through the authenticated UI. Provider tokens are not stored in that settings object.

## Temporary storage and Phase 3

`src/server/repositories/interfaces.ts` defines `ProductRepository`, `InventoryRepository`, `OrderRepository`, `CustomerRepository`, `AuthRepository`, and `UnitOfWork`. Modular services depend on those contracts: `ProductService`, `InventoryService`, `CheckoutService`, `CashMemoService`, `WhatsAppService`, and `AdminAuthService`. Wiring is centralized in `src/server/container.ts`.

The file adapter uses an atomic file replacement, private permissions, and a process-global serialized transaction queue shared across Next.js route bundles. The memory adapter supports isolated tests. Both are development adapters. The app's default file adapter rejects runtime access in production. Data survives a local restart but is **not production-grade persistence**: no cross-process lock, multi-instance consistency, distributed rate limits, backup strategy, or disaster recovery. JSON stores the whole development dataset, including private customer records and base64 PDFs, so it is unsuitable for scale. Deleting the file resets data and reference numbering. Do not delete it casually or use the test path as real store data.

The current unit-of-work contract exposes a transactional working set with synchronous repository operations. A Phase 3 PostgreSQL adapter can materialize a scoped working set, track mutations, and atomically persist them, retaining the service logic. If moving to individually queried asynchronous repositories for scale, introduce asynchronous repository methods as a deliberate adapter-contract migration.

Before live operation, Phase 3 must provide database transactions, a unique idempotency constraint and memo sequence, concurrency-safe notification claims, persistent session/challenge stores and limits, an authorized PDF/object store, retention/backup policy, and queue/outbox recovery as needed. Keep stock mutations exclusive to the inventory service. Replace the development adapter at the composition root; do not remove the guard and run the JSON file in production.

Sample products/prices/counts, dummy local admin identity, plain sack illustrations, mock OTP, and mock WhatsApp remain development data. No real sender, recipient, store address, GST registration, or business contact was invented. No online payments, customer signup/password/OTP, automatic stock deductions/reservations, daily reports, nightly jobs, or unrelated analytics were added.

## Validation and limits

The backend suite checks trusted pricing and paise arithmetic, concurrent idempotency, stock visibility and validation, unchanged inventory after requests/status changes, atomic manual edits, product/category validation, OTP/session security and rate limits, production guards, PDF text/fonts/disclaimers, Cloud API payloads, ambiguous sends, retries, webhook status progression, and file adapter restart behavior.

Browser tests cover customer catalogue/cart/checkout, accurate mock results, server authorization and origin checks, admin sign-in, product and stock changes, categories/settings, PDF download controls, storage failures, error recovery, keyboard dialogs, Android-sized touch targets, responsive layouts, and automated WCAG AA checks. Automated accessibility checks do not replace assistive-technology review.

Live Meta and Twilio delivery cannot be verified without real configured services. The temporary datastore intentionally prevents this phase from being operated as a production store.
