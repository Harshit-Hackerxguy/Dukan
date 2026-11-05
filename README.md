# Dukan — wholesale store, Phase 3

PostgreSQL-backed catalogue, manual inventory, guest order requests, private cash memo PDFs, admin password sign-in, and manual bill sharing through WhatsApp. This branch combines the latest Phase 2 customer design, checkout, and Sanjay Store cash memo renderer with Phase 3 permanent database records.

## Business rules

- **Only explicit admin stock edits change inventory.** Checkout, PDFs, manual sharing, and order status updates never deduct or reserve stock.
- Public catalogue responses contain availability flags, never exact quantities. Quantities are checked when adding to a bag and again at checkout.
- Customers sign in before checkout with only name and mobile number. Numbers are normalized to E.164 but remain unverified. Matching a phone links requests; it grants no access to history.
- Orders preserve product, package, customer, price, and total snapshots. Cash memo bytes are immutable. Completed means explicitly marked completed by an admin, not electronic payment.
- No payment gateways, reservations, daily summaries, or timed reports.

## Local setup

Requires Node.js 22.13+ and PostgreSQL 16+. Use npm and a persistent PostgreSQL database.

```bash
cp .env.example .env
# Edit DATABASE_URL and APP_ORIGIN.
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `APP_ORIGIN` exactly as configured (including hostname and port). `/` is the storefront; `/admin` redirects unauthenticated users to `/admin-login`. The seed supplies six demo products with 100 packages each, with explicit development adjustment records. Seed runs are additive and do not overwrite prices or stock. **Do not use development stock in a real store.** New products created through the admin UI start at zero until an explicit stock edit.

Prisma uses its JavaScript query compiler with the PostgreSQL driver. The optional `PRISMA_CLI_JS=true` setting selects Prisma 6's experimental bundled WASM tooling for **development schema generation** when native downloads are blocked. Leave it unset in normal deployment environments. `npm run db:migrate` uses the stable PostgreSQL driver directly and does not depend on that experimental migration engine.

## Schema and migrations

`prisma/schema.prisma` defines admins/sessions/challenges, categories, products and independently stocked variants, inventory balances and adjustments, guest customers, immutable order items, cash memos, historical delivery attempts/outbox jobs, settings, audit logs, and persistent rate-limit buckets.

Money is stored as integer paise. Foreign keys preserve historical associations; archival replaces product deletion. PostgreSQL checks enforce valid stock and line amounts. Each stock edit checks a version number; stale edits reject the entire bulk transaction. Serializable transactions retry transient serialization conflicts.

`npm run db:migrate` applies ordered SQL migration files in a transaction, serializes runners using an advisory lock, verifies applied checksums, and records Prisma-compatible `_prisma_migrations` history. It refuses changed/incomplete migrations and never resets a database. Keep applied SQL immutable; add a forward migration for subsequent changes. Review future migrations for commands that cannot run inside a transaction. Do not run native Prisma migrations and this runner concurrently (their lock keys differ).

The initial migration includes explicit SQL constraints beyond Prisma's schema representation. Preserve them in later migrations. To create a subsequent schema migration in a development environment with native Prisma tooling, use `prisma migrate dev --create-only`, review its SQL, then apply using `npm run db:migrate`. Do not run `migrate reset` on existing data.

Production bootstrap creates only the admin and store settings, without demo products or stock:

```bash
npm run db:migrate
npm run db:bootstrap
npm run build
npm start
```

Keep `assets/fonts/` in deployment artifacts; Next.js output tracing includes the Noto font files used for English/Hindi PDFs. Their license is included. No background delivery worker or WhatsApp API credentials are required.

## Login and deployment configuration

Admins sign in at `/admin-login` with a mobile number and password. Only `+919973700894` and `+919308604097` are authorized. The password-login migration provisions the requested initial credentials as salted scrypt hashes, disables other admins and revokes old sessions. `db:bootstrap` preserves existing password hashes. Twilio, OTP endpoints, test-auth bypasses and SMS credentials have been removed.

Customers use the profile icon immediately to the right of the bag button to enter their name and phone number without verification. Browsing and bag edits remain public. Checkout requires a valid customer session, and the server takes the order name/phone from that session. These sessions do not verify phone ownership and grant no access to admin records or previous orders, even when an admin phone number is entered.

Set `DATABASE_URL`, `APP_ORIGIN` (the exact HTTPS site origin, without a trailing slash), and `NODE_ENV=production`. No `ADMIN_PHONE`, Twilio or WhatsApp environment variables are needed. Keep `TRUST_PROXY=false` unless the hosting proxy replaces client-supplied forwarded IP headers. Password attempts are rate limited. Session cookies are HttpOnly, SameSite=Strict, and Secure in production; only token hashes are stored, with an eight-hour expiry.

For Render, use build command `npm ci --include=dev && npm run build` and start command `npm run db:migrate && npm run db:bootstrap && npm start -- -p "$PORT"`. Use Node 22.13+ and a persistent PostgreSQL database. Existing deployments must stop the retired WhatsApp worker before upgrading. Run migrations before serving the new release; existing orders and PDF bytes are preserved. Do not run the development seed on production.

## Manual WhatsApp sharing

Inventory behavior and PDF layout are preserved. Checkout saves the order and immutable PDF together, without creating any delivery jobs. The existing customer receipt uses its manual-sharing status message. No WhatsApp Cloud API requests, webhooks, retry routes, worker scripts, recipient settings, or provider configuration remain active.

In Admin → Orders, **Download memo** and **Preview PDF** work as before. **Share on whatsapp** fetches the private PDF, starts its download, then opens the WhatsApp chat for the phone snapshot saved on that order. The admin attaches the downloaded PDF and sends it manually. A `wa.me` link cannot automatically attach local files or send messages.

Share links are derived from saved order numbers in international format, e.g. `https://wa.me/919876543210` (no `+`, spaces, or duplicate country code). Invalid historical numbers disable sharing without affecting PDF downloads. A blank tab is reserved during the click to avoid popup blockers and navigates only after a successful download request; failures close it. A direct **Open customer’s WhatsApp** link is also shown after download if the popup was blocked or closed. Browsers expose download initiation, not confirmation that a file has finished saving to disk.

When upgrading an existing deployment:

1. Stop and disable all old delivery worker processes/services before migration, and stop the old web release during the switch.
2. Run `npm run db:generate` and `npm run db:migrate`, then build and start the new web release.
3. Remove old WhatsApp API credentials and webhook subscriptions from deployment/provider configuration; no replacement credentials are needed.

The forward migration preserves existing order/PDF bytes and historical delivery records, makes unused delivery metadata optional, and retires pending/running outbox jobs. Historical tables are retained for audit and backup compatibility only; the application no longer uses them for delivery.

## Private cash memos and backups

PDFs are stored as PostgreSQL `bytea`, referenced by `db:cashMemo/<id>`. This keeps the PDF and order in one transaction and one backup. Only authenticated admin routes stream previews/downloads; guessing an ID or knowing a customer's phone never grants access. Document status is READY once checkout commits. English and Hindi use bundled Noto fonts, and original text remains in database snapshots.

Use encrypted database backups and restrict operator access. With credentials supplied through a protected PostgreSQL service file or `.pgpass` (not committed or printed):

```bash
# Custom-format backup includes schema, stock, audit trail, orders, and PDFs.
pg_dump --dbname=service=dukan --format=custom --file=dukan-backup.dump
# Restore into a NEW empty database. Never use --clean against the live database.
createdb --maintenance-db=service=dukan-maintenance dukan_restore_check
pg_restore --dbname=service=dukan-restore --exit-on-error --single-transaction dukan-backup.dump
```

Define `dukan-restore` to point to that new database. Verify row counts, representative memo previews, and stock adjustment history before any planned switchover. Do not restore or start the retired delivery worker. Revoke restored sessions if the backup may be old. For production recovery objectives, configure provider-managed point-in-time recovery/WAL archival, documented retention, and periodic restore drills. No destructive resets are part of setup or backup procedures.

Expired `RateLimit`, `OtpChallenge`, and `AdminSession` records can be removed by a trusted maintenance task after their expiry. Preserve orders, memos, stock adjustments, and audit history according to the store's retention policy. Backup storage grows with PDF volume.

## Verification

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run format:check
NEXT_TELEMETRY_DISABLED=1 npm run build
```

The memo unit tests require the Poppler `pdftotext` and `pdffonts` command-line tools (usually supplied by `poppler-utils`).

Use separate test databases. Tests refuse ordinary development/production database names and never reset databases:

```bash
# Create a fresh database whose name ends in _test, then set DATABASE_URL to it.
npm run db:migrate
npm run test:integration

# Create another database whose name ends in _e2e, then set DATABASE_URL to it.
# Use APP_ORIGIN=http://127.0.0.1:3000 and set TEST_ADMIN_PASSWORD to the configured admin password.
npm run db:migrate
npm run db:seed
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Install Chromium with `npx playwright install chromium` if needed. Browser tests use an isolated admin session fixture and separately exercise password and customer sign-in, unauthorized APIs, private PDFs, checkout, inventory, mobile layouts, and accessibility. Test data is retained in its isolated database; use a fresh test database for a clean suite run, or archive prior test products explicitly. Do not point a running dev server at a different database from the test runner.

Integration tests cover product/variant CRUD, manual adjustments, multi-row rollback, concurrent stock edits, hidden public quantities, price revalidation, concurrent idempotent checkout, PDF generation, historical snapshots, unchanged stock after checkout/status updates, absence of new delivery jobs, snapshot-based manual share links, repeat guest records, new-process persistence, password restrictions and session expiry, and archival.

Configure HTTPS and database backups on the production host.

## Integration with Phase 2

The latest Phase 2 changes are included in this branch: the compact storefront, plain sack illustrations, two-step checkout, shipping disclaimer, and centered Sanjay Store cash memo with its 11-point line-item table, bilingual fonts, pagination, and repeated table headers. The existing `CashMemoService` renders directly from database snapshots.

The temporary synchronous file repositories and their development routes are replaced by explicit asynchronous PostgreSQL queries in `src/server/catalogue.ts`, `orders.ts`, and `auth.ts`, sharing the serializable transaction boundary in `db.ts`. This is the deliberate asynchronous contract migration described in the Phase 2 notes; the JSON adapter is no longer used by an application route. Existing `.data/` files are left untouched. Review and migrate any real Phase 2 development records separately before selecting a live database.

Existing server configurations can still use the Phase 2 names `SITE_ORIGIN` and `TRUST_PROXY_IP`; the corresponding Phase 3 variable takes precedence when both are set. Old WhatsApp configuration is unused. Tests use TEST_ADMIN_PASSWORD only as input to the real password checks; it is not an authentication bypass.

`docs/phase2.md` and `docs/validation.md` are historical records. The setup and verification commands in this README describe the current PostgreSQL application. `npm run test:unit` verifies the preserved memo layout, currency, fonts, and multi-page rendering without a database.
