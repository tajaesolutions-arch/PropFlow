# PropFlow Launch Audit

## Audit date
2026-05-06

## Current application status
PropFlow is currently a strong Supabase-first MVP foundation with real authentication, multi-workspace architecture, role-based routing, workspace-scoped queries, and operational modules for properties, cleaning, maintenance, bookings, leases, and calendar operations.

The application is not fully production-ready for public paid SaaS launch yet.

---

# Systems currently implemented

## Authentication and workspace foundation
- Real Supabase Auth login/signup
- No demo login in production UI
- Workspace creation flow
- Invite/code-based workspace join flow
- Role-based routing
- Suspended-account routing
- Workspace-scoped data loading
- RLS-based backend access control

## Operational foundation
- Properties
- Property detail pages
- Cleaning tasks
- Maintenance work orders
- Calendar operations view
- Bookings foundation
- Lease foundation
- Contacts foundation
- File upload foundation
- Activity log foundation
- Notification table foundation

## Dashboards
- PropFlow Admin dashboard route
- Workspace Owner dashboard route
- Property Manager / Host dashboard route
- Property Owner dashboard route
- Cleaner dashboard route
- Maintenance dashboard route
- Accountant dashboard route

---

# Systems not fully production-ready yet

## Billing
Status: placeholder

Missing:
- Stripe checkout
- Stripe customer portal
- Subscription enforcement
- Grace-period enforcement
- Payment failure recovery
- Billing webhooks

## Notifications automation
Status: partially implemented

Missing:
- Resend email integration
- Twilio SMS integration
- Twilio WhatsApp integration
- Scheduled reminders/jobs
- Notification preferences
- Real provider delivery status

## Reports
Status: placeholder

Missing:
- PDF exports
- CSV exports
- Owner statements
- Financial exports
- Scheduled reports

## Direct booking tools
Status: not implemented

Missing:
- Public booking pages
- Stripe guest payments
- Booking request flow
- Public property pages
- Booking approval flow

## Supplies / inventory
Status: placeholder

Missing:
- Real inventory table
- CRUD UI
- Low-stock alerts
- Inventory tracking

## QA and testing
Status: not implemented

Missing:
- ESLint
- Automated tests
- E2E tests
- CI validation

---

# Risks identified

1. Public repository
- Verify secrets are never committed.
- Verify Vercel environment variables are configured securely.

2. Missing automated tests
- Runtime regressions are possible.

3. Placeholder routes
- Billing, reports, guest CRM, and inventory are not launch-complete.

4. No backend automation layer yet
- Notification providers and Stripe webhooks still need backend/serverless implementation.

5. Build validation still required
- npm install
- npm run build
- deployment smoke test
- Supabase migration verification
must still be run in a real execution environment.

---

# Recommended next implementation order

1. Launch stability + build validation
2. Supplies / inventory module
3. Stripe billing foundation
4. Notification provider foundation
5. Direct booking MVP
6. Reporting/export system
7. Automated testing and CI

---

# Required production validation before launch

- Verify all Supabase migrations are applied.
- Verify all RLS policies work with real users.
- Verify file uploads use private storage buckets.
- Verify no service role keys exist in frontend code.
- Verify all protected routes redirect correctly.
- Verify suspended users cannot access workspace data.
- Verify workspace isolation between customers.
- Verify Vercel production environment variables.
- Verify Stripe sandbox flow.
- Verify mobile responsiveness.
- Verify loading/error/empty states.
- Verify no sample/demo data appears in production.
