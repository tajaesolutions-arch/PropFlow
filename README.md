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

The current Phase 1 schema migration is:

```text
supabase/migrations/202605050001_propflow_schema.sql
```

Apply this migration before running the app against a Supabase project. If you see `Could not find the table 'public.workspaces' in the schema cache`, the migration has not been applied to that project, was applied to a different project, or Supabase needs its API schema cache refreshed after the SQL runs.

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

## Exact Supabase migration instructions

### Option A: Supabase SQL Editor

Use this path when the hosted app is already connected to a Supabase project or when you need to fix a project that is missing `public.workspaces`.

1. Open the Supabase Dashboard for the exact project used by `VITE_SUPABASE_URL`.
2. Go to **SQL Editor** → **New query**.
3. Copy the full contents of `supabase/migrations/202605050001_propflow_schema.sql`.
4. Paste the full SQL into the editor and click **Run**. The file is idempotent and uses `CREATE TABLE IF NOT EXISTS`, non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and policy/trigger replacement so it can be run again if needed.
5. In **Table Editor**, confirm the `public.workspaces` table exists along with the other Phase 1 tables listed above.
6. If the app still reports a schema-cache error immediately after running the SQL, wait briefly and reload the app; Supabase PostgREST schema cache refresh can lag right after DDL.

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
5. New workspace creation inserts a workspace and makes the creator a `workspace_owner`.
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
- [ ] User can create a workspace and becomes `workspace_owner`.
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
