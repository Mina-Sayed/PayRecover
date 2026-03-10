# Security Review Checklist (Phase 1+2 Hardening)

Date: 2026-02-22
Scope: Authentication, API validation, user isolation, secrets handling, dependency scanning posture.

## 1) Auth and Session Handling

- [x] `next-auth` credentials flow verifies hashed password with `bcryptjs`.
- [x] JWT callback writes `token.id` and session callback hydrates `session.user.id`.
- [x] Middleware protects `/dashboard/*` and redirects authenticated users away from `/auth/*`.
- [x] Middleware avoids importing Node-only auth modules directly.

## 2) Input Validation and Error Contracts

- [x] Mutable endpoints validate payload shape and required fields:
  - `/api/auth/register`
  - `/api/invoices` and `/api/invoices/[id]`
  - `/api/reminders`
  - `/api/settings`
- [x] Invalid payloads return normalized error structure: `{ "error": string, "code"?: string }`.
- [x] Route handlers catch unexpected failures and return `INTERNAL_ERROR`.

## 3) User/Tenant Isolation

- [x] Invoice list/count/search uses `where.userId`.
- [x] Invoice mutation routes scope lookup by `id + userId` before update/delete.
- [x] Reminder update/delete routes scope by `userId`.
- [x] Settings read/write use authenticated `session.user.id`.

## 4) Secrets and Environment Safety

- [x] Required env guards added for:
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `AUTH_URL`
- [x] `.env.example` documents auth/db variables without real secrets.
- [x] No plaintext credentials committed in source changes.

## 5) Dependency and Supply Chain Risk

- [x] CI plan includes `npm audit --omit=dev --audit-level=high`.
- [x] CI plan includes Trivy filesystem scan (critical/high fail gate).
- [x] CI plan includes optional Snyk scan when `SNYK_TOKEN` is configured.

## 6) Open Risks / Deferred Scope

- [x] Tenant-owned provider credentials are encrypted at rest and stored through provider onboarding rather than app-wide env vars.
- [x] Paymob callback verification uses tenant-resolved HMAC secrets before reconciling invoice payment truth.
- [x] WATI webhook verification uses tenant-resolved webhook secrets before updating delivery state.
- [ ] Real WATI and Paymob sandbox payloads still need contract validation before pilot rollout.
- [x] Notification preferences are persisted on the tenant profile through the settings API.

## 7) UI Fetch Ordering Review (2026-02-24)

- [x] Invoice dashboard list fetches now ignore stale/out-of-order responses using request version checks.
- [x] Create-invoice flow now reloads with deterministic page targeting to prevent stale page data flashes.
- [x] No changes to auth/session logic, API access control, or tenant scoping boundaries.
- [x] No new secret handling paths introduced.

## 8) Invoice Timeline and Status Automation Review (2026-03-06)

- [x] Invoice status sync remains tenant-scoped through `userId` on both pending-to-overdue and overdue-to-pending updates.
- [x] Invoice event history writes include `userId` and `invoiceId`; they do not expose secrets or payment credentials.
- [x] Status recalculation does not override `paid` invoices.
- [x] Invoice update routes still validate ownership before mutating invoice, client, or invoice-event records.
- [x] UI timeline only renders server-returned scoped events; no client-generated audit entries are trusted.
- [ ] Webhook-sourced payment events are still deferred and will require signature verification before launch.

## 9) Provider Selection Review (2026-03-06)

- [x] Paymob has been selected as the first payment provider and will require HMAC callback validation before production rollout.
- [x] WATI has been selected as the first WhatsApp provider and will require webhook signature validation before production rollout.
- [x] Provider secrets are now tenant-owned, encrypted at rest, and kept server-side.
- [x] Provider verification now backfills eligible unpaid invoices so payment links and reminder runs do not depend on manual invoice edits after onboarding.
