# Dukan — wholesale store, Phase 3

PostgreSQL-backed catalogue, manual inventory, guest order requests, private cash memo PDFs, admin OTP sign-in, and a durable WhatsApp delivery queue. The supplied repository contained the Phase 1 UI, so this change also adds the missing checkout, PDF, delivery, and authentication services while retaining the storefront and product editor design.

## Business rules

- **Only explicit admin stock edits change inventory.** Checkout, PDFs, WhatsApp delivery, and order status updates never deduct or reserve stock.
- Public catalogue responses contain availability flags, never exact quantities. Quantities are checked when adding to a bag and again at checkout.
- Guest customers provide only name and mobile number. Numbers are normalized to E.164 but remain unverified. Matching a phone links requests; it grants no access to history.
- Orders preserve product, package, customer, price, and total snapshots. Cash memo bytes are immutable. Completed means explicitly marked completed by an admin, not electronic payment.
- No payment gateways, customer accounts, reservations, daily summaries, or timed reports.

## Local setup

Requires Node.js 22.13+ and PostgreSQL 16+. Use npm and a persistent PostgreSQL database.

```bash
cp .env.example .env
# Edit DATABASE_URL, APP_ORIGIN, ADMIN_PHONE, and WHATSAPP_RECIPIENT.
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
# In a second process, using the same environment:
npm run worker
```

Open `APP_ORIGIN` exactly as configured (including hostname and port). `/` is the storefront; `/admin` redirects unauthenticated users to `/admin-login`. The seed supplies six demo products with 100 packages each, with explicit development adjustment records. Seed runs are additive and do not overwrite prices or stock. **Do not use development stock in a real store.** New products created through the admin UI start at zero until an explicit stock edit.

For local testing only, `.env` can set `ALLOW_TEST_AUTH=true` and a six-digit `TEST_OTP`. The bypass is ignored when `NODE_ENV=production`. Never enable it on a shared development server or reuse development sessions/database in production. No OTP bypass is exposed by an API.

Prisma uses its JavaScript query compiler with the PostgreSQL driver. The optional `PRISMA_CLI_JS=true` setting selects Prisma 6's experimental bundled WASM tooling for **development schema generation** when native downloads are blocked. Leave it unset in normal deployment environments. `npm run db:migrate` uses the stable PostgreSQL driver directly and does not depend on that experimental migration engine.

## Schema and migrations

`prisma/schema.prisma` defines admins/sessions/challenges, categories, products and independently stocked variants, inventory balances and adjustments, guest customers, immutable order items, cash memos, delivery attempts, outbox jobs, settings, audit logs, and persistent rate-limit buckets.

Money is stored as integer paise. Foreign keys preserve historical associations; archival replaces product deletion. PostgreSQL checks enforce valid stock and line amounts. Each stock edit checks a version number; stale edits reject the entire bulk transaction. Serializable transactions retry transient serialization conflicts.

`npm run db:migrate` applies ordered SQL migration files in a transaction, serializes runners using an advisory lock, verifies applied checksums, and records Prisma-compatible `_prisma_migrations` history. It refuses changed/incomplete migrations and never resets a database. Keep applied SQL immutable; add a forward migration for subsequent changes. Review future migrations for commands that cannot run inside a transaction. Do not run native Prisma migrations and this runner concurrently (their lock keys differ).

The initial migration includes explicit SQL constraints beyond Prisma's schema representation. Preserve them in later migrations. To create a subsequent schema migration in a development environment with native Prisma tooling, use `prisma migrate dev --create-only`, review its SQL, then apply using `npm run db:migrate`. Do not run `migrate reset` on existing data.

Production bootstrap creates only the admin and store settings, without demo products or stock:

```bash
npm run db:migrate
npm run db:bootstrap
npm run build
npm start
# Supervise separately with systemd, a container service, or a process manager:
npm run worker
```

Keep `assets/fonts/` in deployment artifacts; Next.js output tracing includes the Noto font files used for English/Hindi PDFs. Their license is included. A persistent Node.js worker is required for queue processing; merely serving Next.js does not send queued messages. `npm run worker:once` processes one eligible job for diagnostics.

## Admin OTP and security configuration

Configure Twilio Verify:

1. Create an SMS-enabled Verify service and configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` on the server.
2. Set `ADMIN_PHONE` to the authorized number in E.164 format and run `npm run db:bootstrap`.
3. Set `APP_ORIGIN` to the exact HTTPS production origin. Confirm SMS delivery and verification with the real admin number.
4. Keep test auth disabled. Sessions last eight hours; only token hashes are stored. Cookies are HttpOnly, SameSite=Strict, and Secure in production. Sign-out revokes the session.

OTP requests and verification attempts are rate limited in PostgreSQL. Challenges expire after five minutes and allow at most five guesses. Important admin operations are audited. Every admin API checks authorization server-side; the admin layout also checks it. Mutations require an exact Origin match. API responses containing personal data and private PDFs are not cached.

`TRUST_PROXY=false` uses conservative shared rate limits. Set it to true **only** behind a reverse proxy that strips client-supplied `X-Forwarded-For` and writes the actual address. Configure HTTPS, request-body limits, and network access to PostgreSQL at deployment. Use a dedicated runtime database user with only required table/sequence permissions, and a separate migration identity. Do not expose database credentials or provider secrets through `NEXT_PUBLIC_*` variables.

Changing the WhatsApp recipient in Settings requires a fresh OTP for the existing authorized admin. Already recorded memos keep their original recipient. To rotate the admin identity, a trusted operator must update `ADMIN_PHONE` in protected server configuration and run:

```bash
npm run db:bootstrap -- --rotate-admin
```

This disables prior admins, revokes their sessions, and records an audit event. Restart web/worker processes with the updated configuration. Configure and test OTP access for the new number before ending the operator's recovery access.

## WhatsApp setup and delivery behavior

The implementation uses Meta's WhatsApp Cloud API:

1. Configure a business phone number and server-side `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and a supported `WHATSAPP_API_VERSION`.
2. Create and obtain approval for a template with **one document header and no body parameters**. Set its name in `WHATSAPP_TEMPLATE` and language in `WHATSAPP_TEMPLATE_LANGUAGE`.
3. Obtain the recipient's WhatsApp consent, configure the admin recipient, and verify template delivery under your Meta account's restrictions.
4. Configure the webhook callback as `https://your-origin/api/webhooks/whatsapp`, with `WHATSAPP_VERIFY_TOKEN` and the Meta app's `WHATSAPP_APP_SECRET`. Subscribe to message statuses. POST payloads are authenticated with HMAC-SHA256 over the original body.
5. Run `npm run worker` continuously and monitor failures and queue age. The worker uploads the PDF as private provider media; no public PDF URL is needed.

Checkout commits the order, PDF, and outbox job together. A provider failure cannot undo the order. Workers claim jobs with `FOR UPDATE SKIP LOCKED`; retries never create new orders. A successful send response means **submitted**, not delivered. Signed callbacks advance sent/delivered states without accepting older statuses as regressions. Attempts retain recipient, timestamp, provider message ID, response status/error summary, and error information; access tokens are never logged.

Known pre-send upload failures and explicit throttling can retry with capped exponential backoff (five attempts). Timeouts/5xx at message submission, or a worker crash during delivery, leave an **uncertain** record instead of automatically risking a duplicate. An admin must check WhatsApp/provider records and explicitly acknowledge the duplicate risk before retrying. The provider does not offer an end-to-end exactly-once guarantee. Delayed callbacks are correlated using the attempt ID in `biz_opaque_callback_data`.

## Private cash memos and backups

PDFs are stored as PostgreSQL `bytea`, referenced by `db:cashMemo/<id>`. This keeps the PDF and order in one transaction and one backup. Only authenticated admin routes stream previews/downloads; guessing an ID or knowing a customer's phone never grants access. Document status is READY once checkout commits. English and Hindi use bundled Noto fonts; unsupported writing systems are represented with fallback question marks in PDFs while original text remains in database snapshots.

Use encrypted database backups and restrict operator access. With credentials supplied through a protected PostgreSQL service file or `.pgpass` (not committed or printed):

```bash
# Custom-format backup includes schema, stock, audit trail, orders, and PDFs.
pg_dump --dbname=service=dukan --format=custom --file=dukan-backup.dump
# Restore into a NEW empty database. Never use --clean against the live database.
createdb --maintenance-db=service=dukan-maintenance dukan_restore_check
pg_restore --dbname=service=dukan-restore --exit-on-error --single-transaction dukan-backup.dump
```

Define `dukan-restore` to point to that new database. Verify row counts, representative memo previews, and stock adjustment history before any planned switchover. Keep the restored worker stopped to avoid re-sending old pending jobs. Reconcile outbox state before enabling delivery. Revoke restored sessions if the backup may be old. For production recovery objectives, configure provider-managed point-in-time recovery/WAL archival, documented retention, and periodic restore drills. No destructive resets are part of setup or backup procedures.

Expired `RateLimit`, `OtpChallenge`, and `AdminSession` records can be removed by a trusted maintenance task after their expiry. Preserve orders, memos, stock adjustments, and audit history according to the store's retention policy. Backup storage grows with PDF volume.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Use separate test databases. Tests refuse ordinary development/production database names and never reset databases:

```bash
# Create a fresh database whose name ends in _test, then set DATABASE_URL to it.
npm run db:migrate
npm run test:integration

# Create another database whose name ends in _e2e, then set DATABASE_URL to it.
# Use APP_ORIGIN=http://127.0.0.1:3000 and the test-only admin/OTP values.
npm run db:migrate
npm run db:seed
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

Install Chromium with `npx playwright install chromium` if needed. Browser tests use an isolated admin session fixture and separately exercise the OTP UI, unauthorized APIs, private PDFs, checkout, inventory, mobile layouts, and accessibility. Test data is retained in its isolated database; use a fresh test database for a clean suite run, or archive prior test products explicitly. Do not point a running dev server at a different database from the test runner.

Integration tests cover product/variant CRUD, manual adjustments, multi-row rollback, concurrent stock edits, hidden public quantities, price revalidation, concurrent idempotent checkout, PDF generation, historical snapshots, unchanged stock after checkout/status/delivery, failure/retry records, signed webhook transitions, repeat guest records, new-process persistence, OTP restrictions/expiry/reuse, and archival.

Live Twilio SMS and Meta WhatsApp calls have not been verified without real credentials. Production deployment, provider permissions, webhook reachability, HTTPS configuration, and a production backup/restore drill must be configured and verified before treating this as a live service.
