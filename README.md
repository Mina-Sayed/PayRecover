# PayRecover

PayRecover is a Next.js SaaS for small MENA businesses that need to recover unpaid invoices through structured reminder workflows. The product is a collections workflow engine, not a generic invoicing app or shared provider infrastructure layer.

## Current Product Scope

- Public marketing landing page at `/`
- Auth flow at `/auth/signup` and `/auth/signin`
- Protected dashboard at `/dashboard`
- Invoice list, search, filter, pagination, create, edit, mark-as-paid, and delete flows
- Reminder template CRUD for WhatsApp and SMS sequences
- Business profile settings read/update flow
- Tenant-owned WATI and Paymob connection onboarding
- Internal reminder dispatch endpoint and provider webhook handlers

Current M1 live-loop status:

- Payment-link creation, reminder-run materialization, reminder dispatch, and webhook reconciliation exist in code
- Provider connections are tenant-owned and encrypted at rest
- Notification preferences are persisted on the tenant profile
- The loop is still not pilot-proven until real WATI and Paymob sandbox traffic is validated end to end
- Historical analytics beyond aggregate snapshots remain deferred

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
| `CRON_SECRET` | Yes for live reminders | Authenticates the internal reminder-dispatch endpoint |
| `PROVIDER_CONFIG_SECRET` | Yes for tenant-owned providers | Encrypts provider credentials stored per tenant |

Provider credentials are tenant-owned and stored through provider-connection onboarding in the product. `PAYMOB_*` and `WATI_*` are no longer the mainline application configuration model for live tenant orchestration.

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
