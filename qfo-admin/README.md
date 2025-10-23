# QFO Admin (React + Vite)

Admin dashboard frontend. This README gives simple steps to run locally and connect to the backend.

## Quick Start

- Prerequisites: Node.js 18+, npm.
- Install dependencies: `npm install`
- Copy `.env.example` to `.env` and set values (see below).
- Run dev server: `npm run dev`
- Open `http://localhost:5173`

## Environment

Create `.env` with minimal values to work locally:

```
# Backend API base URL; for local Express dev server
VITE_API_BASE_URL=http://localhost:4001

# Unified login URL for your app (used by ProtectedRoute)
VITE_MYAPP_LOGIN_URL=http://localhost:3000/login

# Optional: bypass ProtectedRoute in dev (not recommended in prod)
VITE_DEV_BYPASS_AUTH=false
```

Notes:
- If using a proxy, you can keep requests relative (e.g., `/api/...`). Otherwise set `VITE_API_BASE_URL` to your backend.
- `ProtectedRoute` expects a token in `localStorage` under `qfo_token`. You can also pass `?token=...` once; it will store and clean the URL.

## Common Scripts

- `npm run dev` — start Vite dev server.
- `npm run build` — build production assets.
- `npm run preview` — preview the production build locally.
- `npm run lint` — run ESLint.

## Pages & Routes

- `/admin` — admin dashboard (protected).
- `/admin/terms` — manage terms.
- `/admin/newsletter` — manage newsletter.

Routing is defined in `src/app/routes.jsx` and gate-kept by `src/routes/ProtectedRoutes.jsx`.

## Troubleshooting

- Redirected to login: set `VITE_MYAPP_LOGIN_URL` in `.env` and ensure a `qfo_token` exists.
- API calls failing: check `VITE_API_BASE_URL` or proxy settings; confirm backend is running.
- UI not loading: re-install deps (`rm -rf node_modules && npm install`) and retry `npm run dev`.
