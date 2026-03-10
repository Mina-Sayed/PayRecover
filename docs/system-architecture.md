# PayRecover System Architecture

## 1. Purpose

PayRecover is currently implemented as a modular monolith focused on one business problem: orchestrating collections workflows for unpaid invoices. The system is responsible for invoice recovery state, reminder execution, payment-link attachment, callback reconciliation, and suppression of future reminders after confirmed payment.

## 2. What Exists Today

### User-facing surfaces

- Landing page for positioning and pricing
- Sign-up and sign-in flows
- Protected dashboard
- Overview page with aggregated financial stats
- Invoices workspace
- Reminder automation workspace
- Settings workspace

### Core entities

- `User`
- `Client`
- `Invoice`
- `ReminderTemplate`
- `MessagingProviderConnection`
- `PaymentProviderConnection`
- `PaymentLink`
- `PaymentEvent`
- `ReminderRun`
- `DeliveryAttempt`
- `Account`, `Session`, `VerificationToken` from NextAuth

### Core business rules already implemented

- Every business record is scoped to `session.user.id`
- Sign-up seeds four default reminder templates
- Invoices are generated with a per-user sequential `INV-YYYY-NNN` number
- Client records are reused by `userId + phone`
- Invoice status can be `pending`, `overdue`, or `paid`
- Marking an invoice as `paid` sets `paidAt`
- Provider connections are tenant-owned rather than shared across the app
- Payment links are attached per invoice through a tenant payment connection
- Reminder runs and delivery attempts are stored separately from reminder templates
- Dashboard stats aggregate outstanding, paid-this-month, active reminders, and total invoices

## 3. Runtime Architecture

```mermaid
flowchart LR
    Visitor[Visitor / Authenticated User]
    UI[Next.js App Router UI]
    Middleware[Next.js Middleware]
    API[Route Handlers under app/api]
    Auth[NextAuth Credentials + JWT Session]
    Domain[lib/* Validation, Sequencing, UI State Helpers]
    Prisma[Prisma Client]
    DB[(PostgreSQL)]

    Visitor --> UI
    UI --> Middleware
    Middleware --> UI
    UI --> API
    API --> Auth
    API --> Domain
    API --> Prisma
    Prisma --> DB
    Auth --> Prisma
```

## 4. Module Boundaries

| Layer | Current responsibility | Main files |
| --- | --- | --- |
| Presentation | Pages, layouts, client-side state, forms, loading/error UX | `app/**`, `app/components/**` |
| Delivery/API | Auth, validation, CRUD route handlers, response shaping | `app/api/**` |
| Application helpers | Validation, invoice numbering, auth redirect logic, client fetch wrapper | `lib/**` |
| Persistence | Prisma client and schema | `lib/prisma.ts`, `prisma/schema.prisma` |
| Security gate | Redirect unauthenticated users away from dashboard routes | `middleware.ts`, `lib/middleware-auth.ts` |
| Quality layer | Unit and integration tests | `tests/**` |

## 5. End-to-End Flows

### 5.1 Sign-up and first dashboard access

```mermaid
sequenceDiagram
    actor User
    participant SignupUI as /auth/signup
    participant RegisterAPI as POST /api/auth/register
    participant Prisma as Prisma
    participant DB as PostgreSQL
    participant NextAuth as Credentials Sign-In
    participant Dashboard as /dashboard

    User->>SignupUI: Submit name, email, password
    SignupUI->>RegisterAPI: JSON payload
    RegisterAPI->>Prisma: Check existing user by normalized email
    Prisma->>DB: Read user
    RegisterAPI->>Prisma: Create user + default reminder templates
    Prisma->>DB: Persist records
    SignupUI->>NextAuth: Auto sign-in with credentials
    NextAuth->>Prisma: Load user + verify password
    SignupUI->>Dashboard: Navigate after successful session
```

### 5.2 Auth enforcement

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant MW as middleware.ts
    participant JWT as next-auth/jwt

    User->>Browser: Request /dashboard/*
    Browser->>MW: Incoming request
    MW->>JWT: Resolve token using AUTH_SECRET
    alt No valid token
        MW-->>Browser: Redirect to /auth/signin
    else Valid token
        MW-->>Browser: Continue to route
    end
```

### 5.3 Invoice create/edit/pay/delete flow

```mermaid
sequenceDiagram
    actor User
    participant InvoiceUI as /dashboard/invoices
    participant InvoiceAPI as /api/invoices or /api/invoices/[id]
    participant Auth as auth()
    participant Prisma as Prisma
    participant DB as PostgreSQL

    User->>InvoiceUI: Create or edit invoice
    InvoiceUI->>InvoiceAPI: Send validated form payload
    InvoiceAPI->>Auth: Resolve session
    Auth-->>InvoiceAPI: user.id
    InvoiceAPI->>Prisma: Find or create scoped client
    InvoiceAPI->>Prisma: Generate next invoice number if creating
    InvoiceAPI->>Prisma: Update or delete scoped invoice
    Prisma->>DB: Persist changes
    InvoiceAPI-->>InvoiceUI: Return invoice JSON
    InvoiceUI-->>User: Refresh list + toast feedback
```

### 5.4 Reminder sequence management

```mermaid
sequenceDiagram
    actor User
    participant ReminderUI as /dashboard/reminders
    participant ReminderAPI as /api/reminders
    participant Prisma as Prisma
    participant DB as PostgreSQL

    User->>ReminderUI: Add, edit, toggle, or delete reminder
    ReminderUI->>ReminderAPI: POST, PUT, or DELETE
    ReminderAPI->>Prisma: Scope operations by session user
    Prisma->>DB: Persist reminder template changes
    ReminderAPI-->>ReminderUI: Return success JSON
```

### 5.5 Dashboard overview load

```mermaid
sequenceDiagram
    actor User
    participant OverviewUI as /dashboard
    participant StatsAPI as GET /api/dashboard/stats
    participant Prisma as Prisma
    participant DB as PostgreSQL

    User->>OverviewUI: Open dashboard
    OverviewUI->>StatsAPI: Fetch stats
    StatsAPI->>Prisma: Aggregate outstanding, paid this month, reminder count, invoice count
    Prisma->>DB: Execute aggregate queries
    StatsAPI-->>OverviewUI: Return stats + recent invoices
    OverviewUI-->>User: Render cards, chart, and recent items
```

## 6. Business Flow Summary

1. A business owner creates an account.
2. The system seeds a starter reminder sequence.
3. The owner creates client-linked invoices.
4. The owner monitors outstanding balances and paid invoices.
5. The owner configures reminder timing and templates.
6. The owner connects tenant-owned messaging and payment provider accounts.
7. The system materializes reminder runs, creates one active primary payment link, dispatches due reminders, reconciles provider callbacks, and suppresses future reminders after verified payment.

## 7. Current Strengths

- Clear tenant isolation in route handlers
- Consistent input validation and normalized error responses
- Good MVP coverage for auth, invoices, reminders, settings, and helper logic
- UI already supports loading states, retry states, toasts, dialogs, and mobile sidebar navigation
- Prisma schema is small and understandable

## 8. Current Gaps and Architectural Debt

### Product gaps

- Provider onboarding is real for one messaging provider and one payment provider only
- The first live loop exists in code but still needs real sandbox verification with WATI and Paymob accounts
- Dashboard trend chart is synthetic, not backed by historical event data
- Notification preferences are local component state only
- SMS remains configuration-only; WhatsApp is the only live dispatch path targeted in M1

### Data model gaps

- No role/team model for multi-user businesses
- No dispute model
- No partial-payment allocation model

### Operational gaps

- Internal cron dispatch exists, but real deployment, monitoring, and failure alerting are still required
- Webhook receiver routes exist, but provider payloads still need validation against real sandbox traffic
- No observability pipeline for outbound delivery, payment conversion, or failures
- No background reconciliation jobs beyond the current first-loop dispatcher

## 9. Recommended Next Architecture Step

Keep the current modular monolith for the next stage and harden the existing first live loop before adding breadth:

- validate WATI and Paymob contracts with real tenant sandbox accounts
- deploy the internal cron dispatcher with secure secret handling and monitoring
- add pilot-ready logging and alerting around send failures, callback rejection, and suppression
- keep provider ownership tenant-scoped; do not move back toward shared provider infrastructure
- add event-backed analytics only after the live loop is trusted
