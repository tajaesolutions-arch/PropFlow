# PropFlow Core Workflow QA Checklist

## Scope

This checklist covers the customer-facing MVP workflows after the backend foundation, production stabilization, role QA, dashboard polish, and placeholder cleanup work. The pass is intentionally frontend-focused: routing clarity, empty states, visible loading/saving states, safe disabled states, role-aware actions, and clear next steps.

## Core workflow checklist

- [ ] Signup and login show clear production authentication messaging.
- [ ] Workspace-less authenticated users route to workspace setup instead of a blank dashboard.
- [ ] Workspace creation explains required business fields and routes to the dashboard after success.
- [ ] Workspace join explains invite link/token/company-code rules and email-match requirements.
- [ ] Empty dashboard guides the user to add the first property and invite team members.
- [ ] Add Property is reachable from dashboard, properties, and relevant empty states.
- [ ] Add Booking is reachable when properties exist; users without properties are guided to add one first.
- [ ] Cleaning and maintenance creation explain property dependencies and unassigned task/work-order behavior.
- [ ] Owner and guest creation use the shared contact flow and explain that contacts are not portal logins unless invited.
- [ ] Team invites exclude PropFlow Admin and only show property assignment rules for scoped roles.
- [ ] Files show private-storage expectations, supported file types/sizes, safe signed view actions, and clear empty states.
- [ ] Reports explain required data before exports are useful and disable export actions until data/plan support exists.
- [ ] Direct booking pages explain manual approval defaults, published/unpublished state, and payment setup expectations.
- [ ] Notifications show a clean empty state and role-appropriate categories/actions.
- [ ] Settings and account pages avoid customer-facing secrets/env-var names and keep provider setup language non-scary.

## Expected first-time user path

1. User signs up with name, email, and password.
2. After authentication, a user without a workspace lands on `/workspace-setup`.
3. User chooses either:
   - **Create workspace**: enters workspace/business name, business type, country, default currency, business email, and phone.
   - **Join workspace**: enters a valid invite link, invite token, or company code tied to a pending invite for the signed-in email.
4. After workspace creation/join, PropFlow routes by saved role:
   - Workspace Owner / Property Manager / Host → `/dashboard`
   - Owner → `/owner-dashboard`
   - Cleaner → `/cleaner-dashboard`
   - Maintenance Crew → `/maintenance-dashboard`
   - Accountant → `/accountant-dashboard`
   - PropFlow Admin → `/admin`
5. A brand-new workspace shows no fake records and prompts the user to add the first property.

## Expected add-first-property path

1. User clicks **Add first property** from dashboard or **Add Property** from Properties.
2. Modal requires property name, address/location, property type, rental type, status, and currency.
3. Optional fields can be added safely: rates, owner assignment, beds/baths/size, and notes.
4. Save button shows a saving state and prevents duplicate submission.
5. After save, workspace data refreshes; the properties list/dashboard should show the new real record.
6. No sample/demo property should appear at any point.

## Expected booking / cleaning / maintenance paths

### Booking

1. If no properties exist, booking empty states and the booking modal tell the user to add a property first.
2. If a property exists, user opens **Add Booking**.
3. Required booking fields are clear: guest name, property, check-in, check-out, source, status, payment status, currency, and total amount when known.
4. Optional contact, fees, payout, and notes fields may remain blank.
5. Booking list/table updates after successful save.

### Cleaning

1. User can create cleaning tasks from dashboard/page/property contexts where the role allows it.
2. If no properties exist, user sees **Add a property first** guidance.
3. If no cleaner exists, unassigned task behavior is explained and the user is guided to invite a cleaner later.
4. Related booking choices are limited to bookings for the selected property.
5. Cleaner dashboard should show assigned tasks only, with clear mobile-friendly status actions.

### Maintenance

1. User can create work orders from dashboard/page/property contexts where the role allows it.
2. If no properties exist, user sees **Add a property first** guidance.
3. If no maintenance crew member exists, unassigned work-order behavior is explained.
4. Priority, status, estimated cost, actual cost, parts needed, due date, notes, and photo/upload expectations are visible.
5. Urgent work orders use clear warning badges without overly aggressive styling.

## Expected owner / guest / team invite paths

- Add Owner and Add Guest use the existing contact/CRM flow.
- Owner contacts clearly state they do not become portal logins unless invited as Property Owner team members.
- Guest contacts clearly state they are CRM/stay records, not portal logins.
- Team invites are in Settings/Team and do not include `propflow_admin`.
- Property assignment is required only for Property Owner, Cleaner, and Maintenance roles.
- Invite success explains that email delivery is attempted when configured and that the one-time invite link is the fallback.
- Provider-not-configured messaging should be calm and actionable.

## Expected file / report / direct-booking paths

### Files

- Upload controls appear only for allowed roles.
- Private storage expectations are visible.
- Supported file types and sizes are visible: JPEG, PNG, WebP up to 10 MB; PDF, DOCX, XLSX up to 25 MB.
- Unsupported video uploads are not advertised as currently supported.
- File lists have empty states and signed view/download actions.

### Reports

- Reports state that real property, booking, expense, cleaning, or maintenance data is needed before reports are useful.
- View/export buttons are disabled when data is missing or plan support is locked.
- Owner reports remain assigned-property scoped and role-safe.
- CSV/PDF/print actions are available only through existing frontend export logic.

### Direct bookings

- Direct booking setup is available to Workspace Owner / Property Manager / Host roles.
- Manual approval is the safe default.
- Public page published/unpublished status is visible.
- Payment mode should be kept optional unless Stripe setup is complete through existing backend logic.
- Requests table has a clear empty state.

## Role-specific workflow notes

- **PropFlow Admin**: internal `/admin` workflows only; no customer workspace operations.
- **Workspace Owner / Company Admin**: broadest customer workflow access, including billing/settings/team recovery.
- **Property Manager**: operational workflows and team invites without platform admin access.
- **Host**: operational booking/cleaning/maintenance workflows without billing overreach.
- **Property Owner**: assigned-property/report/document visibility; mostly read-only.
- **Cleaner**: assigned cleaning-task workflow only.
- **Maintenance Crew**: assigned work-order workflow only.
- **Accountant**: finance/report/document focus.
- **Suspended user**: no operational workflow access.

## Remaining frontend TODOs

- Confirm all create/update actions against production Supabase RLS with real seeded test accounts.
- Add automated role-routing and create-modal regression tests when the project introduces a test runner.
- Expand file visibility QA with real owner/cleaner/maintenance accounts after storage policies are verified.
- Validate direct booking payment setup states end-to-end against the existing Stripe server endpoints.
- Review mobile screenshots for every modal on small viewport after founder test data exists.

## Manual founder test plan

1. Create a new account and confirm workspace-less routing to `/workspace-setup`.
2. Create a workspace and confirm `/dashboard` loads with no fake records.
3. Add first property from the dashboard empty state.
4. Add first booking for that property.
5. Add a cleaning task for that property without assigning a cleaner; then invite a cleaner and verify assignment guidance.
6. Add a maintenance work order without assigning maintenance; then invite maintenance and verify assignment guidance.
7. Add an owner contact and a guest contact; confirm both appear in their lists and are not treated as portal logins.
8. Invite Property Manager, Property Owner, Cleaner, Maintenance, and Accountant roles; confirm property assignment appears only where relevant.
9. Upload an allowed private file as an allowed role; verify signed view link behavior and empty states for roles without files.
10. Open Reports before and after adding records; verify disabled/enabled export behavior.
11. Create a direct booking page for a property with manual approval; confirm public link state and requests table empty state.
12. Check notifications empty state, mark-read actions if records exist, and settings provider language.
13. Verify account/settings pages do not expose secrets and do not show unsafe reset/demo controls in production-facing UI.
