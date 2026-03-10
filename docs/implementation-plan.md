# PayRecover Implementation Plan

## 1. Delivery Strategy

Deliver the product as a collections workflow engine, not as a wider invoicing or ERP platform. The current monolith already contains the first live-loop primitives, so the plan is to harden that loop before expanding feature breadth.

## 2. Current Delivery Focus

### M1: First live recovery loop hardening

- keep provider ownership tenant-scoped
- verify one WATI connection and one Paymob connection per tenant
- create or refresh one active primary payment link per unpaid invoice
- materialize reminder runs from active WhatsApp templates
- dispatch due reminder runs through the internal cron endpoint
- validate provider callbacks and reconcile invoice payment truth
- suppress future reminder runs after confirmed payment
- keep invoice timeline and operator state auditable

### M1 exit criteria

- a tenant can connect WATI and Paymob accounts in settings
- existing unpaid invoices get operational artifacts after provider verification
- reminder sends, payment callbacks, and suppression state are visible in the product
- no UI claims live behavior that is only placeholder logic

## 3. Immediate Workstreams

### Workstream A: Provider onboarding correctness

- keep encrypted tenant-owned provider credentials
- verify provider connectivity before marking the connection usable
- backfill eligible unpaid invoices after successful verification
- expose truthful provider state in settings

### Workstream B: Recovery loop correctness

- ensure one active primary payment link per invoice/provider connection
- keep reminder templates as configuration and reminder runs as execution history
- keep payment truth sourced only from validated callbacks or manual mark-paid actions
- suppress unsent reminder runs immediately after successful payment reconciliation

### Workstream C: Pilot operations

- deploy cron dispatch with `CRON_SECRET`
- validate real WATI and Paymob sandbox payloads
- add monitoring and alerting around send failures and rejected callbacks
- keep normalized logs and error responses on operational endpoints

## 4. Next Milestone After M1

### M2: Operator usability and event-backed visibility

- better operator exception states for failed sends and failed payments
- import/bulk workflows for existing receivables
- event-backed analytics instead of aggregate-only snapshots
- onboarding guidance for provider setup and template readiness

## 5. Guardrails

- do not add shared cross-tenant provider infrastructure
- do not drift into generic accounting, CRM, or ERP scope
- do not infer payment state from messaging state
- keep every mutable operation tenant-scoped
- add unit and integration coverage with each business-rule change
- validate security-sensitive behavior with real provider payloads before pilot rollout

## 6. Recommended Immediate Backlog

1. Validate WATI and Paymob sandbox payloads end to end.
2. Deploy and monitor the internal reminder-dispatch cron path.
3. Expand operator exception handling for failed sends and failed payments.
4. Deepen event-backed reporting after pilot traffic exists.
