# Dukan — wholesale order requests

Phase 2 extends the existing Next.js 16 / React / TypeScript app. It retains the green, cream, and white design, replaces browser-owned catalogue data with server APIs, and adds checkout, cash memo PDFs, WhatsApp adapters, and authenticated store management.

**This is a development implementation. PostgreSQL is intentionally deferred to Phase 3. The temporary repositories refuse production runtime requests.** No payments, customer accounts, automatic stock deductions, or reservations are implemented.

## Run

Node.js 22.13+ and npm are required.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The catalogue uses six sample products. At `/admin`, the explicitly labeled development admin number is `+919999999999`; a random mock code appears after requesting sign-in. No SMS or WhatsApp message is sent by the mock providers. Change the pre-authorized identity and provider configuration before connecting real services.

Product and order data are stored in `.data/phase2.json`, a private, ignored local development file. Browser storage contains only the shopping bag. A new product starts with zero stock: set its count in `/admin/inventory` before accepting requests for it.

See [the Phase 2 guide](docs/phase2.md) for APIs, configuration, security boundaries, WhatsApp template instructions, and the Phase 3 database integration contract.

## Verify

```bash
npm run typecheck
npm run lint
npm run test:unit
npm test
npm run build
```

The unit PDF assertions use Poppler's `pdftotext` and `pdffonts` commands (`poppler-utils` on Debian/Ubuntu). Install Chromium for Playwright with `npx playwright install chromium`, or use an installed browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

The browser suite launches its own development server on port 3100 with isolated data at `work/browser-test-data.json`. It never edits `.data/phase2.json`. A production build is supported for validation; `npm start` deliberately cannot use development persistence or mock OTP. Connect the Phase 3 adapters before production operation.
