# CAS ERP

Invoicing, debtors, creditors, inventory and stock control for **Caveman Architectural Studios** (Durban). Built phone-first so the studio can be run entirely from a mobile — and installs to the home screen like an app.

**Stack:** Next.js 16 (App Router, Server Actions) · TiDB via Prisma 7 · Better Auth · Tailwind CSS 4 · Aceternity-style UI (Motion) · Recharts · Zod

## What's in it

| Area | Features |
|---|---|
| **Dashboard** | Sales this month vs last, owed to you / you owe, stock value, 12-month sales vs purchases chart, debtors aging, "needs attention" (overdue invoices, bills due this week, low stock), project pipeline, top clients, activity feed |
| **Invoicing** | Draft → issue (permanent sequential number, stock deducted) → record payment → paid. Void with reason (stock returned). A4 PDF, share via WhatsApp/email with banking details |
| **Quotes** | Draft, sent, accepted/declined, one-tap convert to invoice |
| **Debtors** | Customer balances, overdue, credit limits, aging, statements (PDF), receipts with allocation to invoices (oldest-first or manual), credit on account, tap-to-call/WhatsApp/email |
| **Creditors** | Supplier bills (draft → post), supplier payments with allocation, aging, balances |
| **Inventory** | Stock items and services, reorder levels and low-stock alerts, weighted-average cost on purchases, adjustments/stock-takes with reasons, full stock card per item |
| **Projects** | Stage-based (Discovery → Concept → Development → Delivery), fee vs billed vs received, linked quotes and invoices |
| **Reports** | VAT201 summary (output vs input VAT), cash in/out, sales by client, spend by category, stock valuation, CSV exports for the accountant |
| **Settings** | Company details & banking, document numbering, users & roles, two-factor, signed-in devices, audit log |

## Security

- **No public sign-up.** The owner creates accounts; passwords are 12+ characters and checked against known breaches (Have I Been Pwned, k-anonymity).
- **Two-factor (TOTP) required** for Owner, Admin and Accountant — they are sent to set it up before they can do anything else. Backup codes, 30-day trusted devices.
- **Rate limiting** in the database: 5 sign-in / 2FA attempts per minute.
- **Role-based access** (Owner, Admin, Accountant, Staff, Read-only), enforced on the server in every page, server action and export, not just hidden in the UI.
- **Sessions checked against the database on every request**, so blocking a user or changing their role takes effect immediately. Users can see and sign out their other devices.
- **Audit log** of every sign-in and every change (who, what, when, IP). Issued documents are never edited or deleted, only voided with a reason.
- **Strict headers:** nonce-based Content-Security-Policy, HSTS, `frame-ancestors 'none'`, no-sniff, strict referrer, locked-down permissions policy. Secure, HTTP-only, SameSite cookies.
- All input validated with Zod; money is calculated in integer cents and stored as `DECIMAL`; stock and payment updates run in database transactions with atomic counters. CSV exports are protected against formula injection.

## Running it

```bash
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate            # creates the tables in TiDB
npm run db:seed               # company profile + owner account (prints the password)
npm run build && npm start
```

For local development any MySQL 8 / MariaDB works too: `npm run dev`. Set `SEED_DEMO=true` before seeding to load sample customers, invoices, bills and stock.

### TiDB Cloud

1. Create a cluster (Serverless is fine) and a database called `cas_erp`.
2. **Connect → General** gives you the host, user and password. Put them in `DATABASE_URL` (port `4000`). TLS turns on automatically for `*.tidbcloud.com`.
3. `npm run db:migrate` applies the migrations in `prisma/migrations`. Create new migrations against a local database with `npm run db:migrate:dev` (it needs a shadow database), then deploy them to TiDB with `db:migrate`.

### Deploying

Any Node 20+ host works (Vercel, Railway, Render, a VM). Set the variables from `.env.example`, with `BETTER_AUTH_URL` set to the public HTTPS URL. On his phone, open the site and choose **Add to Home Screen**: it runs full-screen like a native app.

## Project layout

```
prisma/                 schema, migrations, seed
src/app/(app)/          signed-in pages (dashboard, invoices, debtors, …)
src/app/login/          sign-in and two-factor
src/app/print/          A4 invoice, quote and statement pages (Save as PDF)
src/app/api/            auth handler, CSV exports
src/server/             server actions (all mutations) and queries
src/lib/                auth, db, roles/permissions, money maths, validation
src/components/         UI kit, Aceternity-style effects, app shell, feature components
src/proxy.ts            CSP nonce + sign-in redirect (Next 16 "proxy", formerly middleware)
```

### About the UI library

The components in `src/components/aceternity/` (Spotlight, grid background, card spotlight, moving border, text generate, hover grid, animated numbers) follow [Aceternity UI](https://ui.aceternity.com)'s copy-paste pattern: Motion + Tailwind, owned in the repo and themed to the CAS brand (charcoal, warm paper, copper; Sora and DM Sans from the company profile).
