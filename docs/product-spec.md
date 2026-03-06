# PayRecover Product Spec

## 1. Product Thesis

PayRecover should become a payment-recovery operating system for service SMBs in MENA, not just an invoice tracker. The strongest wedge is combining invoice ownership, localized reminder automation, and payment-link conversion in one workflow.

## 2. Primary Users

| Persona | Need | Current support | Gap |
| --- | --- | --- | --- |
| Clinic owner | Recover consultation and treatment balances | Invoices, reminders, settings | No live sending, no payment links |
| Gym manager | Follow up on recurring unpaid memberships | Invoices and reminder templates | No subscription logic, no team support |
| Coach / freelancer | Send polite reminders without manual chasing | Basic invoice + reminder flow | No branded payment journey |

## 3. Product Goals

- Reduce time spent manually chasing payments
- Increase paid-on-time rate
- Provide high-trust, low-friction payment collection
- Fit MENA-first channels and payment preferences
- Keep onboarding simple enough for non-technical operators

## 4. Target Functional Scope

### 4.1 Accounts and onboarding

- Keep email/password authentication for MVP
- Add onboarding checklist after first sign-up
- Ask for business type, country, currency, WhatsApp sender number, and preferred payment provider
- Seed reminder templates by business vertical and language

### 4.2 Invoice and client management

- Add editable invoice notes, service type, and internal tags
- Add invoice status automation based on due date and payment events
- Add client timeline showing invoice, reminder, and payment events
- Add bulk actions for mark paid, resend, export, and archive

### 4.3 Reminder automation engine

- Convert reminder templates into executable automation rules
- Use WATI as the first WhatsApp delivery provider
- Support schedules such as pre-due, due-day, and post-due escalation
- Add quiet hours, country-aware working days, and retry rules
- Add template preview with real variable interpolation
- Track every send attempt, provider response, and delivery-status webhook
- Support WATI checkout-button templates for payment collection inside WhatsApp

### 4.4 Payments

- Generate payment links per invoice
- Implement Paymob first using intention creation, hosted checkout, and callback verification
- Keep the payments domain abstract enough for future providers after Paymob
- Record payment events and reconcile invoice status automatically
- Handle partial payments and failed payments
- Add secure Paymob callback verification and replay protection

### 4.5 Analytics

- Replace synthetic charting with event-backed metrics
- Show recovery rate, time-to-payment, reminder-to-payment conversion, and overdue aging
- Break metrics down by channel, template, country, and business type

## 5. UI/UX Enhancement Spec

### Dashboard

- Replace generic overview with action-oriented widgets:
  - invoices due today
  - overdue by aging bucket
  - reminders scheduled next 24 hours
  - failed delivery/payment exceptions
- Make chart filters explicit: date range, status, channel
- Add a true activity feed

### Invoices workspace

- Promote it into the main operational screen
- Add saved views: `Needs Follow-up`, `Due Today`, `Payment Failed`, `Paid Recently`
- Add row-level quick actions without opening menus for common tasks
- Add invoice detail drawer with timeline and payment link status
- Add CSV import for legacy client lists

### Reminders workspace

- Show automation stages as a visual timeline instead of a plain list
- Add drag-and-drop stage ordering
- Add per-stage preview and test-send mode
- Add template presets by tone:
  - polite
  - assertive
  - final notice

### Settings workspace

- Split settings into:
  - business profile
  - messaging providers
  - payment providers
  - team and permissions
  - compliance and branding
- Keep provider states explicit: `not connected`, `sandbox`, `live`

### Localization

- Add Arabic and English support
- Support RTL layouts
- Localize currencies, dates, and messaging defaults by country

## 6. Business Logic Enhancements

### Collections logic

- Auto-classify invoices by aging bucket: `due soon`, `due today`, `1-7 overdue`, `8-30 overdue`, `30+ overdue`
- Escalate reminder tone by aging and payment history
- Suppress reminders after a payment event or an active dispute
- Add client-level risk score using lateness, reminder count, and prior recovery time

### Revenue logic

- Track recovery funnel:
  - invoice created
  - reminder sent
  - reminder delivered
  - payment link opened
  - payment completed
- Attribute revenue to reminder channel and template version
- Support plan limits by invoice volume, sends, and integrations

### Commercial logic

- Free plan: dashboard + manual invoice management
- Growth plan: live reminders + one payment provider
- Pro plan: analytics, automation rules, team access, multi-country templates

## 7. Non-Functional Requirements

- All mutable operations must remain tenant-scoped
- All provider secrets must stay server-side
- Webhooks must be signed and idempotent
- Background jobs must be retryable and observable
- Audit logs should exist for payment and reminder state changes
- Core flows need unit, integration, and provider-contract tests

## 8. Success Metrics

- Activation: first invoice created within 15 minutes of sign-up
- Automation adoption: at least one live reminder flow enabled
- Recovery: uplift in paid invoices within 7 days
- Conversion: payment-link click-through and completion rate
- Retention: weekly active businesses and recurring invoice volume

## 9. Out of Scope for the Immediate Next Milestone

- Native mobile apps
- AI-generated payment recovery messaging beyond template assistance
- Deep accounting integrations
- Full multi-tenant enterprise admin controls
