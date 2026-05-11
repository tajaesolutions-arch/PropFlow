# PropFlow Security QA Checklist

Date: 2026-05-11
Status: Manual security QA checklist

This document tracks security-sensitive launch checks for PropFlow. It is written for manual review and non-destructive testing.

## 1. Security goals

PropFlow must protect customer data by enforcing:

- Workspace-scoped data access.
- Role-based page visibility.
- Database-backed row-level security.
- Private file/document access.
- Server-only payment provider secrets.
- Safe billing recovery access.
- Plan-limit enforcement beyond frontend UI.

## 2. Critical files and areas

Frontend access control:

- `src/routes/AppRouter.jsx`
- `src/lib/AppContext.jsx`
- `src/lib/auth.js`
- `src/data/constants.js`

Supabase and app data loading:

- `src/lib/supabase.js`
- `src/lib/activityLogs.js`
- `src/lib/billingStatus.js`
- `src/lib/planLimits.js`

High-sensitivity pages:

- `src/pages/AdminDashboardPage.jsx`
- `src/pages/BillingPage.jsx`
- `src/pages/SettingsPage.jsx`
- `src/pages/FilesPage.jsx`
- `src/pages/ReportsPage.jsx`
- `src/pages/ExpensesPage.jsx`
- `src/pages/NotificationsPage.jsx`
- `src/pages/JoinWorkspacePage.jsx`
- `src/pages/SuspendedPage.jsx`

Database and backend:

- `supabase/migrations/*`
- Stripe checkout backend function
- Stripe webhook backend function
- Stripe customer portal backend function
- Any serverless/API routes

## 3. Table access review checklist

Review these tables in Supabase and confirm private customer data is scoped by workspace or a direct permitted relationship.

- [ ] `profiles`
- [ ] `workspaces`
- [ ] `workspace_members`
- [ ] `workspace_invites`
- [ ] `properties`
- [ ] `property_assignments`
- [ ] `bookings`
- [ ] `leases`
- [ ] `cleaning_tasks`
- [ ] `maintenance_work_orders`
- [ ] `contacts` / guests
- [ ] `expenses`
- [ ] `supplies`
- [ ] `owner_reports`
- [ ] `report_exports`
- [ ] `notifications`
- [ ] `notification_preferences`
- [ ] `notification_delivery_logs`
- [ ] `notification_provider_settings`
- [ ] `activity_logs`
- [ ] `file_uploads`
- [ ] `direct_booking_pages`
- [ ] `direct_booking_requests`
- [ ] subscription/billing table
- [ ] billing events table
- [ ] calendar import tables

## 4. Role access expectations

### PropFlow Admin

- [ ] Can access platform admin area.
- [ ] Does not appear as a customer workspace role.
- [ ] Customer users cannot create this role.

### Workspace Owner / Company Admin

- [ ] Can manage workspace settings.
- [ ] Can manage billing.
- [ ] Can invite/manage team members.
- [ ] Can access operational pages.
- [ ] Can access activity logs for their workspace.

### Property Manager

- [ ] Can manage operational records if intended.
- [ ] Cannot access platform admin area.
- [ ] Billing controls are limited according to product rules.

### Host

- [ ] Can access operational hosting workflows.
- [ ] Cannot access platform admin area.
- [ ] Cannot access team/billing controls unless intentionally allowed.

### Accountant

- [ ] Can access finance/reporting areas.
- [ ] Cannot broadly edit operational records unless intentionally allowed.
- [ ] Billing recovery access is clear if allowed.

### Property Owner

- [ ] Can see assigned properties only.
- [ ] Finance data is limited to allowed owner reporting.
- [ ] Cannot edit core operations unless intentionally allowed.

### Cleaner

- [ ] Can see assigned cleaning tasks only.
- [ ] Cannot access billing.
- [ ] Cannot access broad finance/reports.
- [ ] Cannot access unrelated properties.

### Maintenance

- [ ] Can see assigned work orders only.
- [ ] Cannot access billing.
- [ ] Cannot access broad finance/reports.
- [ ] Cannot access unrelated maintenance jobs.

## 5. Workspace boundary manual checks

Set up two test workspaces:

- Workspace A
- Workspace B

Use different test users for each workspace.

Checklist:

- [ ] Workspace A user sees only Workspace A properties.
- [ ] Workspace B user sees only Workspace B properties.
- [ ] Workspace A user sees only Workspace A bookings.
- [ ] Workspace B user sees only Workspace B bookings.
- [ ] Workspace A user sees only Workspace A reports.
- [ ] Workspace B user sees only Workspace B reports.
- [ ] Workspace A user sees only Workspace A activity logs.
- [ ] Workspace B user sees only Workspace B activity logs.
- [ ] Workspace A user sees only Workspace A notifications.
- [ ] Workspace B user sees only Workspace B notifications.
- [ ] Workspace A files are not visible in Workspace B.
- [ ] Workspace B files are not visible in Workspace A.

## 6. Dynamic route checks

For any route that uses a record ID, confirm the app handles unauthorized or missing records with a clean state.

- [ ] Property detail route.
- [ ] Booking detail route, if present.
- [ ] Cleaning task detail route, if present.
- [ ] Maintenance detail route, if present.
- [ ] Owner report detail route, if present.
- [ ] File/document route, if present.
- [ ] Public direct booking route.

Expected behavior:

- The app does not show private data from another workspace.
- The app shows a clean not-found/no-access message.
- The app does not reveal unnecessary internal database details.

## 7. Invite and team access checks

- [ ] Company/workspace code requires a matching invite.
- [ ] Invite email must match the logged-in user.
- [ ] Expired invites cannot be accepted.
- [ ] Revoked invites cannot be accepted.
- [ ] Customer users cannot invite platform admin roles.
- [ ] Cleaner/Maintenance/Property Owner role invites require assigned properties.
- [ ] Team member suspension is visible in UI.
- [ ] Suspended users cannot access workspace data.
- [ ] Lower roles cannot manage team members unless intentionally allowed.

## 8. Billing and Stripe checks

- [ ] Stripe secret key is server-only.
- [ ] Stripe webhook secret is server-only.
- [ ] Supabase service role key is server-only.
- [ ] Frontend uses only safe public environment variables.
- [ ] Checkout endpoint validates user and workspace role.
- [ ] Customer portal endpoint validates user and workspace role.
- [ ] Webhook validates Stripe signature.
- [ ] Billing recovery remains available to Workspace Owner.
- [ ] Lower roles cannot open Stripe portal.
- [ ] Missing Stripe config returns clean error.

## 9. Plan-limit checks

- [ ] Property limit is enforced by UI.
- [ ] Property limit is enforced by database/backend logic.
- [ ] Team member limit is enforced by UI.
- [ ] Team member limit is enforced by database/backend logic.
- [ ] Owner report monthly limit is enforced by UI.
- [ ] Owner report monthly limit is enforced by database/backend logic.
- [ ] Direct booking plan access is enforced where relevant.
- [ ] Restricted billing state blocks premium writes without blocking billing recovery.
- [ ] Existing over-limit records are not deleted.

## 10. File and storage checks

- [ ] Operational files use private storage.
- [ ] Storage paths include workspace context.
- [ ] File metadata uses workspace context.
- [ ] Lower roles only see files relevant to their assignment.
- [ ] Owner financial documents are not exposed to unrelated staff.
- [ ] Upload flows do not allow arbitrary workspace paths.

## 11. Environment variable review

Frontend-safe variables only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`, if used

Server-only variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`
- `SUPABASE_SERVICE_ROLE_KEY`
- Any Resend/Twilio provider keys

Checklist:

- [ ] Server-only variables are not prefixed with `VITE_`.
- [ ] Server-only variables are not imported into frontend code.
- [ ] Real secrets are not committed to GitHub.
- [ ] `.env.example` or README uses placeholder values only.

## 12. Findings log

| Date | Area | Finding | Severity | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-05-11 | Security QA | Initial checklist created | P2 | Open | Manual review pending |

## 13. Launch decision checklist

Before launch:

- [ ] No known P0 security findings remain open.
- [ ] Workspace boundaries are manually tested.
- [ ] Role dashboards are manually tested.
- [ ] Billing recovery is manually tested.
- [ ] Storage/file access is manually tested.
- [ ] Vercel production build passes.
- [ ] Supabase migrations are applied in production.
- [ ] Stripe test-mode flow has been verified before live mode.
