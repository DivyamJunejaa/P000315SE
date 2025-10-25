# Stripe Backend (Vercel Functions)

Lightweight serverless APIs for Stripe integration: create checkout sessions, read/update subscriptions, and cancel subscriptions.

## Quick Start

- Prerequisites: Node.js 18+, Stripe account (test mode), Stripe CLI, Vercel CLI (optional).
- Install dependencies: `npm install`
- Create `.env` at project root (see example below).
- Run locally with Vercel dev: `vercel dev` (recommended)
- Or use any serverless runtime that supports `@vercel/node` handlers.

## Environment

Create `.env` with at least:

```
STRIPE_SECRET_KEY=sk_test_...
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
FRONTEND_ORIGIN=http://localhost:5173
```

- `STRIPE_SECRET_KEY` enables real Stripe calls; without it, APIs return config errors.
- `ALLOWED_ORIGINS` controls CORS; include your frontend origin(s).
- `FRONTEND_ORIGIN` helps the checkout flow build correct redirect URLs.

## Available Endpoints

- `POST /api/payment/create-checkout-session` — creates a Checkout Session.
- `POST /api/payment/update-subscription` — sync details from Stripe (by `session_id` or `subscription_id`).
- `POST /api/payment/cancel-subscription` — cancels a subscription (by `subscription_id` or all for a user).
- `GET|POST /api/payment/get-subscription` — fetch minimal subscription info.
- `GET /api/health` — simple health check.
- `GET /api/hello?name=World` — demo hello endpoint.

## Test Webhooks & Sessions

- Stripe CLI (forward events to a deployed URL or local dev):

```
stripe login
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

- Checkout testing: use Stripe test cards (e.g., `4242 4242 4242 4242`).

## Development Tips

- CORS: update `api/utils/cors.ts` or `ALLOWED_ORIGINS` to match your local frontend.
- Errors: APIs return clear JSON messages when `STRIPE_SECRET_KEY` is missing or an operation fails.
- Tests: run `npm test` or `npm run test:coverage`.

## Deployment

- Deploy on Vercel. Set env vars under Project Settings. Ensure your frontend uses the deployed API URL.
- Configure a Stripe webhook endpoint to your Vercel URL if you add webhook handlers.
