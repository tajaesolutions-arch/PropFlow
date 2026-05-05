# PropFlow

PropFlow is a property management SaaS foundation for property owners, Airbnb hosts, landlords, property managers, realtors, cleaning companies, maintenance crews, villa operators, guesthouse operators, hotel/small resort operators, and real estate companies.

## Current project status

Phase 1 moves PropFlow from local sample-data behavior to a database-first Supabase MVP foundation:

- Supabase Auth is the real auth flow for signup, login, logout, and session persistence.
- Workspace membership, roles, workspace switching, and suspended-account handling are loaded from Supabase.
- Users without workspace membership are routed to `/workspace-setup` to create or join a workspace.
- Demo login buttons have been removed from the production login UI.
- Customer-facing operational pages no longer depend on seeded fake customer data.
- Empty accounts show clean empty states instead of fake properties, bookings, revenue, guests, reports, cleaning tasks, or maintenance jobs.

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

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the local Vite URL shown in your terminal.

## Build

```bash
npm run build
```

## Environment variables

Create `.env.local` when connecting a Supabase project:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

If these variables are missing, the app does not crash. Login, signup, and settings display a clean Supabase setup message instead of showing demo login controls.

## Required Supabase migrations

Run this migration on a new Supabase project:

```bash
supabase/migrations/202605050001_propflow_schema.sql
```

The migration creates:

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

## Apply migrations

With the Supabase CLI linked to your project:

```bash
supabase db push
```

For local Supabase development:

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

Property write access is limited to `workspace_owner` and `property_manager`. Cleaning and maintenance creation is limited to `workspace_owner`, `property_manager`, and `host`, with assigned lower-role access represented in RLS helper policies.

## Storage behavior

Operational uploads use the private `propflow-private` bucket. Paths are scoped by `workspace_id`, and upload metadata is recorded in `file_uploads`. The app does not expose permanent public URLs; signed/authenticated download flows can be layered on this foundation.

Supported MVP categories include property photos/documents, leases, contracts, receipts, invoices, cleaning before/after photos, maintenance photos/videos, and repair completion photos.

## Known limitations

- Billing UI is a placeholder; Stripe is not connected.
- Reports, PDF exports, CSV exports, and owner statements are placeholders.
- Bookings and external booking platform integrations are not connected.
- Guest CRM is a placeholder.
- Notifications table exists, but automation is not implemented.
- Smart Tools / AI Tools is a coming-soon placeholder.
- Email invite sending is provider-ready only; if Resend or another provider is not configured, the UI still creates an invite and lets admins copy the link.
- Automated tests are not yet included.

## Recommended next phase

1. Add a serverless/email provider path for workspace invite emails.
2. Add bookings and checkout-triggered cleaning task generation.
3. Add signed download UI for private files.
4. Add owner/property assignment management UI.
5. Add notification jobs and operational reminders.
6. Add finance/reporting models before Stripe billing and exports.
