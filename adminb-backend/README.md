# QFO Admin Backend (Vercel Functions)

Simple serverless backend for the admin dashboard and auth, deployed on Vercel. This README focuses on clear, step-by-step setup and usage.

## Quick Start

- Prerequisites: Node.js 18+, a Vercel account (optional for local), Stripe test keys (optional), and a terminal.
- Install dependencies: `npm install`
- Create `.env` (see below) at project root.
- Run locally (Express dev server): `node dev-server.js` (port defaults to `4001`)
- Or run serverless functions locally: `npm run dev` (if configured via Vercel CLI)
- Test an endpoint: open `http://localhost:4001/api/hello?name=Admin`

## Environment Setup

Create a `.env` file with the variables you need. Start with minimal values for local:

```
# Development basics
PORT=4001
DISABLE_AUTH=1               # Local only; bypasses verification
VERBOSE=1                    # Optional: enable extra logs

# JWT (used for local login/verify if external auth is not set)
JWT_SECRET=change-me-in-prod
JWT_EXPIRES_IN=7d
ALLOW_STUB_LOGIN=1           # Allow stub login locally (disable in prod)

# Stripe (optional; enables real dashboard data)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
# Optional product IDs when multiple prices exist per tier
STRIPE_PRO_PRODUCT_ID=prod_...
STRIPE_PREMIUM_PRODUCT_ID=prod_...

# External token verification (recommended for production)
USER_SERVICE_BASE_URL=https://your-user-service-url
USER_SERVICE_VERIFY_PATH=/api/auth/Verify
```

In production, set these in Vercel → Project Settings → Environment Variables. Do not use `DISABLE_AUTH=1` in production.

## Common Commands

- Run dev server (Express): `node dev-server.js`
- Run tests: `npm test`
- Run tests with coverage: `npm test -- --coverage`

## Key Endpoints

- `GET /api/hello` — simple health check with optional `name` query.
- `POST /api/auth/login` — stub login; returns a JWT for local development.
- `GET /api/auth/verify` — verifies the current admin token.
- `GET /api/dashboard` — returns dashboard metrics.
- `POST /api/webhooks/stripe` — handles Stripe events (set `STRIPE_WEBHOOK_SECRET`).

## Stripe Webhook (Optional)

- Configure a Stripe webhook endpoint to your deployment URL: `https://<project>.vercel.app/api/webhooks/stripe`.
- Recommended events:
  - `customer.subscription.created | updated | deleted`
  - `invoice.payment_succeeded | invoice.payment_failed`
  - `customer.created | customer.updated`
- Local testing via Stripe CLI:

```
stripe login
stripe listen --forward-to localhost:4001/api/webhooks/stripe
```

## Auth Modes

- External verification (recommended): set `USER_SERVICE_BASE_URL` and `USER_SERVICE_VERIFY_PATH`. Backend verifies tokens externally.
- Local JWT verification: omit external variables and use tokens from `/api/auth/login` with `JWT_SECRET`.
- Dev bypass: `DISABLE_AUTH=1` only in local development.

## Troubleshooting

- Unauthorized on `/api/dashboard` locally: set `DISABLE_AUTH=1` in `.env` OR pass a valid token in `Authorization: Bearer <token>` header.
- No Stripe data: configure `STRIPE_SECRET_KEY` or you will receive demo payloads for metrics.
- Security warnings: you may see warnings about default JWT secrets in logs; set real secrets in production.
