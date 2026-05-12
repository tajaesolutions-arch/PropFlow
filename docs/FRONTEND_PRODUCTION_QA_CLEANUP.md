# Frontend Production QA Cleanup

Date: 2026-05-12  
Branch: `codex/frontend-production-qa-cleanup`

## Scope and guardrails

This pass was a small, frontend-only production QA cleanup. It did not rebuild the app, change backend behavior, touch Supabase schema, add migrations, change RLS, change auth architecture, or modify Stripe, Resend, direct booking, iCal, or file upload backend logic.

## Pages audited

- Landing page
- Pricing page
- Login, signup, and join/workspace setup pages
- Main dashboard
- Platform Admin dashboard
- Owner dashboard
- Cleaner dashboard
- Maintenance dashboard
- Accountant dashboard
- Properties and property detail
- Property assignment UI
- Bookings and calendar imports
- Cleaning
- Maintenance
- Owners
- Guests
- Reports
- Files/Documents
- Direct Bookings
- Notifications and notification settings
- Settings
- Account
- Billing
- Suspended/access-denied page
- Public direct booking and booking-request pages
- Unknown-route and runtime fallback screens

## Buttons/actions checked

Checked that primary customer actions either open their existing modal/page, show a clear loading state, or are disabled with visible/hover guidance:

- Add Property
- Add Booking
- Add Cleaning Task
- Add Maintenance Work Order
- Add Owner
- Add Guest
- Invite Team Member
- Assign Team Member / Manage Assignments
- Upload File
- Generate/View Report
- Export CSV/PDF/Print
- Create Direct Booking Page
- Publish/Unpublish Direct Booking Page
- Mark Notification Read / Mark All Read
- Manage Billing / Open Billing Portal
- Save Settings
- Update Account
- Logout

Cleanup completed in this pass:

- Added clearer disabled reasons for report view/export actions when a report is locked or lacks source records.
- Added clearer disabled reasons for booking, cleaning, and maintenance create-modal submit buttons when no property exists yet.
- Added a clear disabled reason for Mark all read when there are no unread notifications.
- Preserved existing dangerous-action styling in admin/status controls rather than promoting destructive actions as primary actions.

## Empty states checked

Verified the major list/table areas do not rely on blank tables or fake rows:

- Properties
- Bookings
- Cleaning
- Maintenance
- Owners
- Guests
- Reports
- Files
- Direct Bookings
- Notifications
- Assignments
- Admin tables
- Owner dashboard
- Cleaner dashboard
- Maintenance dashboard
- Accountant dashboard

Cleanup completed in this pass:

- Polished shared table empty-state language so it reads as a product empty state instead of a technical placeholder.
- Split an overly long Reports empty-state title into a short title and explanatory body copy.
- Kept empty states action-oriented without adding demo/fake production data.

## Forms/modals checked

Reviewed the shared create-action modal flows and page-level forms for required fields, helper text, saving state, disabled state, validation tone, and mobile overflow:

- Workspace setup
- Add Property
- Add Booking
- Add Cleaning Task
- Add Maintenance Work Order
- Add Owner
- Add Guest
- Invite Team Member
- Assign Team Member
- Add/Edit Direct Booking Page
- Add iCal Feed
- Upload File
- Report metadata/export controls
- Settings forms
- Account forms

Cleanup completed in this pass:

- Sanitized login/signup failure copy so normal users do not see raw provider messages in common auth failures.
- Reworded auth setup warnings to avoid unnecessary Supabase/provider jargon on public auth pages.
- Preserved existing modal loading states and added clearer disabled submit titles where a property prerequisite blocks saving.
- Tightened mobile modal height and padding so long forms are easier to scroll at 390px widths.

## Role-specific UI checklist

Audited UI expectations for:

- `propflow_admin`
- `workspace_owner`
- `property_manager`
- `host`
- `property_owner`
- `cleaner`
- `maintenance`
- `accountant`
- Suspended user

Checks performed:

- Sidebar items remain role-aware through the existing route/role configuration.
- Platform Admin routing remains internal and can access `/admin` without a customer workspace.
- Workspace users are still redirected to workspace setup when no workspace is selected.
- Cleaner and Maintenance dashboards remain task/work-order first.
- Owner and Accountant views remain read-biased where appropriate.
- Suspended users remain limited to suspension/account-safe UI.

Cleanup completed in this pass:

- Polished production runtime fallback language so it is safe for every role.
- Left Platform Admin setup-status wording technical enough for internal use without exposing secrets.

## Mobile checklist

Visual breakpoints checked in code/CSS for:

- 390px
- 768px
- Desktop width

Checks performed:

- Sidebar overlay behavior
- Topbar wrapping
- Card spacing
- Table horizontal scrolling
- Modal overflow
- Button tap sizes
- Filters/action bars
- Chart/card containment
- Assignment cards and modal readability

Cleanup completed in this pass:

- Added CSS overrides for common action rows to stack cleanly on mobile.
- Added safer modal `100dvh` max-height behavior and tighter 430px padding.
- Added topbar text clamping at phone widths to reduce cut-off/wrap issues.
- Kept tables horizontally scrollable without forcing a desktop table into a cramped mobile card.

## Copy cleanup notes

Searched the frontend for rough wording including placeholder/demo/sample/fake/mock/TODO/not implemented/undefined/null/NaN/coming soon/provider not configured/setup required/error/failed.

Cleanup completed in this pass:

- Removed public-facing “demo login” wording from the login setup warning.
- Reworded public direct-booking payment/setup copy so guests see manager-friendly language instead of implementation status.
- Reworded public pricing billing setup copy to avoid provider jargon.
- Reworded direct-booking mode labels to avoid production-facing “placeholder” language while keeping existing stored values stable.
- Reworded billing provider status label to a customer-safe label.

## Route edge-case checklist

Checked route behavior in `src/routes/AppRouter.jsx`:

- Unauthorized route access renders a safe denied/suspended variant.
- Workspace-less users redirect to `/workspace-setup` except for allowed recovery/setup paths.
- Platform Admin users redirect to `/admin` and are not blocked by missing customer workspace.
- Suspended users redirect to `/suspended` except for account-safe access.
- Public direct booking pages render through `/book` and `/book/:slug` outside the protected app shell.
- Unknown routes render a clean fallback with safe navigation actions.
- Role dashboard redirects continue to use the role-priority routing helper.

Cleanup completed in this pass:

- Polished runtime fallback copy for production users while retaining more detailed messages only in development builds.

## Known remaining frontend TODOs

- Some setup/readiness language is intentionally still visible to Workspace Owners and Platform Admin users in Settings/Admin screens.
- CSV/PDF export, receipt upload, external notification delivery, live billing, and some direct-booking payment/instant-confirmation paths remain setup-gated until their backend services are fully connected.
- Several filters and large tables are still desktop-table-first; they scroll safely on mobile but could later be upgraded to dedicated mobile card lists.
- No lint script exists in `package.json`; do not add a lint system in this cleanup PR.

## Manual founder test checklist

1. Visit `/`, `/pricing`, `/login`, `/signup`, `/join`, `/book`, and a `/book/:slug` URL and confirm public copy is polished.
2. Log in as Platform Admin and verify `/admin` loads without requiring a customer workspace.
3. Log in as a Workspace Owner and verify `/dashboard`, `/properties`, `/bookings`, `/cleaning`, `/maintenance`, `/owners`, `/guests`, `/reports`, `/files`, `/direct-bookings`, `/notifications`, `/settings`, `/account`, and `/billing` are navigable.
4. Log in as Property Owner and verify assigned-property dashboards/pages are read-biased.
5. Log in as Cleaner on mobile and verify task actions are readable and stacked.
6. Log in as Maintenance on mobile and verify work-order actions are readable and stacked.
7. Log in as Accountant and verify finance/report access is visible without edit-heavy owner/operations controls.
8. Test empty workspaces with no properties/bookings/tasks and confirm empty states explain the next action.
9. Open each create modal and verify required fields, cancel behavior, saving state, and disabled prerequisite copy.
10. Test 390px, 768px, and desktop widths for sidebar, topbar, tables, modals, reports, notifications, and assignment UI.
11. Manually enter an unknown route and verify the fallback route screen is clean.
12. Suspend a test user and verify only suspended/account-safe UI is available.
