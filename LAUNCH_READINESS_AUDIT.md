# PropFlow Production Launch Readiness Audit

Date: 2026-05-11
Status: Manual QA checklist

This document is the working launch-readiness checklist for PropFlow. Use it before adding more features or opening public access.

## 1. Launch decision

PropFlow is not ready for public launch until every P0 item is checked or documented with a clear fix plan.

Priority levels:

- P0: Launch blocker. Must be fixed before public launch.
- P1: Important. Should be fixed before paid customers.
- P2: Nice-to-have. Can be handled after controlled beta.

## 2. Key files to inspect

Core app and routing:

- `src/routes/AppRouter.jsx`
- `src/lib/AppContext.jsx`
- `src/lib/auth.js`
- `src/lib/supabase.js`
- `src/data/constants.js`

Role dashboards:

- `src/pages/DashboardPage.jsx`
- `src/pages/AdminDashboardPage.jsx`
- `src/pages/OwnerDashboardPage.jsx`
- `src/pages/CleanerDashboardPage.jsx`
- `src/pages/MaintenanceDashboardPage.jsx`
- `src/pages/AccountantDashboardPage.jsx`

Operational pages:

- `src/pages/PropertiesPage.jsx`
- `src/pages/PropertyDetailPage.jsx`
- `src/pages/BookingsPage.jsx`
- `src/pages/LeasesPage.jsx`
- `src/pages/DirectBookingsPage.jsx`
- `src/pages/CalendarPage.jsx`
- `src/pages/CalendarImportsPage.jsx`
- `src/pages/CleaningPage.jsx`
- `src/pages/MaintenancePage.jsx`
- `src/pages/OwnersPage.jsx`
- `src/pages/GuestsPage.jsx`
- `src/pages/ReportsPage.jsx`
- `src/pages/ExpensesPage.jsx`
- `src/pages/FilesPage.jsx`
- `src/pages/InventoryPage.jsx`

Billing, plans, and account state:

- `src/pages/BillingPage.jsx`
- `src/pages/PricingPage.jsx`
- `src/pages/SettingsPage.jsx`
- `src/lib/billingStatus.js`
- `src/lib/planLimits.js`

Notifications, audit trail, and team access:

- `src/pages/NotificationsPage.jsx`
- `src/pages/NotificationSettingsPage.jsx`
- `src/lib/activityLogs.js`
- `src/pages/JoinWorkspacePage.jsx`
- `src/pages/SignupPage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/SuspendedPage.jsx`

Database and deployment:

- `supabase/migrations/*`
- backend/API/edge function folders
- `package.json`
- `vite.config.js`
- `vercel.json`
- `README.md`

## 3. Manual QA checklist

### Public pages

- [ ] `/` loads while logged out.
- [ ] `/pricing` loads while logged out.
- [ ] `/login` loads while logged out.
- [ ] `/signup` loads while logged out.
- [ ] `/join` loads while logged out.
- [ ] Public booking page loads only public booking information.
- [ ] Buttons on public pages do not route to broken pages.
- [ ] Public pages work on mobile.

### Authentication and workspace setup

- [ ] New user can sign up.
- [ ] Existing user can log in.
- [ ] User can create a new workspace.
- [ ] New workspace routes to the correct dashboard.
- [ ] User with no workspace routes to workspace setup.
- [ ] Invited user can join a workspace.
- [ ] Workspace/company code requires a matching invite.
- [ ] Suspended user routes to suspended/restricted screen.
- [ ] Logout works.
- [ ] Login after refresh still loads workspace and role.

### Role routing

- [ ] PropFlow Admin routes to `/admin`.
- [ ] Workspace Owner routes to `/dashboard`.
- [ ] Property Manager routes to `/dashboard`.
- [ ] Host routes to `/dashboard`.
- [ ] Accountant routes to accountant/finance view.
- [ ] Property Owner routes to `/owner-dashboard`.
- [ ] Cleaner routes to `/cleaner-dashboard`.
- [ ] Maintenance routes to `/maintenance-dashboard`.
- [ ] Role dashboards do not show unrelated controls.

### Workspace data boundaries

Create two workspaces and test from both accounts.

- [ ] Workspace A user sees only Workspace A data.
- [ ] Workspace B user sees only Workspace B data.
- [ ] Property detail pages require the selected workspace context.
- [ ] Reports load only for the selected workspace.
- [ ] Notifications load only for the selected workspace/user context.
- [ ] Activity logs load only for the selected workspace context.
- [ ] Files and documents load only for permitted workspace/property/task context.

### Core workflows

As Workspace Owner or Property Manager:

- [ ] Add Property works.
- [ ] Add Booking works.
- [ ] Add Cleaning Task works.
- [ ] Add Maintenance Work Order works.
- [ ] Add Owner works.
- [ ] Add Guest works.
- [ ] Add Expense works.
- [ ] Create Report works.
- [ ] Upload File flow is safe and clear.
- [ ] Create Direct Booking Page works or shows a plan message.
- [ ] Create Calendar Import works or shows a safe placeholder.

### Cleaner workflow

- [ ] Cleaner sees assigned cleaning tasks only.
- [ ] Cleaner can start a task.
- [ ] Cleaner can complete a task.
- [ ] Cleaner can report an issue.
- [ ] Cleaner cannot access billing controls.
- [ ] Cleaner cannot access broad finance/reporting areas.

### Maintenance workflow

- [ ] Maintenance user sees assigned work orders only.
- [ ] Maintenance user can update status.
- [ ] Maintenance user can add notes/costs where allowed.
- [ ] Maintenance user can mark a work order complete.
- [ ] Maintenance user cannot access unrelated work orders.
- [ ] Maintenance user cannot access billing controls.

### Owner and Accountant workflows

- [ ] Property Owner sees only assigned property information.
- [ ] Property Owner finance view is limited to allowed owner data.
- [ ] Accountant sees finance/reporting areas.
- [ ] Accountant does not get broad operational edit controls unless intentionally allowed.

### Billing and Stripe

- [ ] Billing page loads for Workspace Owner.
- [ ] Billing page hides payment controls from lower roles.
- [ ] Pricing page shows current plan structure clearly.
- [ ] Choose plan button handles missing Stripe configuration cleanly.
- [ ] Manage billing button handles missing Stripe configuration cleanly.
- [ ] Stripe customer portal is owner-only.
- [ ] Billing recovery remains available to Workspace Owner.
- [ ] Staff see a clear restricted-access message when billing status requires it.

### Plan limits

- [ ] Starter property limit shows in UI.
- [ ] Starter team member limit shows in UI.
- [ ] Owner report monthly limit shows in UI.
- [ ] Direct booking locked state works where applicable.
- [ ] Backend/database limit messages are customer-friendly.
- [ ] Existing over-limit data is not deleted.

### Notifications

- [ ] Notifications page loads.
- [ ] Empty state is clean.
- [ ] Unread badge count works.
- [ ] Mark as read works.
- [ ] Archive works.
- [ ] Notification settings page loads.
- [ ] Provider status does not claim real sending unless configured.

### Activity logs

- [ ] Creating a property logs activity.
- [ ] Creating a booking logs activity.
- [ ] Creating a cleaning task logs activity.
- [ ] Creating a maintenance work order logs activity.
- [ ] Inviting a team member logs activity.
- [ ] Marking notifications read/archive logs activity only if intended.
- [ ] Activity log UI does not show raw JSON by default.

### Mobile QA

Test on iPhone/mobile width:

- [ ] Landing page.
- [ ] Pricing page.
- [ ] Login/signup.
- [ ] Main dashboard.
- [ ] Properties page.
- [ ] Bookings page.
- [ ] Cleaning dashboard.
- [ ] Maintenance dashboard.
- [ ] Billing page.
- [ ] Settings page.
- [ ] Notifications page.
- [ ] Modals fit small screens.
- [ ] Tables stack or scroll cleanly.
- [ ] Sidebar/mobile nav works.

### Vercel deployment

- [ ] `npm run build` passes.
- [ ] Vercel preview deploy passes.
- [ ] Vercel production deploy passes.
- [ ] Required frontend env vars exist.
- [ ] Server-only env vars are not exposed to Vite frontend.
- [ ] Refreshing protected routes does not produce a blank screen.
- [ ] Browser console has no critical runtime errors.

## 4. P0 launch blockers

Do not launch publicly if any of these fail:

- Login/signup does not work.
- Workspace creation does not work.
- Invite/join workspace flow does not work.
- Main dashboard fails after login.
- Add Property fails.
- Add Booking fails.
- Add Cleaning Task fails.
- Add Maintenance Work Order fails.
- Workspace data appears in the wrong workspace.
- Cleaner or Maintenance roles can see broad billing/finance data.
- Customer users can assign platform-level admin roles.
- Billing recovery blocks the Workspace Owner.
- Vercel production deploy fails.
- Mobile cleaner/maintenance workflows are unusable.

## 5. P1 pre-paid-customer fixes

- Improve empty states on all core pages.
- Confirm all plan-limit messages are clear.
- Confirm reports/export placeholders are honest if not fully connected.
- Confirm file upload privacy and document access rules.
- Confirm notification provider settings are honest about Resend/Twilio status.
- Confirm Stripe webhook status sync with test-mode events.

## 6. P2 post-beta improvements

- More advanced dashboard charts.
- AI tools implementation.
- Automated email/SMS/WhatsApp sending.
- Advanced owner report scheduling.
- Usage-based billing.
- Coupons and promotional codes.
- Advanced admin analytics.
- Deeper Airbnb/Booking.com/Vrbo integrations.

## 7. Non-coder test order

Use this order when manually testing:

1. Sign up with a fresh email.
2. Create a workspace.
3. Add a property.
4. Add a booking.
5. Add a cleaning task.
6. Add a maintenance work order.
7. Invite a cleaner.
8. Log in as the cleaner.
9. Confirm cleaner sees only assigned cleaning work.
10. Invite a maintenance user.
11. Log in as maintenance.
12. Confirm maintenance sees only assigned work orders.
13. Open billing as Workspace Owner.
14. Test mobile.
15. Review notifications and activity logs.

## 8. Findings log

Add findings here during manual QA.

| Date | Area | Issue | Severity | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-05-11 | Launch audit | Initial checklist created | P2 | Open | Manual QA pending |
