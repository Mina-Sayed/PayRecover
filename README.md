# PayRecover

PayRecover is a Next.js SaaS MVP for small MENA businesses that need to recover unpaid invoices through structured reminder workflows. The current codebase already supports account registration, credential-based sign-in, protected dashboard routes, invoice and client management, reminder template management, and business profile settings.

## Current Product Scope

- Public marketing landing page at `/`
- Auth flow at `/auth/signup` and `/auth/signin`
- Protected dashboard at `/dashboard`
- Invoice list, search, filter, pagination, create, edit, mark-as-paid, and delete flows
- Reminder template CRUD for WhatsApp and SMS sequences
- Business profile settings read/update flow

Deferred scope still visible in the UI:

- Live WhatsApp delivery through WATI
- Provider-managed message-status webhooks
- Paymob payment onboarding
- Payment links and webhooks
- Persistent notification preferences
- Historical analytics beyond aggregate snapshots

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript (`strict`)
- NextAuth v5 beta with credentials provider
- Prisma 7 with PostgreSQL
- Tailwind CSS 4
- Motion (`motion/react`)
- Vitest + Testing Library

## Project Structure

```text
app/
  api/                       Route handlers for auth, invoices, reminders, settings, dashboard stats
  auth/                      Sign in and sign up pages
  components/                Shared UI primitives and dashboard shell components
  dashboard/                 Protected dashboard screens
lib/                         Auth, Prisma, validation, API helpers, state helpers
prisma/                      Prisma schema and migrations
tests/unit/                  Pure logic tests
tests/integration/           Route and UI interaction tests
docs/                        Architecture, security, spec, and milestone docs
```

## Environment Variables

Required by the running application:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma |
| `AUTH_SECRET` | Yes | NextAuth signing secret |
| `AUTH_URL` | Yes | Base application URL for NextAuth |
| `PAYMOB_PUBLIC_KEY` | Planned | Paymob hosted checkout public key |
| `PAYMOB_SECRET_KEY` | Planned | Paymob server-side secret key |
| `PAYMOB_INTEGRATION_ID` | Planned | Paymob integration identifier |
| `PAYMOB_HMAC_SECRET` | Planned | Paymob callback signature validation |
| `WATI_API_BASE_URL` | Planned | WATI API host/base URL |
| `WATI_ACCESS_TOKEN` | Planned | WATI API access token |
| `WATI_WEBHOOK_SECRET` | Planned | WATI webhook signature validation |

The provider variables are documented now so the next rollout can wire Paymob and WATI without another config cleanup pass.

## Local Development

1. Install dependencies with `npm install`
2. Copy `.env.example` and set at least `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`
3. Run the app with `npm run dev`

## Commands

- `npm run dev` starts the development server
- `npm run lint` runs ESLint
- `npm run test` runs the Vitest suite once
- `npm run build` builds the production bundle
- `npm run start` runs the built app

Recommended validation baseline:

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev --audit-level=high
```

## Core API Surface

- `POST /api/auth/register`
- `GET /api/dashboard/stats`
- `GET|POST|PATCH /api/invoices`
- `PATCH|DELETE /api/invoices/[id]`
- `GET|POST|PUT|DELETE /api/reminders`
- `GET|PUT /api/settings`
- `GET|POST /api/auth/[...nextauth]`

## Current Documentation

- [`docs/system-architecture.md`](docs/system-architecture.md)
- [`docs/product-spec.md`](docs/product-spec.md)
- [`docs/implementation-plan.md`](docs/implementation-plan.md)
- [`docs/milestones.md`](docs/milestones.md)
- [`docs/adr-001-current-application-architecture.md`](docs/adr-001-current-application-architecture.md)
- [`docs/security-review-checklist.md`](docs/security-review-checklist.md)
