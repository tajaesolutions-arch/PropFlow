# PropFlow Production Launch Readiness Audit

_Last updated: May 11, 2026_

This audit is a manual launch-readiness checklist for PropFlow while Codex usage is unavailable. It is documentation-only and does not change application logic.

## Current status

PropFlow has recently merged these production-readiness layers:

- Supabase database-first MVP foundation
- Workspace setup and role-based routing
- Notifications foundation and UI connection
- Activity logs / audit history connection
- Workspace/team invite access QA
- Billing and subscription grace-period UI
- Stripe Checkout and webhook foundation
- Stripe Customer Portal foundation
- Frontend plan limits and feature gating
- Backend/database plan-limit enforcement

The latest checked `main` branch head before this audit branch was the merged plan-limit enforcement commit: `38a8fb9855cdcb8edd678cd085212e6b2b737e23`.

## Scope

Audit these launch areas before public customer launch:

- App routes
- Role dashboards
- Workspace isolation
- Supabase/RLS
- Billing/Stripe
- Plan limits
- Notifications
- Activity logs
- Invites/team access
- Mobile responsiveness
- Vercel deployment
- Missing production TODOs

## Files to inspect manually

### Core app/auth/routing

- `src/routes/AppRouter.jsx`
- `src/lib/AppContext.jsx`
- `src/lib/auth.js`
- `src/lib/supabase.js`
- `src/data/constants.js`

### Role dashboards

- `src/pages/DashboardPage.jsx`
- `src/pages/AdminDashboardPage.jsx`
- `src/pages/OwnerDashboardPage.jsx`
- `src/pages/CleanerDashboardPage.jsx`
- `src/pages/MaintenanceDashboardPage.jsx`
- `src/pages/AccountantDashboardPage.jsx`

### Operational pages

- `src/pages/PropertiesPage.jsx`
- `src/pages/PropertyDetailPage.jsx`
- `src/pages/BookingsPage.jsx`
- `src/pages/CleaningPage.jsx`
- `src/pages/MaintenancePage.jsx`
- `src/pages/OwnersPage.jsx`
- `src/pages/GuestsPage.jsx`
- `src/pages/ReportsPage.jsx`
- `src/pages/ExpensesPage.jsx`
- `src/pages/FilesPage.jsx`
- `src/pages/InventoryPage.jsx`
- `src/pages/DirectBookingsPage.jsx`
- `src/pages/CalendarPage.jsx`
- `src/pages/CalendarImportsPage.jsx`
- `src/pages/LeasesPage.jsx`

### Billing, Stripe, and plan limits

- `src/pages/BillingPage.jsx`
- `src/pages/PricingPage.jsx`
- `src/pages/SettingsPage.jsx`
- `src/lib/billingStatus.js`
- `src/lib/planLimits.js`
- Vercel API routes under `api/` for Stripe checkout, portal, and webhook

### Notifications, activity, team access

- `src/pages/NotificationsPage.jsx`
- `src/pages/NotificationSettingsPage.jsx`
- `src/lib/activityLogs.js`
- `src/pages/JoinWorkspacePage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/SignupPage.jsx`
- `src/pages/SuspendedPage.jsx`

### Database and deployment

- `supabase/migrations/*`
- `README.md`
- `DEPLOYMENT_CHECKLIST.md`
- `SUPABASE_RUNTIME_TEST_PLAN.md`
- `VERCEL_RUNTIME_TEST_PLAN.md`
- `MIGRATION_MANIFEST.md`
- `package.json`
- `vite.config.js`
- `vercel.json` if present

## Manual QA checklist

### 1. Public routes

- [ ] `/` loads while logged out
- [ ] `/pricing` loads while logged out
- [ ] `/login` loads while logged out
- [ ] `/signup` loads while logged out
- [ ] `/join` loads while logged out
- [ ] `/suspended` loads safely
- [ ] `/book/:slug` loads public direct booking page safely when configured
- [ ] Public pages do not show private workspace data
- [ ] Public pages are mobile responsive

### 2. Auth and workspace setup

- [ ] New user can sign up
- [ ] Existing user can log in
- [ ] User with no workspace is routed to workspace setup
- [ ] New user can create a workspace
- [ ] Workspace creator becomes `workspace_owner`
- [ ] User can log out
- [ ] User can log back in and return to correct workspace/dashboard
- [ ] Suspended user is routed to `/suspended`

### 3. Role dashboard routing

- [ ] PropFlow Admin routes to `/admin`
- [ ] Workspace Owner routes to `/dashboard`
- [ ] Property Manager routes to `/dashboard`
- [ ] Host routes to `/dashboard`
- [ ] Accountant routes to `/accountant-dashboard` or allowed finance area
- [ ] Property Owner routes to `/owner-dashboard`
- [ ] Cleaner routes to `/cleaner-dashboard`
- [ ] Maintenance routes to `/maintenance-dashboard`
- [ ] Users cannot access another role dashboard by changing the URL

### 4. Workspace isolation and IDOR checks

Create Workspace A and Workspace B, then verify:

- [ ] User A cannot open Workspace B property detail URL
- [ ] User A cannot open Workspace B booking/report/file URLs
- [ ] Cleaner assigned to Property A cannot see Property B tasks
- [ ] Property Owner assigned to Property A cannot see all workspace properties
- [ ] Maintenance user cannot update unrelated work orders
- [ ] Notification records are recipient/workspace scoped
- [ ] Activity logs are workspace scoped
- [ ] File paths and signed URLs are workspace scoped

### 5. Core workflows

- [ ] Add Property works
- [ ] Add Booking works
- [ ] Add Cleaning Task works
- [ ] Add Maintenance Work Order works
- [ ] Add Owner works
- [ ] Add Guest works
- [ ] Add Expense works or shows safe placeholder if intentionally incomplete
- [ ] Create Report works or shows safe placeholder if intentionally incomplete
- [ ] Upload File works with private bucket configured or shows safe setup error
- [ ] Create Direct Booking Page works only for allowed plans/roles
- [ ] Create Calendar Import works or shows safe placeholder if intentionally incomplete

### 6. Cleaner workflow

- [ ] Cleaner sees only assigned cleaning tasks
- [ ] Cleaner can start a task
- [ ] Cleaner can mark task in progress
- [ ] Cleaner can mark task completed/guest ready if allowed
- [ ] Cleaner can report issue if supported
- [ ] Cleaner cannot access billing
- [ ] Cleaner cannot access owner finance/reports unless intentionally allowed
- [ ] Cleaner cannot invite team members

### 7. Maintenance workflow

- [ ] Maintenance user sees only assigned work orders
- [ ] Maintenance user can update allowed status fields
- [ ] Maintenance user can add allowed notes/costs if supported
- [ ] Maintenance user cannot see unrelated work orders
- [ ] Maintenance user cannot access billing
- [ ] Maintenance user cannot access broad workspace finance

### 8. Billing and Stripe

- [ ] Billing page loads for Workspace Owner
- [ ] Lower roles cannot open Stripe portal/checkout controls
- [ ] Missing Stripe env vars show `Stripe billing is not configured yet.` or equivalent safe error
- [ ] Checkout button calls server-side endpoint only
- [ ] Customer Portal button calls server-side endpoint only
- [ ] Webhook verifies Stripe signature
- [ ] Failed payment/grace-period UI displays correctly
- [ ] Billing recovery remains available to Workspace Owner/allowed billing roles

### 9. Plan limits

- [ ] Starter property limit blocks 4th active property
- [ ] Starter team limit blocks 4th active/pending member if configured that way
- [ ] Starter monthly owner report limit blocks over-limit creates
- [ ] Direct booking pages are blocked on Starter if plan rules require Pro/Business
- [ ] Existing over-limit data remains readable
- [ ] Frontend shows upgrade message instead of raw SQL error
- [ ] Direct Supabase/API insert attempts are blocked by database triggers

### 10. Notifications

- [ ] Notifications page loads
- [ ] Empty state is clean
- [ ] Unread badge works
- [ ] Mark as read works
- [ ] Archive works
- [ ] User cannot see another user's private notification
- [ ] Provider settings show Resend/Twilio placeholder status without exposing secrets

### 11. Activity logs

- [ ] Property creation creates an activity log
- [ ] Booking creation creates an activity log if supported
- [ ] Invite creation creates an activity log
- [ ] Notification read/archive creates an activity log if supported
- [ ] Workspace Owner sees workspace logs
- [ ] Lower roles do not see broad workspace logs
- [ ] Metadata is customer-readable and does not expose secrets/tokens

### 12. Mobile responsiveness

Test at phone width and tablet width:

- [ ] Landing page
- [ ] Pricing page
- [ ] Login/signup
- [ ] Dashboard
- [ ] Properties
- [ ] Bookings
- [ ] Cleaning dashboard
- [ ] Maintenance dashboard
- [ ] Owner dashboard
- [ ] Billing page
- [ ] Settings page
- [ ] Notifications page

Pass criteria:

- No horizontal overflow
- Sidebar/menu is usable
- Tables stack or scroll cleanly
- Buttons are tappable
- Modals fit screen
- Status badges remain readable

### 13. Vercel deployment

- [ ] `npm install` passes locally or in CI
- [ ] `npm run build` passes locally or in CI
- [ ] Vercel production deployment succeeds
- [ ] Vercel preview deployment succeeds
- [ ] Required frontend env vars are configured
- [ ] Required server-only env vars are not exposed as `VITE_*`
- [ ] Refreshing protected routes does not create blank pages
- [ ] Browser console has no launch-blocking runtime errors

## Launch blockers

Do not launch publicly while any of these are true:

### Security blockers

- A user can access another workspace's data by changing an ID in the URL
- A lower role can access billing, owner finance, or unrelated operational records
- Customer workspace users can create or assign `propflow_admin`
- Company/workspace code alone lets random users join
- Private storage files are public
- Supabase service-role key, Stripe secret key, Twilio token, or Resend key is exposed to frontend
- Any private customer table has broad `using (true)` / `with check (true)` policies

### Product blockers

- Login or signup fails
- Workspace creation fails
- Main dashboard fails after login
- Add Property fails
- Add Booking fails if bookings are considered launch-critical
- Invite Team Member fails
- Cleaner/Maintenance mobile workflows are unusable
- Billing recovery blocks the owner from fixing payment status

### Deployment blockers

- `npm run build` fails
- Vercel deployment fails
- Supabase migrations are not applied in order
- Required env vars are missing in production

## Nice-to-have fixes after launch-readiness pass

These should not block a controlled MVP beta unless severe:

- Advanced chart polish
- More dashboard animations
- Real email/SMS/WhatsApp sending
- AI tools implementation
- Usage-based billing
- Coupons/discounts
- Custom invoice UI
- Full channel integrations
- Advanced owner report scheduling
- PDF/CSV exports
- Full public direct booking payment flow

## Recommended non-coder test order

1. Sign up with a fresh email
2. Create a workspace
3. Add one property
4. Add one booking
5. Add one cleaning task
6. Add one maintenance work order
7. Invite a cleaner
8. Log in as the cleaner
9. Confirm cleaner sees only assigned cleaning work
10. Invite a maintenance user
11. Log in as maintenance
12. Confirm maintenance sees only assigned work orders
13. Open billing as Workspace Owner
14. Test mobile
15. Review notifications and activity logs
16. Try opening another workspace's record URL and confirm no access

## Result tracking

Use this table while testing:

| Area | Status | Notes | Blocker? |
| --- | --- | --- | --- |
| Public routes | Not tested |  |  |
| Signup/login | Not tested |  |  |
| Workspace setup | Not tested |  |  |
| Role routing | Not tested |  |  |
| Workspace isolation | Not tested |  |  |
| Core workflows | Not tested |  |  |
| Billing/Stripe | Not tested |  |  |
| Plan limits | Not tested |  |  |
| Notifications | Not tested |  |  |
| Activity logs | Not tested |  |  |
| Mobile | Not tested |  |  |
| Vercel | Not tested |  |  |
