# LogicGate Workers

Cloudflare Workers API for the LogicGate industrial asset platform and public-facing websites. Built with [Hono](https://hono.dev/) and TypeScript, backed by Cloudflare D1 and R2.

## Overview

This is the currently deployed public API behind `https://api.scottdotm.com`. It handles:

- Public forms and landing pages (`/api/v1/public/inquiries`, `/api/v1/public/contact`, `/api/v1/public/plans`).
- NDAA scan ingestion and retrieval (`/api/v1/public/ndaa-scan`).
- Lake survey report rendering (`/api/v1/public/lake-report/:inquiryId`).
- Image uploads to R2 (`/api/v1/public/uploads`).
- Resend email webhook events (`/api/v1/webhooks/resend`).
- Admin endpoints for inquiries, tokens, and scans.

## Quick Start

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Lint
npm run lint

# Run locally with Wrangler
npm run dev
```

## Wrangler Configuration

`wrangler.toml` defines the Worker, the D1 database (`DB`), and the R2 bucket (`UPLOADS`).

The production domain is configured as a custom domain route:

```toml
[[routes]]
pattern = "api.scottdotm.com"
zone_name = "scottdotm.com"
custom_domain = true
enabled = true
```

## Environment Secrets

Set these with `wrangler secret put <NAME>` in production:

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend email API key |
| `FROM_EMAIL` | Verified sender address |
| `ADMIN_EMAIL` | Destination for inquiry notifications |
| `ADMIN_API_KEY` | Bearer token for `/api/v1/public/admin/*` endpoints |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret (`whsec_...`) |

## Public Variables

| Variable | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins; `*` is rejected at runtime |

## Database

The D1 schema is in `src/db/schema.sql`. Run it against your D1 database to create tables for inquiries, uploads, NDAA scans, and email events.

## Deploy

```bash
npm run deploy
```

## Endpoints

### Public
- `GET /api/v1/public/health`
- `POST /api/v1/public/inquiries`
- `POST /api/v1/public/contact`
- `GET /api/v1/public/plans`
- `GET /api/v1/public/demo-report`
- `GET /api/v1/public/lake-report/:inquiryId`
- `POST /api/v1/public/ndaa-scan`
- `GET /api/v1/public/ndaa-scan/:id`
- `GET /api/v1/public/ndaa-scan/:id/report`
- `POST /api/v1/public/uploads`

### Admin (requires `Authorization: Bearer <ADMIN_API_KEY>`)
- `GET /api/v1/public/admin/inquiries`
- `POST /api/v1/public/admin/inquiries/:id`
- `GET /api/v1/public/admin/ndaa-scans`
- `GET /api/v1/public/admin/ndaa-tokens`
- `POST /api/v1/public/admin/ndaa-tokens`

### Webhooks
- `POST /api/v1/webhooks/resend` — Resend email event webhook (signed with `RESEND_WEBHOOK_SECRET`)
