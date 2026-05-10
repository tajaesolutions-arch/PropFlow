# PropFlow

PropFlow is a property management SaaS foundation for property owners, Airbnb hosts, landlords, property managers, realtors, cleaning companies, maintenance crews, villa operators, guesthouse operators, hotel/small resort operators, and real estate companies.

## Current post-merge status

This branch is a stabilization pass after Phase 1 was merged. The app remains a database-first Supabase MVP foundation and is ready for continued feature development once a real Supabase project is connected.

Validated/fixed in this pass:

- `npm install` completes with the checked-in lockfile.
- `npm run build` completes successfully with Vite.
- Public landing and pricing routes render without Supabase environment variables.
- Login, signup, workspace setup, and settings surfaces show clear Supabase configuration messages when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.
- Demo login remains removed from the production auth UI.
- Role dashboard routing is guarded so users are redirected to their expected dashboard if they manually visit another role dashboard.
- Workspace creation sanitizes optional numeric fields and records the creator.
- Workspace invite creation strips non-customer roles defensively and stores empty expiration dates as `null`.
- Upload actions fail cleanly when no file/workspace/Supabase Storage bucket is available.
- RLS was tightened for workspace membership self-insert, profile visibility, property assignments, maintenance insert reporting, and assigned property access.

## Phase 1 scope

Implemented in this phase:

- Supabase Auth session handling.
- Workspace creation and invite/code-based join flow.
- Workspace memberships with fixed MVP roles.
- Role-priority routing:
  - `propflow_admin` → `/admin`
  - `workspace_owner`, `property_manager`, `host` → `/dashboard`
  - `property_owner` → `/owner-dashboard`
  - `cleaner` → `/cleaner-dashboard`
  - `maintenance` → `/maintenance-dashboard`
  - `accountant` → `/accountant-dashboard`
- Suspended-account routing to `/suspended` with workspace-data access blocked by RLS.
- Properties list/detail connected to Supabase.
- Property create, edit, archive, restore, filters, and archived toggle.
- Cleaning tasks connected to Supabase with status updates, notes, supplies, issue flag, and private photo upload hooks.
- Maintenance work orders connected to Supabase with priority/status/cost/parts fields and private upload hooks.
- Workspace Owner team invite system with invite tokens/links and copy-link fallback.
- Private Supabase Storage bucket and file metadata table for MVP upload categories.
- Basic activity logs schema and write helpers.
- Polished coming-soon placeholders for out-of-scope pages.

Not implemented in this phase:

- Stripe billing.
- Full notification automation.
- Full reports/PDF/CSV exports.
- Direct booking public pages.
- Airbnb/Booking.com/Vrbo API integrations.
- Twilio SMS/WhatsApp automation.
- Real AI tools.

## Tech stack

- React
- Vite
- Supabase Auth, Postgres, RLS, and Storage
- Lucide React icons
- Recharts dependency retained for existing chart components
- Standard CSS using the PropFlow design tokens

## Exact local setup

Install dependencies:

```bash
npm install
```

Create `.env.local` only when connecting to Supabase:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run locally:

```bash
npm run dev
```

Open the local Vite URL shown in your terminal.

Build locally:

```bash
npm run build
```

## Vercel deployment readiness

Set these exact Vercel environment variables for Preview and Production deployments:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

No server-only Supabase service role key is required by this front-end build. Do **not** expose a Supabase service role key in Vite variables.

Expected behavior without Vercel env vars:

- `/` and `/pricing` should still render.
- `/login` and `/signup` should render but display a setup/configuration message.
- Protected routes redirect to `/login` because no real Supabase Auth session can exist.
- Database-backed actions return clear configuration errors instead of crashing the app.

## Required Supabase migration

The current Phase 1 schema migrations are:

```text
supabase/migrations/202605050001_propflow_schema.sql
supabase/migrations/202605060001_create_workspace_with_owner_rpc.sql
```

Apply both migrations before running the app against a Supabase project. If you see `Could not find the table 'public.workspaces' in the schema cache`, the base migration has not been applied to that project, was applied to a different project, or Supabase needs its API schema cache refreshed after the SQL runs.

The migration creates or repairs these app-required objects without dropping customer data:

- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_invites`
- `properties`
- `property_assignments`
- `cleaning_tasks`
- `maintenance_work_orders`
- `file_uploads`
- `activity_logs`
- `notifications`
- private Storage bucket `propflow-private`
- RLS helper functions and table/storage policies
- secure `public.create_workspace_with_owner(...)` RPC for initial workspace creation

## Exact Supabase migration instructions

### Option A: Supabase SQL Editor

Use this path when the hosted app is already connected to a Supabase project or when you need to fix a project that is missing `public.workspaces`.

1. Open the Supabase Dashboard for the exact project used by `VITE_SUPABASE_URL`.
2. Go to **SQL Editor** → **New query**.
3. Copy the full contents of `supabase/migrations/202605050001_propflow_schema.sql`.
4. Paste the full SQL into the editor and click **Run**. The file is idempotent and uses `CREATE TABLE IF NOT EXISTS`, non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and policy/trigger replacement so it can be run again if needed.
5. Open another **New query**, copy the full contents of `supabase/migrations/202605060001_create_workspace_with_owner_rpc.sql`, paste it, and click **Run**. This second migration creates the `SECURITY DEFINER` RPC used by the app for workspace creation and drops the older broad direct `workspaces` insert policy.
6. In **Table Editor**, confirm the `public.workspaces` table exists along with the other Phase 1 tables listed above. In **Database** → **Functions**, confirm `public.create_workspace_with_owner` exists and is executable by authenticated users.
7. If the app still reports a schema-cache error immediately after running the SQL, wait briefly and reload the app; Supabase PostgREST schema cache refresh can lag right after DDL.

### Option B: Supabase CLI for a hosted project

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### Option C: Local Supabase development

```bash
supabase start
supabase db reset
```

`supabase/seed/seed_demo.sql` is now only a placeholder. Create real test accounts through Supabase Auth and create workspace data through the UI.

## Auth and workspace behavior

1. Users sign up or log in with Supabase Auth.
2. The app upserts/loads `profiles` for the authenticated user.
3. The app loads `workspace_members` and joined `workspaces`.
4. If the user has no workspace membership, they are routed to `/workspace-setup`.
5. New workspace creation calls the secure `public.create_workspace_with_owner(...)` RPC, which upserts the creator profile, inserts the workspace, adds owner membership, writes an activity log when available, and returns the created workspace. Authenticated clients should not insert directly into `public.workspaces`.
6. Joining by invite token or workspace/company code only succeeds when a pending invite exists for the authenticated user's email and is not expired/revoked.
7. Users with multiple workspaces can switch the active workspace from the top bar.
8. Suspended users can log in but are routed to `/suspended` and RLS blocks workspace data.

## Role and permission notes

MVP active roles:

- `propflow_admin`
- `workspace_owner`
- `property_manager`
- `host`
- `property_owner`
- `cleaner`
- `maintenance`
- `accountant`

Customers cannot invite or assign `propflow_admin`. That role is platform-level only and must be controlled by trusted backend/admin operations.

Property write access is limited to `workspace_owner` and `property_manager`. Cleaning and maintenance creation is limited to `workspace_owner`, `property_manager`, and `host`. Assigned lower-role users can access only the operational records/properties exposed by RLS through property assignments, assigned cleaning tasks, assigned maintenance work orders, or reported issues.

## Manual test checklist

Use a real Supabase project for these checks:

- [ ] `/` renders logged out.
- [ ] `/pricing` renders logged out.
- [ ] `/login` renders and no demo login is present.
- [ ] `/signup` creates a Supabase Auth user or shows email-confirmation messaging.
- [ ] New authenticated user without membership is routed to `/workspace-setup`.
- [ ] User can create a workspace through the `create_workspace_with_owner` RPC and becomes `workspace_owner`.
- [ ] Owner lands on `/dashboard`.
- [ ] Owner can open `/settings` and create an invite.
- [ ] Invite role dropdown does not include `propflow_admin`.
- [ ] Invite link copy works when no email provider is configured.
- [ ] Invite acceptance requires matching authenticated email and valid pending token/code.
- [ ] Owner/Property Manager can create a property.
- [ ] Host can view operational workspace data but cannot create/edit/archive property profiles.
- [ ] Archived properties are hidden by default and can be shown with the archived filter.
- [ ] Property detail page loads for authorized users.
- [ ] Property archive and restore work; permanent delete is not exposed as the main action.
- [ ] Cleaning page displays an empty state with no data.
- [ ] Owner/Property Manager/Host can create a cleaning task with no booking record.
- [ ] Cleaning statuses can be updated: `scheduled`, `in_progress`, `completed`, `needs_inspection`, `guest_ready`.
- [ ] Maintenance page displays an empty state with no data.
- [ ] Owner/Property Manager/Host can create a maintenance work order.
- [ ] Urgent maintenance work orders are visually separated in the urgent panel.
- [ ] Upload controls do not crash when the private bucket is missing; they show a Supabase error.
- [ ] Private Storage upload succeeds after the `propflow-private` bucket and policies are applied.
- [ ] Logout clears session and protected routes redirect to `/login`.
- [ ] Suspended profile or membership routes to `/suspended` and cannot read workspace data.

## Storage behavior

Operational uploads use the private `propflow-private` bucket. Paths are scoped by `workspace_id`, and upload metadata is recorded in `file_uploads`. The app does not expose permanent public URLs; signed/authenticated download flows can be layered on this foundation.

Supported MVP categories include property photos/documents, leases, contracts, receipts, invoices, cleaning before/after photos, maintenance photos, and repair completion photos.

## Known limitations

- Billing UI is a placeholder; Stripe is not connected.
- Reports, PDF exports, CSV exports, and owner statements are placeholders.
- Bookings and external booking platform integrations are not connected.
- Guest CRM is a placeholder.
- Notifications table exists, but automation is not implemented.
- Smart Tools / AI Tools is a coming-soon placeholder.
- Email invite sending is provider-ready only; if Resend or another provider is not configured, the UI still creates an invite and lets admins copy the link.
- Assignment-management UI is still limited. The migration can create invite-based property assignments, but a full owner/cleaner/maintenance assignment management screen should be built next.
- Automated tests are not yet included.
- Migration SQL was reviewed statically in this environment; Supabase CLI/psql were not installed here, so run `supabase db reset` or `supabase db push` against a real project before production launch.

## Recommended next development phase

1. Add a serverless/email provider path for workspace invite emails.
2. Add owner/property/team assignment management UI.
3. Add bookings and checkout-triggered cleaning task generation.
4. Add signed download UI for private files.
5. Add notification jobs and operational reminders.
6. Add finance/reporting models before Stripe billing and exports.

## Bookings + Calendar foundation phase

This phase adds a database-first foundation for PropFlow reservations, leases, guest/tenant CRM, checkout cleaning automation, and an operations calendar. It intentionally does **not** add Stripe payment collection, public direct booking pages, Airbnb/Booking.com/Vrbo API integrations, Twilio/WhatsApp/SMS, or real AI tools.

### New migration

Apply this migration after the Phase 1 migrations and workspace RPC migration:

```text
supabase/migrations/202605060002_bookings_calendar_foundation.sql
```

The migration is written to be safe for existing projects where practical: it uses `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, trigger replacement, policy replacement, and non-destructive indexes. For hosted Supabase projects, run the migrations in this order:

```bash
supabase/migrations/202605050001_propflow_schema.sql
supabase/migrations/202605060001_create_workspace_with_owner_rpc.sql
supabase/migrations/202605060002_bookings_calendar_foundation.sql
```

Or with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### Tables added

- `contacts`: workspace-scoped CRM records for guests, tenants, owners, vendors, cleaners, maintenance contacts, and other contacts. Contacts are matched by `workspace_id + lower(email)` when an email exists.
- `bookings`: workspace-scoped short-term reservation records with guest details, property, stay dates, source/platform, status, payment status, per-record currency, financial fields, cancellation timestamp, and checkout cleaning preference.
- `leases`: workspace-scoped long-term rental records with tenant details, property, lease dates, rent/deposit amounts, rent status, lease status, per-record currency, optional future document file reference, and termination timestamp.

### RLS and permissions

RLS is enabled on `contacts`, `bookings`, and `leases`.

- Active workspace members only see rows scoped to their workspace and permitted role/property access.
- `workspace_owner`, `property_manager`, and `host` can create and edit bookings and leases.
- `property_owner` can view booking and lease data for assigned/accessible properties.
- `accountant` can view workspace booking/lease financial records.
- Cleaner and maintenance visibility is limited through assigned cleaning tasks and maintenance/property access policies.
- Suspended profile/workspace/member checks continue to flow through the existing helper functions.
- `propflow_admin` remains platform-only and is not customer-assignable.

### 2026-05-10 create-action RLS audit

`supabase/migrations/202605100001_rls_create_action_alignment.sql` aligns server-side RLS with the current create-action modal and AppContext save rules. The audit keeps schema changes non-destructive, does not add broad `USING (true)` customer-data policies, and tightens workspace/property linkage for invites, assignments, contacts, bookings, leases, cleaning tasks, maintenance work orders, supplies, file uploads, activity logs, notifications, and report exports. Customer invites and workspace memberships remain limited to valid customer roles; `propflow_admin` remains excluded from customer workspace roles and must be controlled only by trusted platform/admin operations.

### Double-booking rules

Database triggers block unsafe overlaps before insert/update:

- A property cannot have overlapping pending/confirmed/checked-in short-term bookings.
- A property cannot have overlapping active/ending-soon long-term leases.
- A short-term booking cannot overlap an active/ending-soon lease for the same property.
- An active/ending-soon lease cannot overlap pending/confirmed/checked-in bookings for the same property.

The frontend also returns friendly conflict messages surfaced from these database checks.

### Cleaning automation rule

When a short-term booking is created or updated with `auto_create_cleaning = true`, the database creates or updates one linked `cleaning_tasks` row after checkout. The task is linked by `cleaning_tasks.booking_id`, uses the same `workspace_id` and `property_id`, defaults to `scheduled`, and leaves `assigned_cleaner_id` blank unless future default cleaner logic is added. When a booking is cancelled, related future cleaning tasks are marked `cancelled`.

### Bookings UI scope

`/bookings` is now a combined workspace page with tabs for:

- Short-Term Bookings
- Long-Term Leases

The page supports create, edit, view, cancel/terminate flows; auto contact create/update; property/date/status/payment/source/currency filters; name search; cancelled hidden by default; and summary metrics for booking operations and lease operations.

### Calendar scope

`/calendar` displays Supabase-backed operational events:

- Short-term booking stay blocks
- Check-in events
- Check-out events
- Checkout cleaning tasks
- Maintenance work orders by due date
- Long-term lease period blocks and start/end markers

Calendar views included now:

- Month
- Week
- Day
- List / agenda

The property timeline and drag-and-drop rescheduling are intentionally prepared as future extension points, not built in this phase.

### Known limitations

- No public direct booking engine yet.
- No channel-manager/API sync with Airbnb, Booking.com, Vrbo, iCal, or CSV imports yet; source values are placeholders only.
- No payment collection, payout automation, live currency conversion, or invoice ledger yet.
- Lease document upload is a placeholder field for a future private upload flow.
- Property status is derived in operational views; there is no background scheduler for persistent daily status transitions yet.
- Calendar drag-and-drop editing/rescheduling is not enabled yet.

### Next recommended phase

Build the revenue and guest operations layer next: direct booking request intake, quote/invoice records, payment ledger readiness, iCal import/export, property timeline view, cleaner assignment rules, and richer owner/accountant reporting.

### Bookings + Calendar manual test checklist

Use a migrated Supabase project with at least one real workspace and property:

- [ ] Existing workspace setup still redirects authenticated workspace-less users to `/workspace-setup` and creates workspaces through `create_workspace_with_owner`.
- [ ] Existing Properties page can create and list properties.
- [ ] Existing Cleaning page can create and update cleaning tasks.
- [ ] Existing Maintenance page can create and update work orders.
- [ ] Create a short-term booking on `/bookings`.
- [ ] Confirm a `contacts` row is created or updated with `contact_type = guest` and linked to `bookings.contact_id`.
- [ ] Confirm a linked checkout `cleaning_tasks` row is auto-created when `auto_create_cleaning` is enabled.
- [ ] Attempt an overlapping booking for the same property and confirm the database conflict is blocked with a clear UI error.
- [ ] Create a long-term lease on `/bookings`.
- [ ] Confirm a `contacts` row is created or updated with `contact_type = tenant` and linked to `leases.contact_id`.
- [ ] Attempt overlapping leases and booking/lease conflicts for the same property and confirm they are blocked.
- [ ] Confirm booking and lease search/filter controls work.
- [ ] Confirm `/calendar` displays bookings, leases, cleaning tasks, and maintenance work orders.
- [ ] Confirm cancelled bookings/leases are hidden by default and appear when **Show cancelled** is enabled.
