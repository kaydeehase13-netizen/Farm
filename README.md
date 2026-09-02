# FarmLedger

**Farm all year. Be ready at tax time.**

FarmLedger is a farm financial recordkeeping, field-management, custom-work,
and tax-organization application. This repository contains the web
application (Next.js 16 / TypeScript / Tailwind v4), the Postgres schema for
the shared backend (Supabase), and the export/report engine.

FarmLedger organizes your farm's financial and tax information. **It does
not file tax returns or make definitive tax-law determinations.** Wherever
the app flags something, it uses language like *"Potential Tax
Opportunity"* or *"This may require tax-professional review"* — never
*"you qualify"* or *"this will save you $X."* Always confirm tax treatment
with a qualified tax professional.

---

## What's in this build

This first pass delivers the **full-featured web application** end to end —
every module from the spec (Home, Money, Fields, Work, More, Tax Center,
Reports, CPA Portal) is real, interactive, and backed by genuine
create/read/update logic, not a static mockup. The mobile app (Expo /
React Native) is architected in `ARCHITECTURE.md` but not yet scaffolded —
see **Roadmap** below.

### Two data layers — read this first

The app is written against a small repository interface
(`src/lib/data/repo.ts`) with **two interchangeable implementations**:

1. **Demo data layer** (`src/lib/data/store.ts`) — a JSON file
   (`.data/db.json`) seeded with a realistic "Mohler Farms" dataset. This is
   what runs **out of the box** with zero configuration, so every screen,
   calculation, and Excel export is genuinely functional the moment you
   `npm install && npm run dev`. It persists across requests during local
   development. **It does NOT work reliably on Netlify** (serverless
   functions have an ephemeral/read-only filesystem) — writes there succeed
   for that one request and vanish on the next cold start.
2. **Supabase (Postgres)** — the real, permanent, multi-user backend. Once
   you set the `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `SUPABASE_SERVICE_ROLE_KEY` env vars (see `.env.example`) and run the
   migrations in `supabase/migrations/`, this is what should back
   production. Wiring `repo.ts`'s functions to Supabase queries instead of
   the JSON store is the main remaining implementation task — the schema,
   RLS policies, and TypeScript types are all in place for it.

**In short: click around locally right now and everything works. Deploy to
Netlify without connecting Supabase and data entry will not persist.**

---

## Getting this running

### 1. Local development

```bash
cd web
npm install
cp .env.example .env.local   # fill in what you have; OPENAI_API_KEY is the only one needed for full demo functionality
npm run dev
```

Open http://localhost:3000 — you'll land on the Home dashboard for the
seeded "Mohler Farms" demo account. Every module is live: add a receipt,
log a spray application, create a customer job, generate an invoice, export
the CPA workbook.

### 2. Push to GitHub

```bash
git remote add origin https://github.com/<you>/<repo>.git
git add -A
git commit -m "Initial FarmLedger build"
git push -u origin main
```

### 3. Deploy to Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** and
   pick this repo.
2. Netlify auto-detects `netlify.toml`, which points at
   `@netlify/plugin-nextjs` — this gives you full Server Actions / API
   route support (not just static export).
3. Add the environment variables from `.env.example` under **Site settings
   → Environment variables** (at minimum `OPENAI_API_KEY`; add the
   `SUPABASE_*` ones once you've created a project — step 4).
4. Deploy. Every push to `main` redeploys automatically.

### 4. Connect Supabase (required for real, persistent, multi-user data)

1. Create a project at https://supabase.com.
2. In the SQL Editor, run the three files in `supabase/migrations/` **in
   order** (`0001_core_schema.sql`, `0002_rls.sql`,
   `0003_reference_data.sql`). Together they create every table in the ERD,
   turn on Row Level Security scoped to farm membership, and seed reference
   data (crops, job services, Schedule‑F-aligned tax categories, starter
   tax-opportunity rules).
3. Copy the Project URL, `anon` key, and `service_role` key from **Settings
   → API** into `.env.local` (and into Netlify's environment variables).
4. Create a Storage bucket named `documents` for receipts/attachments.
5. Swap the demo repository functions in `src/lib/data/repo.ts` for
   Supabase queries (the shape of every function — inputs, return types —
   is already defined by the current implementation, so this is a
   backend-only swap; no UI changes needed).

---

## Architecture

See `ARCHITECTURE.md` for the full design: database ERD, offline mobile
sync strategy, the tax-rule engine (facts vs. classification vs. tax rules
are strictly separated — see below), CPA portal, Excel/PDF export
architecture, bank/accounting integrations, and security/backup posture.

### The tax-rule engine, briefly

A transaction **never** permanently stores a tax determination. The schema
separates:

- **Fact** — `transaction` ("Tractor purchased for $385,000 on 2026-02-14")
- **Classification** — `asset` / `farm_category` ("Farm equipment")
- **Tax rule** — `tax_rule` / `tax_rule_version` ("Section 179 review, as of
  tax year 2026") — versioned so rules can be updated yearly **without**
  touching historical facts
- **Tax opportunity** — `tax_opportunity` links a fact to a rule version
  with a status (`open` / `info_needed` / `ready_for_cpa` / `dismissed`)
  and a list of missing information/documents — never a treatment
  assertion.

---

## Roadmap (not yet built)

- **Mobile app (Expo/React Native)** — architecture defined in
  `ARCHITECTURE.md`; not scaffolded in this pass. Shares the same Supabase
  backend, auth, and TypeScript domain types (`src/types/domain.ts`) once
  built, per the "one shared system" requirement.
- **Offline sync queue** for mobile field data entry (WatermelonDB or a
  custom outbox table + conflict resolution, per `ARCHITECTURE.md`).
- **Live bank/credit-card import** (Plaid) — the schema
  (`bank_connection`, `bank_import_transaction`) and the Money → Banking
  screen are in place; the live connection flow is not wired to a real
  Plaid account.
- **QuickBooks-style accounting export/import** — architecture only.
- **PDF report generation** (Year-End CPA Organizer, printable field
  reports) — the Excel export engine is complete; PDF generation via
  `@react-pdf/renderer` or similar is the next deliverable.
- **Supabase Storage wiring** for receipt/document file uploads (currently
  recorded as metadata in the demo layer).

## Tech stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 ·
ExcelJS (Excel exports) · Supabase (Postgres + Auth + Storage, when
connected) · OpenAI (`gpt-4o-mini` vision for receipt OCR, chat for the AI
farm assistant) — both entirely optional; the app degrades to manual entry
without an API key.
