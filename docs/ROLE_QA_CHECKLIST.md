# PropFlow real-role QA and permission checklist

Use this checklist after every dashboard, routing, or RLS change. It is written for real Supabase Auth users and real workspace memberships; do not seed fake production data just to satisfy a scenario.

## Test account matrix

| Account | Required database state | Expected landing route | Notes |
| --- | --- | --- | --- |
| PropFlow Admin | `profiles.is_propflow_admin = true`; no customer workspace required | `/admin` | Must not be invited through `workspace_invites` and must not need a `workspace_members` row. |
| Workspace Owner | Active `workspace_members.roles` contains `workspace_owner` | `/dashboard` | Full customer workspace administration inside the active workspace only. |
| Property Manager | Active membership contains `property_manager` | `/dashboard` | Operational manager; billing access remains intentionally limited. |
| Host | Active membership contains `host` | `/dashboard` | Operational host; no platform admin or full billing controls. |
| Property Owner | Active membership contains `property_owner`; assigned properties exist through `property_assignments` or owner linkage | `/owner-dashboard` | Mostly view-only owner portal. |
| Cleaner | Active membership contains `cleaner`; assigned cleaning tasks exist | `/cleaner-dashboard` | Task-first portal for assigned cleaning work. |
| Maintenance | Active membership contains `maintenance`; assigned work orders exist | `/maintenance-dashboard` | Work-order-first portal for assigned repairs. |
| Accountant | Active membership contains `accountant` | `/accountant-dashboard` | Finance/report/document visibility only where allowed. |
| Suspended user | `profiles.status` or effective membership state is `suspended` | `/suspended` | Can authenticate but must not access workspace data. |
| Multi-workspace mixed-role user | Same auth user has different active roles in two workspaces | Active workspace role route | Switching workspaces must not carry over permissions from another workspace. |

## Required public route smoke checks

| Route | Expected result |
| --- | --- |
| `/` | Public landing page loads without authentication. |
| `/pricing` | Public pricing page loads without authentication. |
| `/login` | Login form loads; authenticated users redirect to their role route. |
| `/signup` | Signup form loads; authenticated users redirect to their role route. |
| `/join` | Join/create workspace flow loads; authenticated users with an active workspace redirect to their role route unless using an invite query. |
| `/suspended` | Safe suspension information loads; no workspace data is exposed. |
| `/book/:slug` | Public direct booking page loads through slug route only. |

## Expected sidebar by role

| Role | Expected sidebar items |
| --- | --- |
| PropFlow Admin | Admin Dashboard only. |
| Workspace Owner | Dashboard, Properties, Bookings, Leases, Direct Bookings, Calendar Imports, Calendar, Cleaning, Maintenance, Owners, Guests/CRM, Expenses, Reports, Files/Documents, Supplies/Inventory, Team, Smart Tools/AI, Notifications, Settings, Billing, Help/Support. |
| Property Manager | Dashboard, Properties, Bookings, Leases, Direct Bookings, Calendar Imports, Calendar, Cleaning, Maintenance, Owners, Guests/CRM, Expenses, Reports, Files/Documents, Supplies/Inventory, Team, Smart Tools/AI, Notifications, Settings, Help/Support. Billing hidden. |
| Host | Dashboard, Properties, Bookings, Leases, Direct Bookings, Calendar Imports, Calendar, Cleaning, Maintenance, Owners, Guests/CRM, Expenses, Reports, Files/Documents, Supplies/Inventory, Smart Tools/AI, Notifications, Settings, Help/Support. Team and Billing hidden. |
| Property Owner | Owner Dashboard, Assigned Properties, Reports, Files/Documents, Maintenance Updates, Notifications, Account. |
| Cleaner | Cleaner Dashboard, Cleaning Tasks, Notifications, Account. |
| Maintenance | Maintenance Dashboard, Assigned Work Orders, Notifications, Account. |
| Accountant | Accountant Dashboard, Properties, Leases, Expenses, Reports, Files/Documents, Supplies/Inventory, Billing, Notifications, Account. |
| Suspended user | No app sidebar; only suspension/account-safe pages. |

## Route access matrix

| Route | Allowed roles | Must be blocked from |
| --- | --- | --- |
| `/dashboard` | Workspace Owner, Property Manager, Host | PropFlow Admin, Property Owner, Cleaner, Maintenance, Accountant, Suspended |
| `/admin` | PropFlow Admin only | All customer roles and suspended users |
| `/owner-dashboard` | Property Owner only | Customer operations roles, Cleaner, Maintenance, Accountant, Suspended |
| `/cleaner-dashboard` | Cleaner only | Customer operations roles, Property Owner, Maintenance, Accountant, Suspended |
| `/maintenance-dashboard` | Maintenance only | Customer operations roles, Property Owner, Cleaner, Accountant, Suspended |
| `/accountant-dashboard` | Accountant only | Customer operations roles, Property Owner, Cleaner, Maintenance, Suspended |
| `/properties` | Workspace Owner, Property Manager, Host, Property Owner, Accountant | Cleaner, Maintenance, Suspended |
| `/properties/:id` | Workspace Owner, Property Manager, Host, Property Owner, Accountant | Cleaner, Maintenance, Suspended |
| `/bookings` | Workspace Owner, Property Manager, Host, Accountant | Property Owner, Cleaner, Maintenance, Suspended |
| `/cleaning` | Workspace Owner, Property Manager, Host, Cleaner | Property Owner, Maintenance, Accountant, Suspended |
| `/maintenance` | Workspace Owner, Property Manager, Host, Maintenance | Property Owner, Cleaner, Accountant, Suspended |
| `/owners` | Workspace Owner, Property Manager, Host, Accountant | Property Owner, Cleaner, Maintenance, Suspended |
| `/guests` | Workspace Owner, Property Manager, Host | Property Owner, Cleaner, Maintenance, Accountant, Suspended |
| `/reports` | Workspace Owner, Property Manager, Host, Property Owner, Accountant | Cleaner, Maintenance, Suspended |
| `/notifications` | All active workspace roles | Suspended |
| `/files` | Workspace Owner, Property Manager, Host, Property Owner, Accountant | Cleaner, Maintenance, Suspended |
| `/direct-bookings` | Workspace Owner, Property Manager, Host | Property Owner, Cleaner, Maintenance, Accountant, Suspended |
| `/settings` | Workspace Owner, Property Manager, Host | Property Owner, Cleaner, Maintenance, Accountant, Suspended |
| `/account` | Authenticated users, including suspended users | Anonymous users |
| `/billing` | Workspace Owner, Accountant | Property Manager, Host, Property Owner, Cleaner, Maintenance, Suspended unless account recovery rules intentionally allow account-safe pages |

## Key action permissions

| Area | Can create/edit/archive | View-only or limited |
| --- | --- | --- |
| Workspace settings/team | Workspace Owner; Property Manager for team where intentionally allowed | Host, Accountant, Property Owner, Cleaner, Maintenance |
| Billing | Workspace Owner and Accountant only | All other customer roles |
| Properties | Workspace Owner and Property Manager | Host, Accountant, Property Owner; Cleaner and Maintenance blocked from broad property page |
| Bookings | Workspace Owner, Property Manager, Host where product rules allow | Accountant view/report-safe; Owner/Cleaner/Maintenance blocked from broad bookings |
| Cleaning tasks | Workspace Owner, Property Manager, Host; Cleaner may update assigned task status/photos/notes only | Owner, Maintenance, Accountant blocked from cleaning operations |
| Maintenance work orders | Workspace Owner, Property Manager, Host; Maintenance may update assigned work order status/photos/repair notes/costs only | Owner, Cleaner, Accountant blocked from maintenance operations |
| Reports/exports | Workspace Owner, Property Manager, Host, Accountant; Property Owner owner-safe assigned-property reports only | Cleaner and Maintenance blocked |
| Files/documents | Workspace Owner, Property Manager, Host, Accountant; Property Owner owner-safe assigned-property documents only | Cleaner and Maintenance blocked unless a future task-safe file view is built |
| Direct booking pages/requests | Workspace Owner, Property Manager, Host | Accountant, Property Owner, Cleaner, Maintenance blocked |
| Platform Admin actions | PropFlow Admin only | Every customer role |

## Suspended user test cases

- Sign in with a suspended profile and verify redirect to `/suspended`.
- Manually enter every private route and verify redirect to `/suspended` or a denied state with no workspace data.
- Verify `/account` shows only safe account information.
- Verify no sidebar, workspace switcher, create buttons, files, reports, bookings, cleaning tasks, maintenance work orders, team, or billing data are visible.
- Verify suspended users cannot use create/update/archive actions even if a stale tab still shows an old form.

## Platform Admin test cases

- Sign in with `is_propflow_admin = true` and no workspace membership; verify `/admin` loads.
- Manually enter customer routes such as `/dashboard`, `/properties`, `/reports`, `/settings`, and verify redirect to `/admin`.
- Verify `/admin` is absent for every normal customer role in sidebar and manual access is denied.
- Verify PropFlow Admin is not available in customer invite role pickers.
- Verify platform RPCs and policies are gated by `is_propflow_admin()` only.

## Backend/RLS review checklist

- Workspace-owned tables must filter by `workspace_id` in frontend queries and RLS policies.
- Customer-facing RLS policies must require active workspace membership, role checks, assignment checks, or public direct-booking scope as applicable.
- Suspended users must not satisfy active workspace access checks.
- Owner, cleaner, and maintenance policies must be assignment-limited where broad workspace access is inappropriate.
- Accountant policies should expose finance/report/document data where allowed, not unrelated operational task mutation.
- Avoid customer-data policies with `USING (true)` or equivalent unrestricted access.
- Platform admin access must be gated by `is_propflow_admin()`/`canAccessPlatformAdmin`, not customer workspace roles.

## Mobile smoke checklist

- At mobile width, open and close sidebar for each portal role.
- Verify only allowed sidebar items appear and tap targets navigate to allowed routes.
- Verify manual URL entry still enforces route guards after mobile navigation.
- Verify empty states fit without horizontal overflow for owner, cleaner, maintenance, accountant, and suspended states.
- Verify action buttons that remain visible on mobile match the role action matrix.

## Known remaining permission TODOs

- Run manual Supabase-backed tests with real users for every role because static review cannot prove deployed RLS behavior without a live project and role fixtures.
- Add automated route-guard tests once the app has a test runner; do not add a lint/test system solely for this QA pass.
- Continue hardening page-level action checks that still use global role helpers instead of active-workspace role helpers when those pages are touched for related work.
- Confirm private storage object policies in the deployed Supabase project mirror the file metadata RLS policies.
