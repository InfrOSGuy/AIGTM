# AIGTM

Internal AI-assisted GTM / lead generation tool for Cloudculate.
Integrates with Gmail, HubSpot, and Slack. See
[`docs/SCOPE.md`](docs/SCOPE.md) for the feature roadmap and
[`docs/SECURITY.md`](docs/SECURITY.md) for the security model — read
that one before deploying anywhere.

## Structure

```
apps/api    Fastify + TypeScript backend (OAuth, webhooks, scoring, sync)
apps/web    Vite + React admin dashboard
packages/shared  Types shared between api and web
```

## Setup

1. `cp .env.example .env` and fill in every value — see the comments in
   that file for where each credential comes from. The API refuses to
   start if anything required is missing.
2. `npm install`
3. `npm run prisma:generate --workspace apps/api`
4. Point `DATABASE_URL` at a real Postgres instance, then run migrations
   (once a first migration exists: `npx prisma migrate dev --schema
   apps/api/prisma/schema.prisma`).
5. `npm run dev:api` and, in another terminal, `npm run dev:web`.

## Commands

- `npm run typecheck` / `npm run test` / `npm run build` — run across
  all workspaces.
- `npm run dev:api` / `npm run dev:web` — run a single app in watch mode.

## First login

The dashboard has one user: you. Set `ADMIN_API_TOKEN` in `.env`, then
sign in with that value at the dashboard's login screen — it's
exchanged for a short-lived session cookie, never stored in the browser
directly.
