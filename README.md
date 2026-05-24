# photos-delivery

Self-hosted client gallery delivery, built for working photographers. Drag-and-drop
upload, custom-slug gallery URLs, automatic rate-card-based invoicing with PDF
export and email send, OpenGraph previews, and full-gallery zip download.

Runs on Cloudflare Workers (Free tier compatible) using R2 for asset storage and
D1 for metadata. End-to-end deploy cost is roughly **$0–$5/month** for a typical
working photographer.

## Stack

- **Next.js 16** (App Router, Turbopack) deployed via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- **Cloudflare Workers** (runtime) + **R2** (asset storage, zero egress) + **D1** (SQLite metadata)
- **Cloudflare Image Transformations** for resize-on-demand (free tier: 5k unique transforms/mo)
- **pdf-lib** for invoice PDF generation
- **client-zip** for streaming full-gallery downloads
- **react-photo-album** for the justified-rows public gallery layout
- **Resend** for invoice email delivery
- **aws4fetch** for S3-compatible R2 multipart uploads (signed in Worker, browser
  uploads parts directly to R2)
- **Source Sans 3 / Source Code Pro** via `next/font`

## Features

- Admin dashboard (galleries, clients, invoices)
- Public client gallery with justified-rows grid, lightbox, keyboard nav, iOS
  "press and hold to save to Photos" UX
- Browser-direct multipart upload to R2 (no proxying through the Worker)
- Image variant pipeline: thumb (400px) and web (1600px) WebP, edge-cached via
  R2 + Cloudflare Cache API
- Optional per-gallery password (HMAC-signed cookie, multiple unlocked galleries
  per visitor)
- OpenGraph link previews using cover photo (lock icon for password-protected)
- Streaming zip download of full gallery
- Rate-card aware invoice generation (standard/hourly/day/double-day tiers +
  travel days), editable line items, PDF export
- Send invoices via Resend with PDF attachment, or "Mark as sent" for manual
  delivery (e.g. iMessage)
- Auto-refresh of draft/sent invoice line items when gallery shoot details change
- Mark-as-paid workflow

## Forking — what to customize

Three files cover everything specific to your business.

### 1. `src/config/site.ts`

Brand name, custom domain, business name + address (shown on invoices),
default payment terms.

### 2. `src/lib/rates.ts`

The rate card. Edit the `PACKAGES` object to match your standard set / hourly /
day / double-day pricing, and `TRAVEL_DAY_CENTS` if you have travel-day add-ons.

### 3. `public/logo.png`

Your brand mark (used in admin header, login page, public gallery footer, OG
image for password-protected galleries). Should be a transparent-background PNG;
`scripts/clean-logo.mjs` shows how to snap a 2-color logo to transparent if you
need it.

## Setup

Prerequisites: Node 20+, a Cloudflare account with R2 enabled.

```bash
git clone <your-fork> photos-delivery
cd photos-delivery
npm install

# Authenticate Wrangler
npm exec wrangler login

# Create remote resources (note their IDs — wrangler prints them)
npm exec wrangler d1 create photos-delivery
npm exec wrangler r2 bucket create photos-delivery-assets

# Edit wrangler.jsonc: paste your D1 database_id under d1_databases.
# Update the "routes" entry with your custom domain (or remove it for a
# *.workers.dev URL).

# Apply schema to D1
npm exec wrangler d1 migrations apply photos-delivery --local
npm exec wrangler d1 migrations apply photos-delivery --remote

# Apply CORS to your R2 bucket (edit r2-cors.json's AllowedOrigins to match your domain first)
npm exec wrangler r2 bucket cors set photos-delivery-assets --file r2-cors.json --force

# Create an R2 API token in the Cloudflare dashboard:
#   R2 → Manage R2 API Tokens → Create API token
#   - Permissions: Object Read & Write, scoped to your bucket
# Copy the Access Key ID and Secret Access Key — they only show once.

# Copy the env template and fill in your values
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set every value (see "Required env vars" below)
```

## Required env vars

| Name | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Single-user admin password |
| `SESSION_SECRET` | Long random string used to HMAC-sign admin + gallery cookies (`openssl rand -hex 32`) |
| `RESEND_API_KEY` | From resend.com — used to email invoices |
| `INVOICE_FROM_EMAIL` | The "From" address on invoice emails. Must be a verified sender in your Resend account, e.g. `"Your Name <invoices@yourdomain.com>"` |
| `BANK_ACCOUNT_NUMBER`, `BANK_ROUTING_NUMBER`, `BANK_NAME`, `BANK_ACCOUNT_TYPE` | Shown on the Terms section of generated invoice PDFs |
| `VENMO_PHONE` | Shown on the Terms section (Venmo / Apple Cash / Zelle) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | From the R2 API token you created |
| `R2_JURISDICTION_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |

For local dev these all live in `.dev.vars` (gitignored).

For production push them via:

```bash
npm exec wrangler secret put ADMIN_PASSWORD
# repeat for each variable, or use `wrangler secret bulk <json-file>`
```

## Local development

```bash
npm run dev
```

Open http://localhost:3000/admin/login and sign in with the value from `.dev.vars`.

Dev server uses a local D1 (`.wrangler/state/v3/d1/`) populated by the migrations
you ran above, and reads/writes to your **remote** R2 bucket via the S3-compatible
API. Uploads in dev land in real R2 — convenient for testing but watch your
storage usage.

## Deploy

```bash
npm run deploy
```

Builds with OpenNext and deploys to Cloudflare Workers. First deploy creates the
worker; subsequent deploys are incremental. Custom domain (from the `routes`
entry in `wrangler.jsonc`) is configured automatically if the zone is on
Cloudflare DNS and the hostname has no conflicting DNS records.

## Edge caching

For Workers Free tier (100k requests/day cap), set up a Cache Rule in the
Cloudflare dashboard so cached responses bypass the Worker entirely:

- Path matches `/img/*` or `/api/og/*` or `/_next/static/*`
- Cache eligibility: Eligible for cache
- Edge TTL: Use cache-control header from origin
- Browser TTL: Respect origin TTL

The app already returns `Cache-Control: public, max-age=31536000, immutable` on
variant routes; with this rule in place, repeat views of a popular gallery don't
count toward the Worker request quota.

## Image size limit

Cloudflare Image Transformations on the Free tier has a 10 MB input cap; in
practice the binding accepts JPEGs up to ~19 MB before rejecting. The upload UI
caps images at **18 MB** as a safety margin. Photos over that need to be
exported smaller (videos are unaffected).

## Project layout

```
src/
├── app/
│   ├── [slug]/                  Public gallery + unlock
│   ├── admin/                   Admin pages (galleries, clients, invoices)
│   ├── api/
│   │   ├── upload/              Browser → R2 multipart presigning + complete
│   │   ├── asset/[id]/          Original asset stream (with Range support)
│   │   ├── download/[id]/       Original asset, attachment Content-Disposition
│   │   ├── galleries/[slug]/zip/    Streamed full-gallery zip
│   │   ├── invoice/[id]/pdf/    Admin-only invoice PDF
│   │   └── og/locked/           OG image for password-protected galleries
│   └── img/[id]/[variant]/      Image variant pipeline (R2 cache → CF Images)
├── components/                  Client components (asset grid, upload, lightbox, etc.)
├── config/
│   └── site.ts                  Brand/domain/business config — EDIT THIS
└── lib/
    ├── rates.ts                 Rate card — EDIT THIS
    ├── invoice.ts               Preview/render orchestration
    ├── invoice-pdf.ts           pdf-lib invoice layout
    ├── r2.ts                    aws4fetch wrapper (multipart, get, put, delete)
    ├── auth.ts                  Admin session cookie
    ├── gallery-auth.ts          Per-gallery password unlock cookie
    ├── password.ts              PBKDF2 helpers via Web Crypto
    └── env.ts                   Typed access to Cloudflare bindings + secrets

db/migrations/                   D1 SQL migrations
public/
└── logo.png                     Brand mark — REPLACE WITH YOURS
```

## License

MIT — do whatever.
