# ADR-001: Keep PayRecover as a Modular Next.js Monolith

- Status: Accepted
- Date: 2026-03-06

## Context

The current codebase already implements:

- Next.js App Router UI
- Route handlers in the same repository
- NextAuth credential-based authentication
- Prisma-backed PostgreSQL persistence
- middleware-based auth redirects
- a small, cohesive domain centered on invoices, reminders, and settings

The product is still missing live reminder delivery, payment links, webhooks, and event-backed analytics. Those are meaningful expansions, but the present scale does not justify splitting frontend, API, workers, and provider adapters into multiple deployable systems yet.

## Decision

Keep PayRecover as a modular monolith for the next product stage:

- continue using Next.js App Router for UI and route handlers
- keep Prisma as the single persistence access layer
- keep authentication in NextAuth
- add new domains behind clear modules and provider abstractions
- introduce background execution as a bounded subsystem, not as a full platform rewrite

## Why this is the right choice now

- The current domain is small enough to evolve safely in one codebase.
- Tenant-scoped business logic is easier to reason about when reads and writes stay close together.
- Delivery speed matters more than infrastructure separation at this stage.
- Payments and reminder execution can be added through ports/adapters without premature service sprawl.

## Alternatives considered

### 1. Split frontend and backend now

Rejected because:

- it increases deployment, auth, and contract overhead too early
- current product complexity does not need separate services

### 2. Move heavily to provider-specific BaaS logic

Rejected because:

- messaging and payment providers will need abstraction
- tight provider coupling would slow future regional expansion

### 3. Introduce microservices for reminders and payments immediately

Rejected because:

- there is no real event volume yet
- operability cost would exceed product value at this stage

## Consequences

Positive:

- simpler team cognition
- faster iteration
- easier end-to-end testing
- cleaner reuse of validation, auth, and tenant-scoping code

Negative:

- background jobs and webhooks must be added carefully to avoid overloading the web app boundary
- modular discipline must be maintained as new provider integrations arrive

## Follow-up actions

- add explicit modules for reminders, payments, and analytics
- define provider interfaces before implementing live integrations
- introduce event tables before building advanced analytics
