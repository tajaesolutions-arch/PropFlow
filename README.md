# PropFlow

PropFlow is a property management SaaS foundation for property owners, Airbnb hosts, landlords, property managers, realtors, cleaning companies, maintenance crews, villa operators, guesthouse operators, hotel/small resort operators, and real estate companies.


## Current Stability Status

PR #194 is a focused stabilization pass after the state-check fallback guardrails. It verifies the app can install, test, and build cleanly while hardening safe empty states, route-level runtime recovery, app-level runtime recovery, and missing-Supabase configuration behavior.

Install dependencies from the lockfile:

```bash
npm ci
```

Run the stability tests:

```bash
npm test
```

Build the Vite app:

```bash
npm run build
```

Required frontend Supabase variables for authenticated workspace workflows are:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional public runtime flags used by the frontend include:

```bash
VITE_APP_ENV=local
VITE_APP_URL=http://localhost:5173
VITE_SUPABASE_STORAGE_CONFIGURED=false
```

When `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, or both are missing, PropFlow should not crash or keep auth loading forever. Public pages remain available, authenticated database actions are disabled, and setup/configuration notices explain that a public Supabase URL and anon key are required before login, workspace setup, and workspace data actions can run. No frontend code should reference a Supabase service-role key.

Known remaining production TODOs before declaring the app fully production-ready:

- Complete deployment-specific Supabase migration/RLS verification against the real project.
- Validate real authenticated role routing and workspace scoping with seeded non-demo accounts.
- Finish production billing, notification, upload scanning, observability, backup, and incident-response checks.
- Keep Stripe, Resend, Twilio, and service-role credentials server-only in Vercel/API settings.


## Supabase Production Readiness

PR #196 is an audit and hardening checkpoint before PropFlow moves further into real Supabase-backed production data. It does **not** claim full production readiness yet; it confirms the current safety posture, documents remaining gaps, and keeps follow-up work focused. See [`docs/SUPABASE_READINESS_AUDIT.md`](docs/SUPABASE_READINESS_AUDIT.md) for the founder-readable audit, RLS notes, workspace-scoping notes, and production hold checklist.

Required frontend Vite variables for authenticated Supabase workflows are:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

If either variable is missing or invalid, the frontend should not crash, should not keep authentication loading forever, and should keep the Supabase browser client `null`. Public pages remain available, while login, workspace setup, and authenticated workspace actions show safe setup messaging instead of using demo data or fake persistence.

Current status:

- The browser app has one intended Supabase client in `src/lib/supabase.js` and it uses only public Vite configuration.
- Supabase Auth role routing is based on loaded profile/workspace membership state, not manual role selection in the login UI.
- Workspace data queries in AppContext are scoped by the selected `workspace_id`; RLS remains the source of truth for real data protection.
- Demo seed SQL is kept under `supabase/seed/` for local/demo environments only and must not be applied to production.
- Remaining production TODOs include live Supabase migration/RLS verification, real role-account QA, private storage verification, provider hardening, backups, monitoring, and incident-response checks.

Run the validation commands before opening or promoting a PR:

```bash
npm ci
npm test
npm run build
```

## Current post-merge status

This branch is a stabilization pass after Phase 1 was merged. The app remains a database-first Supabase MVP foundation and is ready for continued feature development once a real Supabase project is connected.

Validated/fixed in this pass:

- `npm install` completes with the checked-in lockfile.
- `npm run build` completes successfully with Vite.
- Public landing and pricing routes render without Supabase environment variables.
- Login, signup, workspace setup, and settings surfaces show clear Supabase configuration messages when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.
- Demo login remains removed from the production auth UI.
- Role dashboard routing is guarded so users are redirected to their expected dashboard if they manually visit another role dashboard.
- Workspace creation uses the authenticated `public.create_workspace_with_owner(...)` RPC so hardened RLS can block broad direct inserts while still creating the workspace and owner membership safely.
- Workspace invite creation strips non-customer roles defensively and stores empty expiration dates as `null`.
- Upload actions fail cleanly when no file/workspace/Supabase Storage bucket is available.
- RLS was tightened for workspace membership self-insert, profile visibility, property assignments, maintenance insert reporting, and assigned property access.


## Runtime QA Checklist

PR #195 focuses on click-through stability rather than new product scope. Use this checklist before launch reviews and after route, modal, or role changes:

- Routes checked for safe rendering/no white screen: `/`, `/pricing`, `/login`, `/signup`, `/join`, `/suspended`, `/dashboard`, `/admin`, `/owner-dashboard`, `/cleaner-dashboard`, `/maintenance-dashboard`, `/properties`, `/bookings`, `/cleaning`, `/maintenance`, `/owners`, `/guests`, `/calendar`, `/reports`, `/notifications`, `/settings`, and `/account`.
- Role flows checked: PropFlow Admin routes to `/admin`; Workspace Owner, Property Manager, and Host route to `/dashboard`; Property Owner routes to `/owner-dashboard`; Cleaner routes to `/cleaner-dashboard`; Maintenance Crew routes to `/maintenance-dashboard`; suspended users route to `/suspended`; authenticated users without an active workspace route to workspace setup/join.
- Empty-state safety notes: workspace collections must tolerate empty or missing arrays, missing workspace/user context, and missing relationship data without `map`, `length`, or nested-property crashes. Pages should show clean “No data yet” states with a real next action or clear setup guidance.
- Modal/create-action notes: Add/Create buttons should open the shared create-action modal when available, show permission/setup guidance for blocked roles or missing workspace context, close safely via cancel, Escape, close button, or backdrop, and avoid fake persistence when the AppContext save action is not connected.
- Supabase missing-env behavior: when `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, or both are missing, the frontend keeps public pages available, does not leave auth loading stuck, uses a `null` Supabase client, and shows setup notices without exposing secrets. Frontend code must not reference service-role keys.
- Mobile polish checked: landing/pricing/auth pages plus dashboard, properties, bookings, cleaner, maintenance, owner, and settings views should avoid horizontal overflow; tables should scroll inside their cards; sidebars and modals should not permanently cover content.
- Known remaining production TODOs: complete real Supabase migration/RLS verification, production auth/role QA with seeded accounts, Stripe billing, private upload verification, notification provider wiring, reports exports, deployment monitoring, and final Vercel/Supabase environment hardening before claiming full production readiness.

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
- Cleaning tasks connected to Supabase with workspace/property scoping, shared Add Cleaning Task modal validation, booking linkage, assigned-cleaner dashboard visibility, status updates, notes, supplies, issue flags, and private photo upload hooks.
- Maintenance work orders connected to Supabase with priority/status/cost/parts fields and private upload hooks.
- Workspace Owner team invite system with invite tokens/links and copy-link fallback.
- Private Supabase Storage bucket `workspace-files`, workspace-scoped `file_uploads` metadata, signed viewing links, and a Files / Documents workspace page for permitted roles.
- Basic activity logs schema and write helpers.
- Polished coming-soon placeholders for out-of-scope pages.

Not implemented in this phase:

- Advanced Stripe billing features such as usage metering, coupons, custom invoice UI, and billing analytics. The focused Stripe Checkout, Customer Portal, and webhook foundation is present in `/api/create-stripe-checkout-session`, `/api/create-stripe-customer-portal-session`, and `/api/stripe-webhook`.
- Full notification automation.
- Full reports/PDF/CSV exports.
- Live guest payment checkout for direct bookings.
- Airbnb/Booking.com/Vrbo API integrations.
- Two-way iCal export/channel-manager sync for direct booking channels.
- Twilio SMS/WhatsApp automation.
- Real AI tools.


## Direct Booking public request foundation

- Public direct booking pages use the route `/book/:slug` and are intentionally rendered outside the private dashboard/sidebar layout.
- Workspace Owners, Property Managers, and Hosts can manage direct booking pages from `/direct-bookings`; pages are linked one-to-one with existing workspace properties and default to `manual_approval` plus `payment_mode = none`.
- Public guests can submit booking requests or general inquiries against a published page. These records stay in `direct_booking_requests` and are **not** internal bookings until a manager reviews and explicitly converts them.
- Approved/under-review manual requests can be converted into internal bookings with `source = direct`, `status = pending`, and `payment_status = unpaid`; payment-required requests must be `paid` before conversion.
- Online direct booking payment is limited to the explicit `instant_booking` + `full_payment` Stripe Checkout path. Deposit/refund automation and channel-manager payment sync remain future work.
- Public page data is loaded through safe public RPCs that return only public page/property fields and unavailable date ranges. Existing booking guest names, internal notes, owner payouts, revenue, expenses, workspace members, operational tasks, and private file paths are not exposed.
- Property photos and operational uploads remain private by default. Public pages use a placeholder visual unless a future public-marked media workflow is deliberately added.
- Apply `supabase/migrations/202605100016_direct_booking_foundation.sql` after the earlier workspace, property, booking, notification, and billing migrations. The frontend uses only the Supabase anon key; do **not** expose a Supabase service-role key in Vite/frontend environment variables.
- Public request spam/rate limiting is future backend protection; this foundation restricts anon inserts through RLS to published, matching direct booking pages only.


## Production launch readiness runbook (May 2026)

This repository is launch-stabilized as an MVP foundation, not a fully automated production operations platform. Before pointing real customers at a hosted environment, complete the checklist below against the target Supabase and Vercel projects.

### Required environment variables

Frontend/Vite variables for local development and Vercel Preview/Production:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=
VITE_APP_URL=
VITE_SUPABASE_STORAGE_CONFIGURED=false
```

Serverless/API variables used only by Vercel functions when those endpoints are enabled:

```bash
APP_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
RESEND_ALLOW_NON_PRODUCTION_SENDS=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
```

Do **not** expose Supabase service-role keys, Stripe secrets, Twilio tokens, or Resend API keys in any `VITE_*` variable or frontend code. Never commit real keys. Stripe Checkout, webhook processing, and transactional email run only through server-side Vercel API routes; missing provider env vars return setup/provider-not-configured responses instead of crashing. Configure Vercel Preview and Production variables separately so test projects, live projects, and callback URLs are not mixed.

### Supabase migrations and founder admin bootstrap

Apply every file in `supabase/migrations/` in ascending filename order, including the latest production-readiness patch. The full validation kit is in `DEPLOYMENT_CHECKLIST.md`, `SUPABASE_RUNTIME_TEST_PLAN.md`, `VERCEL_RUNTIME_TEST_PLAN.md`, `MIGRATION_MANIFEST.md`, and `docs/PRODUCTION_ENVIRONMENT_VERIFICATION.md`.

```text
supabase/migrations/202605050001_propflow_schema.sql
supabase/migrations/202605060001_create_workspace_with_owner_rpc.sql
supabase/migrations/202605060002_bookings_calendar_foundation.sql
supabase/migrations/202605060003_fix_booking_form_persistence.sql
supabase/migrations/202605060004_billing_foundation.sql
supabase/migrations/202605060004_inventory_foundation.sql
supabase/migrations/202605060005_notification_provider_foundation.sql
supabase/migrations/202605060006_reports_export_foundation.sql
supabase/migrations/202605060007_direct_booking_foundation.sql
supabase/migrations/202605100001_rls_create_action_alignment.sql
supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql
supabase/migrations/202605100003_properties_rls_alignment.sql
supabase/migrations/202605100004_bookings_rls_alignment.sql
supabase/migrations/202605100005_cleaning_tasks_rls_alignment.sql
supabase/migrations/202605100006_maintenance_work_orders_rls_alignment.sql
supabase/migrations/202605100007_contacts_owners_guests_rls_alignment.sql
supabase/migrations/202605100008_reports_owner_reports_rls_alignment.sql
supabase/migrations/202605100009_expenses_finance_foundation.sql
supabase/migrations/202605100010_supplies_inventory_rls_alignment.sql
supabase/migrations/202605100012_files_documents_media_foundation.sql
supabase/migrations/202605100013_team_invites_roles_rls_alignment.sql
supabase/migrations/202605100014_notifications_foundation.sql
supabase/migrations/202605100015_billing_subscription_foundation.sql
supabase/migrations/202605100016_direct_booking_foundation.sql
supabase/migrations/202605100017_leases_long_term_rentals_foundation.sql
supabase/migrations/202605100018_ical_calendar_import_foundation.sql
supabase/migrations/202605100019_platform_admin_foundation.sql
supabase/migrations/202605100020_production_readiness_rls_patch.sql
supabase/migrations/202605110001_in_app_notifications_hardening.sql
supabase/migrations/202605110001_workspace_invite_assignment_update_trigger.sql
supabase/migrations/202605110002_plan_limits_enforcement.sql
supabase/migrations/202605110002_private_file_uploads_foundation.sql
supabase/migrations/202605170001_properties_workspace_crud_alignment.sql
```

After migrations, create the founder/team account through Supabase Auth, then manually bootstrap SaaS-level admin access from a trusted SQL console only:

```sql
update public.profiles
set is_propflow_admin = true
where email = 'founder@example.com';
```

PropFlow Admin is a platform role only. Do not invite platform admins through customer workspace invites, and do not assign `propflow_admin` inside `workspace_members.roles`.


### Properties Supabase CRUD

The Properties module now uses the active workspace as the required Supabase scope for real property records. `src/lib/properties.js` centralizes list/get/create/update helpers, always requires `workspace_id`, normalizes snake_case database fields into the UI-safe property shape, trims user input, converts empty optional fields to `null`, and returns user-safe errors when Supabase is missing or RLS blocks a write.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured and the signed-in user has an active workspace, `/properties` loads real rows from `public.properties`, shows loading/empty states, supports search/filtering against loaded records, and refreshes after the shared Add Property modal saves. Missing Supabase env vars or no active workspace keep the UI safe: no unscoped queries are attempted, fake production properties are not shown, and submit is disabled with a setup notice.

Database policy alignment lives in `supabase/migrations/202605170001_properties_workspace_crud_alignment.sql`: reads continue through `can_access_property(workspace_id, id)`, creates require an active Workspace Owner / Company Admin, Property Manager, or Host membership in the inserted `workspace_id`, and updates remain limited to Workspace Owner / Company Admin and Property Manager. Lower roles such as Property Owner, Cleaner, and Maintenance Crew do not receive broad property create/update access.

### Private storage bucket setup

Create the Supabase Storage bucket named `workspace-files` as **private**. The latest storage migration attempts to create/update this bucket with `public = false`, a 25 MB object limit, and the launch MIME allowlist. If a hosted/self-hosted Supabase environment cannot manage Storage buckets from SQL, create it manually in **Storage → New bucket** with **Name** `workspace-files`, **Public bucket** off, **File size limit** `25 MB`, and allowed MIME types `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Apply the storage/file migrations and policies before testing uploads.

Private upload metadata reuses `public.file_uploads` (no duplicate upload table) with workspace scoping, entity context, metadata, and `visibility = private`. Objects are stored under `workspaces/{workspace_id}/{entity_type}/{entity_id}/{timestamp}-{safe_file_name}`. The app stores private object paths only and creates short-lived signed URLs after authorized metadata checks; raw signed URLs are not saved in the database, and public buckets are not required for property photos, cleaning proof photos, maintenance photos, receipts, invoices, leases, reports, contracts, or documents.

Supported private upload types are property photos, cleaning before/after photos, maintenance issue/completion photos, receipts, invoices, leases, contracts, report files, and general documents. Images are limited to JPEG, PNG, and WebP up to 10 MB. Documents are limited to PDF, JPEG, PNG, WebP, DOCX, and XLSX up to 25 MB. Video uploads are intentionally not supported yet and should show “Video uploads coming soon.”

RLS and Storage policies require active workspace membership and block suspended users. Workspace Owners / Company Admins and Property Managers can view/manage workspace files; Hosts can view operational workspace files; Owners are limited to assigned property files, released reports, leases/contracts, and owner-related documents; Cleaners can upload/view assigned cleaning task photos only; Maintenance Crew can upload/view assigned work-order photos only; PropFlow Admin metadata visibility is gated by the existing platform admin helper. Do not weaken these policies or add policies that return `true` globally.

Future production TODOs: virus/malware scanning, video uploads, richer document previews, OCR/document search, and advanced owner document sharing.

### Vercel deployment notes

- Deploy the Vite app and `/api/*` serverless functions together.
- Set frontend env vars in both Preview and Production, including `VITE_SUPABASE_STORAGE_CONFIGURED=true` only after the private `workspace-files` bucket exists.
- Set server-only Supabase/API CORS variables for deployed API routes and keep Stripe/Resend/Twilio secrets blank until implementing those providers; missing provider env vars should return safe setup-required/provider-not-configured responses.
- Re-run `npm install`, `npm run build`, and `git diff --check` before promoting a deployment.
- If Supabase reports a missing table/RPC immediately after migration, wait for PostgREST schema cache refresh and reload before weakening RLS or adding direct frontend inserts.

### Provider status and launch non-goals

- Stripe subscription billing has a secure foundation: Workspace Owners can request server-created Checkout Sessions and Customer Portal Sessions when server-only Stripe env vars are configured, and the webhook endpoint verifies Stripe signatures before syncing workspace subscription state. Usage metering, coupons, custom invoice UI, and billing analytics are not active.
- Resend transactional email has a server-side foundation and sends only when production server env vars are configured; Twilio SMS and Twilio WhatsApp external sends are not live.
- Direct booking guest payment status is handled through the secure Stripe foundation where configured; PropFlow never stores card data.
- iCal import is a one-way import foundation with SSRF-protected fetches; two-way sync/channel-manager integrations are not live.
- CSV/PDF exports, receipt OCR, AI tools, rent payment automation, e-signature/legal generation, scheduled owner reports, tax/accounting automation, and external channel manager integrations remain explicit non-goals for this launch pass.
- No fake/demo data should be added to production workflows; new workspaces should show real empty states.

### Manual QA checklist

- Public routes: `/`, `/pricing`, `/login`, `/signup`, `/join`, `/suspended`, and `/book/:slug` render without the private sidebar and fail safely when Supabase is unavailable.
- Protected workspace routes redirect unauthenticated users to `/login` and workspace-less non-admin users to `/workspace-setup`.
- PropFlow Admin can access `/admin` without a customer workspace and is redirected away from customer workspace routes.
- Workspace Owner/Company Admin can access dashboard, billing, team/settings, files, reports, direct bookings, iCal imports, leases, notifications, and settings for only the active workspace.
- Property Manager/Host can access intended operational pages and cannot access platform admin.
- Property Owner, Cleaner, Maintenance Crew, and Accountant dashboards show role-scoped real data/empty states only.
- Billing-restricted workspaces show recovery messaging and keep owner/accountant billing recovery available.
- Frontend plan gates are UX-only; the database/backend plan-limit helpers and triggers are the production enforcement source of truth for active properties, team members, owner reports, direct booking pages, advanced reports, AI-tool preview gates, and priority-support flags.
- Public direct booking requests validate min/max nights, date overlap, imported iCal blocks, and privileged fields at both frontend and RLS policy layers.
- Mobile smoke test the sidebar/topbar, tables, modals, public booking form, and admin dashboard at 390px and 768px widths.

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
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=local
VITE_APP_URL=http://localhost:5173
VITE_SUPABASE_STORAGE_CONFIGURED=false
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

Set these exact frontend Vercel environment variables for Preview and Production deployments:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=preview|production
VITE_APP_URL=https://your-propflow-domain.example
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Serverless billing endpoints require server-only Supabase and Stripe variables in Vercel Project Settings. Do **not** expose a Supabase service role key or Stripe secret key in Vite variables.

Set these server-only variables for `/api/create-stripe-checkout-session`, `/api/create-stripe-customer-portal-session`, `/api/create-billing-portal-session`, and `/api/stripe-webhook`:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=https://your-propflow-domain.example
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
```

Frontend-safe variables remain limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_APP_URL`, and other non-secret `VITE_*` flags. Missing Stripe or service-role values make the billing endpoints return `provider_not_configured` with the user-safe message `Stripe billing is not configured yet.` instead of crashing or mutating frontend billing state.


Stripe Customer Portal setup notes:

- Enable and configure the Stripe Customer Portal in the Stripe Dashboard before exposing billing management to customers.
- PropFlow creates Customer Portal sessions only from the server-side `/api/create-stripe-customer-portal-session` endpoint, with `/api/create-billing-portal-session` kept as a compatibility alias.
- Workspace Owners can open the portal from Settings or Pricing after the workspace has a stored `stripe_customer_id`; lower workspace roles cannot create portal sessions.
- Portal features may include invoice history, payment method updates, subscription updates, and cancellation depending on your Stripe Dashboard configuration.
- Some subscriptions cannot be updated in the portal depending on Stripe product, price, and portal settings.
- Trialing subscription changes may end the trial depending on your Stripe portal configuration.
- Stripe Customer Portal cannot be embedded in an iframe; PropFlow redirects the owner to Stripe and uses a same-origin return URL such as `/settings?tab=billing`.

Stripe webhook setup notes:

- Configure the Stripe Dashboard webhook URL to `https://your-propflow-domain.example/api/stripe-webhook`.
- Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `invoice.payment_succeeded`.
- Use the webhook signing secret as `STRIPE_WEBHOOK_SECRET`; do not commit real Stripe keys.
- For local webhook testing, forward events with the Stripe CLI to your local Vercel/serverless route and set temporary test-mode server env vars outside source control.

Expected behavior without Vercel env vars:

- `/` and `/pricing` should still render.
- `/login` and `/signup` should render but display a setup/configuration message.
- Protected routes redirect to `/login` because no real Supabase Auth session can exist.
- Database-backed actions return clear configuration errors instead of crashing the app.

## Required Supabase migrations

Apply every file in `supabase/migrations/` in ascending filename order before running the app against a Supabase project. See `MIGRATION_MANIFEST.md` for purpose and runtime tests for every migration, and use `DEPLOYMENT_CHECKLIST.md` plus `SUPABASE_RUNTIME_TEST_PLAN.md` for the real hosted-project validation pass.

Important runtime notes:

- The final `202605100002_create_workspace_with_owner_rpc.sql` RPC migration must be applied after `202605100001_rls_create_action_alignment.sql`.
- If you see `Could not find the table 'public.workspaces' in the schema cache`, the base migration has not been applied to that project, was applied to a different project, or Supabase needs its API schema cache refreshed after the SQL runs.
- After applying DDL/function migrations, wait briefly and refresh PostgREST schema cache before changing policies or adding direct inserts.

The migrations create or repair these app-required objects without dropping customer data:

- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_invites`
- `properties`
- `property_assignments`
- `contacts`, owners, guests, bookings, leases, expenses, supplies, reports, direct booking, and iCal import tables
- `cleaning_tasks`
- `maintenance_work_orders`
- `file_uploads`
- `activity_logs`
- `notifications` and provider-safe delivery logs
- private Storage bucket expectation and policies for `workspace-files`
- RLS helper functions and table/storage policies
- secure `public.create_workspace_with_owner(...)` RPC for initial workspace creation
- platform admin RPCs gated by `profiles.is_propflow_admin`

## Exact Supabase migration instructions

### Option A: Supabase SQL Editor

Use this path when the hosted app is already connected to a Supabase project or when you need to fix a project that is missing `public.workspaces`.

1. Open the Supabase Dashboard for the exact project used by `VITE_SUPABASE_URL`.
2. Go to **SQL Editor** → **New query**.
3. Copy the full contents of `supabase/migrations/202605050001_propflow_schema.sql`.
4. Paste the full SQL into the editor and click **Run**. The file is idempotent and uses `CREATE TABLE IF NOT EXISTS`, non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and policy/trigger replacement so it can be run again if needed.
5. Open additional **New query** tabs and apply every remaining migration file in ascending filename order as listed above and in `MIGRATION_MANIFEST.md`, including `supabase/migrations/202605100001_rls_create_action_alignment.sql` followed by `supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql`. The final RPC migration creates the hardened `SECURITY DEFINER` workspace creation function used by the app and grants execute only to authenticated users.
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

### Developer runtime diagnostics checklist

Use this quick checklist before debugging onboarding as an application bug:

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for the deployed frontend environment.
- [ ] A real Supabase Auth session exists for the browser/user being tested.
- [ ] The user has either no workspace yet (expected route: `/workspace-setup`) or a valid selected workspace in `workspace_members`.
- [ ] `supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql` has been applied and Supabase has had a short moment to refresh the API schema cache.

## Auth and workspace behavior

1. Users sign up or log in with Supabase Auth.
2. The app upserts/loads `profiles` for the authenticated user.
3. The app loads `workspace_members` and joined `workspaces`.
4. If the user has no workspace membership, they are routed to `/workspace-setup`.
5. New workspace creation calls the secure `public.create_workspace_with_owner(...)` RPC, which requires `auth.uid()`, upserts a non-admin creator profile when needed, inserts the workspace, adds `workspace_owner` membership, validates launch currencies (`USD`, `JMD`, `CAD`, `GBP`, `EUR`), and returns the created workspace. Authenticated clients should not insert directly into `public.workspaces` or `public.workspace_members` for initial workspace setup.
6. Joining by invite token or workspace/company code only succeeds when a pending invite exists for the authenticated user's email and is not expired/revoked.
7. Users with multiple workspaces can switch the active workspace from the top bar.
8. Suspended users can log in but are routed to `/suspended` and RLS blocks workspace data.


### Workspace creation RPC under hardened RLS

Workspace creation now uses `public.create_workspace_with_owner(...)` from frontend code instead of direct client inserts into `public.workspaces` and `public.workspace_members`. Apply `supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql` after `supabase/migrations/202605100001_rls_create_action_alignment.sql` so strict RLS can remain in place without blocking first-workspace setup.

The required frontend environment variables are:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=
VITE_APP_URL=
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Do **not** use or expose a Supabase service-role key in frontend code.


## Contacts, owners, and guest CRM notes

- Contacts are workspace-scoped CRM records in Supabase and are loaded through the active `workspace_id`.
- Owners and guests created from **Add Owner** / **Add Guest** are contact records unless the person is also invited as a workspace login user.
- Owner portal access is controlled through workspace member invites and the `property_owner` role; `properties.assigned_owner_id` points to an invited workspace member/profile, not an owner CRM contact.
- **Add Owner** and **Add Guest** use the shared create-action modal and save through the shared AppContext contact action.
- Real records require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the Supabase migrations applied in ascending filename order.
- The frontend uses the Supabase anon key only. Do **not** expose a Supabase service-role key in Vite/frontend environment variables.

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

Property creation is limited to `workspace_owner`, `property_manager`, and `host`; property updates/archive actions remain limited to `workspace_owner` and `property_manager`. Cleaning and maintenance creation is limited to `workspace_owner`, `property_manager`, and `host`. Assigned lower-role users can access only the operational records/properties exposed by RLS through property assignments, assigned cleaning tasks, assigned maintenance work orders, or reported issues. Cleaning tasks are always workspace/property scoped; the shared Add Cleaning Task modal requires a real property, optional booking links must match the selected property, assigned cleaners must be active workspace cleaner members, and cleaner dashboards remain assigned-task scoped. Maintenance work orders are workspace/property scoped, use the shared Add Maintenance Work Order modal, require a real property, validate active maintenance-member assignments, and keep the Maintenance Crew dashboard assigned-work-order scoped. Maintenance issue/completion files use private workspace upload hooks and real records require Supabase env vars plus applied migrations. Frontend code uses only the anon key and never a service-role key.


## Team, invites, and role-management notes

- Team management remains workspace-scoped in **Settings**; no duplicate Team page or duplicate invite system is used for MVP.
- Workspace Owners / Company Admins create and revoke team invites. Property Managers can manage property assignments but cannot invite members, grant higher workspace roles, or edit roles in this release.
- Workspace invites require a matching authenticated email plus a valid pending token or company-code invite record. A company/workspace code alone does **not** grant access.
- Invited users who open a valid invite link after signup/login are joined to the workspace immediately when the email, token/code, status, and expiration checks pass.
- `propflow_admin` is platform-level only. It is excluded from customer invite options, workspace member updates, and property assignment flows.
- Property assignments are real Supabase records for property-specific visibility. Assignment roles are limited to `property_owner`, `cleaner`, `maintenance`, `host`, and `accountant`, and the assigned user must be an active workspace member with the matching role.
- Owner CRM contacts are not the same as owner login users; owner portal access requires a workspace member invite with the `property_owner` role.
- Email sending is not wired yet. PropFlow creates copyable invite links only, and workspace owners must send those links manually until a backend email provider is connected.
- Custom permissions are future work. MVP access uses fixed workspace roles and RLS policies.
- Real team records require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and all Supabase migrations applied in ascending filename order. Frontend code uses the anon key only and must never expose a service-role key.

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
- [ ] Company code join fails unless the signed-in email has a matching pending invite.
- [ ] Expired, revoked, and accepted invites cannot be reused.
- [ ] Workspace Owner can suspend, reactivate, and revoke non-last-owner members without hard-deleting member history.
- [ ] Property Manager can manage property assignments but cannot invite members or manage lifecycle controls.
- [ ] Cleaner/Maintenance/Property Owner/Host/Accountant cannot view broad member lists or manage team access unless explicitly allowed by RLS and UI.
- [ ] Property assignment creation requires an active member with the matching assignment role and a property in the current workspace.
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
- [ ] Private Storage upload succeeds after the `workspace-files` bucket and policies are applied.
- [ ] Logout clears session and protected routes redirect to `/login`.
- [ ] Suspended profile or membership routes to `/suspended` and cannot read workspace data.

## Files / Documents and private Storage behavior

Operational files use the private Supabase Storage bucket `workspace-files`; public buckets are not used for property photos, cleaning photos, maintenance photos, receipts, leases, contracts, reports, invoices, or internal documents. Storage paths include the workspace id using the convention `workspaces/{workspace_id}/{entity_type}/{entity_id}/{timestamp}-{safe_file_name}`, while `file_uploads` stores workspace-scoped metadata only.

Files can be linked to properties, bookings, cleaning tasks, maintenance work orders, expenses, owner reports, contacts, or workspace-level documents. Viewing/downloading uses short-lived Supabase signed URLs created from authorized `file_uploads` records; permanent public URLs are not stored in the database. The frontend uses the Supabase anon client only and must never expose a service-role key.

Supported MVP categories include property photos, cleaning before/after photos, maintenance issue/completion photos, receipts, invoices, leases, contracts, report files, and general documents. Video uploads are not supported yet. Receipt uploads and report document files remain placeholder-safe unless a workflow explicitly links them to real expense or owner-report records. Real uploads require Supabase environment variables, the latest migrations, and the private `workspace-files` bucket/policies applied.

## Known limitations

- Billing UI starts Stripe Checkout only for Workspace Owners when server env vars are configured; otherwise it shows `Stripe billing is not configured yet.` safely. Customer portal, invoices UI, usage metering, coupons, and billing analytics are still not implemented.
- Reports/export foundation supports safe local CSV and browser print-to-PDF exports from role-authorized records. Scheduled delivery, stored generated PDFs, AI summaries, and accountant-grade automation remain future work.
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
6. Add stored generated report files and scheduled delivery after backend report jobs are designed.

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
# ...continue applying any remaining 20260506xxxx feature migrations...
supabase/migrations/202605100001_rls_create_action_alignment.sql
supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql
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



### 2026-05-10 team invites and role-management RLS audit

`supabase/migrations/202605100013_team_invites_roles_rls_alignment.sql` adds non-destructive guards for team access: customer role validation, owner-only invite creation/revocation, matching-email invite acceptance, last-active-owner protection, member lifecycle status updates, and property assignment validation against active members with matching roles. The audit does not add broad `USING (true)` or `WITH CHECK (true)` customer-data policies, does not add fake users/invites, and keeps `propflow_admin` out of customer workspace roles.

### 2026-05-10 bookings module hardening

Bookings are workspace-scoped and property-scoped from the shared **Add Booking** create-action modal through AppContext and Supabase RLS. Real booking records require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the Supabase migrations applied; frontend code uses the anon client only and does not expose or require a service-role key.

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

`/calendar` is a unified operations schedule derived from existing Supabase workspace-scoped records loaded by the app context. It does not create fake/demo events and does not query a separate calendar table. Real records require the Supabase environment variables to be configured and the migrations in this repository to be applied.

Current event sources:

- Short-term booking stay blocks
- Check-in events
- Check-out events
- Checkout cleaning tasks
- Maintenance work orders by due date
- Long-term lease start/end events and lease period blocks when a lease end date is available

Calendar views included now:

- Month
- Week
- Day
- List / agenda

Calendar create buttons use the shared create-action modal and remain limited to roles allowed to create bookings or cleaning tasks. Staff calendar visibility is role-scoped through protected routing and sidebar navigation so owner, cleaner, maintenance, and accountant users do not receive a broad workspace calendar by accident. External API integrations such as Google Calendar, Airbnb, Booking.com, Vrbo, and two-way iCal export are not connected yet; the iCal import foundation is manager-controlled and block-only. Drag-and-drop editing, recurring events, public sharing, and notification automation are intentionally future extension points, not built in this phase.

### Known limitations

- No public direct booking engine yet.
- No channel-manager/API sync with Airbnb, Booking.com, Vrbo, iCal export, or CSV imports yet; iCal URL imports are block-only and manager-controlled.
- No payment collection, payout automation, live currency conversion, or invoice ledger yet.
- Lease document upload is a placeholder field for a future private upload flow.
- Property status is derived in operational views; there is no background scheduler for persistent daily status transitions yet.
- Calendar drag-and-drop editing/rescheduling is not enabled yet.

### Next recommended phase

Build the revenue and guest operations layer next: direct booking request intake, quote/invoice records, payment ledger readiness, iCal export, property timeline view, cleaner assignment rules, and richer owner/accountant reporting.

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

### Reports / Owner Reports scope

Reports are workspace-scoped Supabase records. Owner reports should include a workspace-owned property and, when applicable, an owner member or owner contact reference so owner-facing views remain property/owner scoped.

The owner dashboard only displays released owner-report statuses (`released`, `published`, `sent`, `delivered`, or `completed`) for assigned properties. Draft/internal reports stay hidden from Property Owner users.

PDF export, CSV export, scheduled report automation, and generated owner statements remain placeholder-safe in the frontend. PropFlow does not generate fake report files or sample report records; real records require Supabase environment variables and all migrations applied. Frontend code uses the public Supabase client only and must not include a service-role key.

## Finance / Expenses safety note

Manual expenses are workspace-scoped Supabase records once the expenses foundation migration is applied. The Expenses page and Accountant Dashboard use those records for operational finance previews alongside bookings, cleaning tasks, maintenance work orders, and owner reports.

Finance summaries in PropFlow are not finalized accounting ledgers, tax filings, invoices, owner statements, or payout instructions. CSV/PDF exports remain disabled until backend export generation is added, and receipt upload stays placeholder-safe unless private receipt storage is explicitly connected to a real expense record through `file_uploads`. Real records require the Supabase environment variables to be configured and migrations applied; frontend code uses the Supabase anon client and does not use or expose a service-role key.

## Supplies / Inventory safety note

Supplies are real, workspace-scoped Supabase records that can be tracked either against a specific property or as workspace-wide inventory. Low-stock status is derived in-app from `current_quantity` and `low_stock_threshold`: zero or below is out of stock, quantities at or below the threshold are low stock, archived records are soft-hidden by `archived_at`, and all other active records are in stock.

Estimated inventory value is an operational preview based on current quantity and estimated unit cost; it is not finalized accounting, tax, invoice, payout, purchase-order, or payment data. Adding or editing supplies does not automatically create expenses, vendor invoices, supplier payments, purchase orders, exports, or accounting automation.

Supplier/contact details and cost visibility are role-limited. Workspace Owner / Company Admin, Property Manager, and Host roles can manage supplies; Accountant users can review supplier details and estimated inventory value in read-only mode; Property Owner, Cleaner, and Maintenance Crew roles do not receive broad inventory-ledger access. Real inventory records require Supabase environment variables and applied migrations, and frontend code uses only the Supabase anon client without any service-role key. Missing Supabase env vars return clean empty inventory states instead of crashing the app.

Advanced procurement remains intentionally out of scope for this MVP wiring: barcode scanning, vendor ordering, purchase orders, automated supplier purchasing, and accounting/export automation are future follow-up items. Recommended next PR: wire Calendar / iCal records to workspace-scoped Supabase CRUD.

## Notifications / Provider Settings foundation

In-app notifications use the existing workspace-scoped `public.notifications` table. Apply `supabase/migrations/202605100014_notifications_foundation.sql` and the hardening migration `supabase/migrations/202605110001_in_app_notifications_hardening.sql` before production notification testing. The table stores notification type/title/message, priority, read state, optional action URLs, related entity references, recipient user or recipient role, metadata, and workspace ownership for RLS.

The notification center and topbar bell read real Supabase rows in Supabase mode, remain safe in local/demo mode when Supabase env vars are missing, and support unread counts plus mark-as-read behavior for notifications assigned to the signed-in user. Notification creation is intentionally best-effort from app workflows so a failed notification insert does not block the primary booking, cleaning, maintenance, report, invite, billing, or property action.

RLS remains the source of truth: Workspace Owner / Company Admin, Property Manager, and Host roles can read workspace operational notifications; Property Owners, Cleaners, and Maintenance Crew users see only directly assigned notifications or role/property/task-context notifications; users cannot read another workspace's notification data; recipients can update only their own read/archive state; and no policy uses a broad `USING (true)` customer-data rule. PropFlow Admin access uses the platform-admin helper where available and remains separate from customer workspace roles.

Email, SMS, and WhatsApp provider delivery is still future work and is not implemented in this in-app notifications PR. The planned provider direction is Resend for email and Twilio for SMS/WhatsApp, using only secure server-side or Supabase Edge Function environment variables. No Resend/Twilio delivery env vars are required for this in-app-only foundation, and frontend code must never contain provider secrets, webhook secrets, or Supabase service-role keys.

`notification_preferences`, `notification_provider_settings`, and `notification_delivery_logs` remain provider-safe foundation tables for future delivery phases. They store non-secret preferences/status/log state only; real external sending, retries, and provider webhooks must be added in a separate backend-reviewed PR.

## Billing / Subscription Foundation

PropFlow billing is workspace-scoped and uses `workspace_subscriptions` for one subscription state record per workspace plus `billing_events` for audit/history records. Apply `supabase/migrations/202605100015_billing_subscription_foundation.sql` before runtime billing tests.

- New workspaces can initialize a safe `trialing` subscription row with a 14-day default trial. This does **not** create a paid Stripe subscription or fake Stripe IDs.
- Stripe checkout, billing portal, and webhook processing must run only through server-side endpoints with server environment variables such as `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, and `STRIPE_PRICE_BUSINESS`.
- Frontend code must never contain Stripe secret keys, webhook secrets, Supabase service-role keys, or provider tokens.
- The Vercel `api/` Stripe endpoints validate owner access, create server-side subscription Checkout Sessions, verify webhook signatures from the raw request body, and sync Stripe subscription status back into `workspace_subscriptions`. Missing server env vars still return `provider_not_configured` safely.
- Failed payments should enter a grace-period model instead of causing instant lockout. After the grace period, workspace access becomes recovery-only for Workspace Owners/Accountants while operational staff may be limited until billing is resolved.
- Do not insert fake active subscriptions, fake checkout success, fake portal links, generated invoices, tax automation, coupons, or usage-based billing records from the frontend.

## Long-Term Rentals / Leases Foundation

PropFlow includes an MVP foundation for manual long-term rental and lease tracking:

- Leases are stored in the real `public.leases` Supabase table and scoped to both `workspace_id` and `property_id`.
- Tenants can be represented by a workspace CRM contact (`tenant_contact_id`) or by lease-level tenant name/email/phone fields for manual setup.
- Rent fields are operational summaries only: amount, frequency, due day, deposit status, and manual payment status. PropFlow does **not** automate rent collection, late fees, tenant payment portals, Stripe rent payments, or accounting ledger entries.
- Lease documents must remain private. Upload lease/contract files through the private Files module, then link the private file to a lease; no public lease document URLs are created.
- The app does **not** provide e-signature, legal lease generation, or contract drafting.
- Calendar views can display real lease start, lease period, and lease end events from workspace lease records. No fake/demo leases are added.
- Lease route/sidebar visibility is role-restricted. Workspace Owners and Property Managers manage leases; Hosts and Accountants may view when allowed by RLS; Cleaners and Maintenance Crew do not access lease records.
- Apply the Supabase migrations before using the module so the leases table, tenant contact alignment, constraints, indexes, triggers, and RLS policies are available.


## iCal / Calendar Imports foundation

- Calendar import feeds are workspace- and property-scoped. Workspace Owners, Property Managers, and Hosts can add iCal feed URLs per property from `/calendar-imports`.
- External iCal URLs are treated as sensitive operational data and are restricted by RLS to calendar-import manager roles; Owner, Cleaner, Maintenance, and public direct-booking views do not receive raw feed URLs.
- Imported iCal events are stored as calendar blocks by default (`booking_block`, `unavailable_block`, `owner_block`, `maintenance_block`, or `unknown`) and appear on the internal Calendar alongside bookings, leases, cleaning, and maintenance.
- Managers can review feed status, recent sync runs, imported events, and conflicts. Conflicts are created for invalid dates, duplicate/unsupported imported data foundations, and overlaps with internal bookings, direct booking requests, or leases.
- A server-side Vercel API route `/api/import-ical-feed` (with `/api/sync-ical-feed` kept as a compatibility alias) performs CORS-safe feed fetching with authenticated user JWT/RLS, a 2 MB response limit, timeout protection, plain-text parsing, and no frontend service-role key exposure.
- Auto-create bookings and cleaning tasks are disabled by default. Managers may manually convert an imported block to an unpaid internal booking; this does not create guest contacts, mark payment as paid, or auto-create cleaning.
- Public direct booking availability uses imported calendar blocks as unavailable date ranges without exposing feed provider details, URLs, event descriptions, guest names, or raw event data.
- This foundation does **not** add Airbnb, Vrbo, Booking.com, Google, or Outlook API integrations; it only supports iCal URL import.
- This foundation does **not** add two-way sync/export, channel-manager automation, instant booking confirmation, or payment automation.
- Apply `supabase/migrations/202605100018_ical_calendar_import_foundation.sql` after the existing workspace, property, booking, direct booking, notification, and lease migrations before using calendar imports.

## Platform Admin / Founder Admin operations

PropFlow Admin is a SaaS/platform-level role for the founder or trusted PropFlow team only. It is **not** a customer workspace role, must not be offered in workspace invite/team forms, and must not be assigned through customer-managed membership flows.

Apply `supabase/migrations/202605100019_platform_admin_foundation.sql` before using `/admin` for platform-wide operations. The migration adds secure admin-only RPCs for platform overview metrics, workspace review, user review, health reporting, audit logs, and internal admin notes. Normal customer workspace RLS remains workspace-scoped; the frontend admin dashboard reads platform-wide data only through those RPCs.

### Manual founder bootstrap

Bootstrap the first founder admin through a trusted Supabase SQL/admin process after the founder has a profile row. Do not expose the service-role key in frontend code and do not let customers update `profiles.is_propflow_admin`.

Example non-destructive bootstrap by email:

```sql
update public.profiles
set is_propflow_admin = true,
    account_status = 'active',
    status = 'active',
    updated_at = now()
where lower(email) = lower('founder@example.com');
```

Or by user id:

```sql
update public.profiles
set is_propflow_admin = true,
    account_status = 'active',
    status = 'active',
    updated_at = now()
where id = '00000000-0000-0000-0000-000000000000';
```

Operational warnings:

- Never invite `propflow_admin` through workspace invite forms.
- Never expose service-role, Stripe, Resend, Twilio, webhook, API key, or provider secrets in frontend code.
- `/admin` is protected by the PropFlow Admin role and the admin RPCs deny authenticated non-admin users.
- Platform admin audit logs and notes are visible only to PropFlow Admin profiles.
- Admin controls do not hard-delete customer data; status changes require audit logs and reasons for restrictive actions.
- If the migration is missing, `/admin` shows a setup-required state instead of fake/demo platform metrics.

## Deployment, security, monitoring, and launch-hardening foundation

This launch-hardening pass prepares PropFlow for Vercel + Supabase operations without enabling live payments, live email/SMS/WhatsApp, invasive analytics, public operational storage, or fake/demo production data.

### Environment configuration audit

Use `.env.example` as the source template. Frontend-safe variables are limited to:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=local|preview|staging|production
VITE_APP_URL=https://your-propflow-domain.example
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Server-only values must be configured only in Vercel Project Settings or a local server runtime, never in frontend `VITE_*` variables:

```bash
APP_URL=https://your-propflow-domain.example
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # required by trusted billing API routes; never frontend
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
RESEND_ALLOW_NON_PRODUCTION_SENDS=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
```

Current Stripe behavior is a focused subscription foundation only: Checkout Sessions and webhook subscription sync are implemented, while customer portal, invoices UI, metering, coupons, billing analytics, and external notifications are intentionally not added. Resend, SMS, and WhatsApp external sends remain provider-not-configured/stubbed until separate live provider implementations are reviewed and deployed.

### Launch checklist

Before sending production traffic to PropFlow, confirm every item below in the target Supabase and Vercel projects:

- [ ] Supabase migrations were applied in order by filename.
- [ ] Founder PropFlow Admin profile was bootstrapped with the platform-only admin flag.
- [ ] RLS policies were verified with real role-based users, not only frontend hiding.
- [ ] Vercel frontend env vars are configured: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_APP_URL`, `VITE_SUPABASE_STORAGE_CONFIGURED`.
- [ ] Vercel server env vars are configured for API stubs/providers as needed and contain no frontend prefixes.
- [ ] Private Supabase Storage bucket `workspace-files` exists and is not public.
- [ ] Public direct booking pages were tested with safe public fields only.
- [ ] iCal sync was tested with a safe external feed and private/internal URL blocking remained active.
- [ ] Stripe test-mode Checkout and webhook events were validated in Vercel/local serverless logs; customer portal, invoices UI, metering, coupons, and analytics remain out of scope.
- [ ] Notification external sends remain `provider_not_configured` until Resend/Twilio live senders are implemented server-side.
- [ ] Workspace Owner, Property Manager/Host, Owner, Cleaner, Maintenance, and Accountant role tests passed.
- [ ] No fake/demo data exists in the production workspace.
- [ ] No public storage leaks exist for private operational files.

### Migration order and production rules

Apply every migration in `supabase/migrations` in ascending filename order:

```text
supabase/migrations/202605050001_propflow_schema.sql
supabase/migrations/202605060001_create_workspace_with_owner_rpc.sql
supabase/migrations/202605060002_bookings_calendar_foundation.sql
supabase/migrations/202605060003_fix_booking_form_persistence.sql
supabase/migrations/202605060004_billing_foundation.sql
supabase/migrations/202605060004_inventory_foundation.sql
supabase/migrations/202605060005_notification_provider_foundation.sql
supabase/migrations/202605060006_reports_export_foundation.sql
supabase/migrations/202605060007_direct_booking_foundation.sql
supabase/migrations/202605100001_rls_create_action_alignment.sql
supabase/migrations/202605100002_create_workspace_with_owner_rpc.sql
supabase/migrations/202605100003_properties_rls_alignment.sql
supabase/migrations/202605100004_bookings_rls_alignment.sql
supabase/migrations/202605100005_cleaning_tasks_rls_alignment.sql
supabase/migrations/202605100006_maintenance_work_orders_rls_alignment.sql
supabase/migrations/202605100007_contacts_owners_guests_rls_alignment.sql
supabase/migrations/202605100008_reports_owner_reports_rls_alignment.sql
supabase/migrations/202605100009_expenses_finance_foundation.sql
supabase/migrations/202605100010_supplies_inventory_rls_alignment.sql
supabase/migrations/202605100012_files_documents_media_foundation.sql
supabase/migrations/202605100013_team_invites_roles_rls_alignment.sql
supabase/migrations/202605100014_notifications_foundation.sql
supabase/migrations/202605100015_billing_subscription_foundation.sql
supabase/migrations/202605100016_direct_booking_foundation.sql
supabase/migrations/202605100017_leases_long_term_rentals_foundation.sql
supabase/migrations/202605100018_ical_calendar_import_foundation.sql
supabase/migrations/202605100019_platform_admin_foundation.sql
supabase/migrations/202605100020_production_readiness_rls_patch.sql
supabase/migrations/202605110001_in_app_notifications_hardening.sql
supabase/migrations/202605110001_workspace_invite_assignment_update_trigger.sql
supabase/migrations/202605110002_plan_limits_enforcement.sql
supabase/migrations/202605110002_private_file_uploads_foundation.sql
supabase/migrations/202605170001_properties_workspace_crud_alignment.sql
```

Important migration notes:

- Apply all migrations in order by filename.
- Supabase CLI was not always available during Codex work, so manual Supabase runtime testing is required after applying SQL.
- After applying RPC/function migrations, Supabase/PostgREST schema cache may need a refresh before RPCs are visible to the app.
- Never edit old applied migrations destructively in production. Add a new forward-only migration for production fixes.

### Vercel deployment documentation

Recommended Vercel settings:

- Framework preset: **Vite**.
- Install command: `npm install`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Required frontend env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, `VITE_APP_URL`, `VITE_SUPABASE_STORAGE_CONFIGURED`.
- Server env vars for current API routes/stubs: `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, Stripe keys/prices for future billing, and Resend/Twilio keys for future notifications. Keep all server secrets unprefixed by `VITE_`.

Redeploy process:

1. Push or merge the target branch to GitHub.
2. Open Vercel → PropFlow project → Deployments.
3. Select the new deployment or click **Redeploy** after changing env vars.
4. Review build logs for dependency installation, Vite build output, and serverless function bundling.
5. The current Vite chunk-size warning is non-fatal unless it becomes a measured performance issue; revisit with route-level/code-splitting work if customer performance degrades.

`vercel.json` adds conservative security headers. CSP is intentionally deferred because a strict policy can break Vite assets, Supabase auth redirects, and public booking pages if it is not tested against the final production domain and asset/provider list.

### Supabase deployment documentation

1. Create a Supabase project for the environment.
2. Apply all migrations in filename order.
3. Configure Auth redirect URLs for the deployed Vercel domain, preview domains if used, and local development URLs.
4. Confirm RLS is enabled and policies protect workspace-scoped data.
5. Create/confirm the private Storage bucket `workspace-files`.
6. Bootstrap the founder/team PropFlow Admin profile; do not grant customer workspace admins platform admin by company code alone.
7. Confirm public direct booking RPCs expose only safe public page/property fields.
8. Confirm iCal sync tables/RPC-dependent screens are present and SSRF validation remains active.
9. Confirm platform admin RPCs return overview, workspace, user, and health data only to PropFlow Admin.
10. Test with real Supabase Auth users for every launch role.

### Security checklist

- [ ] No Supabase service-role key is present in frontend code, Vite env vars, logs, or browser responses.
- [ ] No Stripe secrets are present in frontend code or `VITE_*` env vars.
- [ ] No Twilio/Resend secrets are present in frontend code or `VITE_*` env vars.
- [ ] Public direct booking pages expose safe public fields only.
- [ ] Private files use private bucket storage and signed URLs.
- [ ] iCal feed SSRF protection blocks localhost, private networks, internal hostnames, embedded credentials, unsafe redirects, and oversized feeds.
- [ ] RLS protects workspace data and role/property assignment boundaries.
- [ ] PropFlow Admin is platform-only and distinct from customer Workspace Owner/Admin.
- [ ] Company code alone does not grant workspace access without accepted membership/invite flow and RLS checks.
- [ ] Billing restricted users have an owner/accountant recovery path.

### Admin health diagnostics

The `/admin` Platform Health panel is safe to use for launch diagnostics. It shows setup-required status, app environment label, provider stub status, private bucket name expectation, iCal failures/conflicts, billing restricted workspace counts, provider-not-configured delivery counts, and migration/RPC warnings. It intentionally does not show secret values.

### Remaining manual deployment test steps

After Vercel and Supabase are configured, manually test:

- Signup/login and auth redirects on the production domain.
- Workspace creation RPC and schema-cache visibility.
- Role-priority routing for PropFlow Admin, Workspace Owner/Admin, Property Manager/Host, Accountant, Property Owner, Maintenance, and Cleaner.
- Private file upload/download signed URL flow against `workspace-files`.
- Public `/book/:slug` direct booking flow with safe data only.
- iCal sync with a known-safe HTTPS feed and blocked private/internal URLs.
- Billing and notification screens remain provider-not-configured until live provider work is intentionally added.

## Reports and export foundation

PropFlow now includes a safe MVP reporting center for role-authorized workspace data. The foundation supports owner reports, revenue reports, expense reports, maintenance cost reports, cleaning cost reports, occupancy reports, and property performance reports. Reports are derived from records the current user can already see; the UI does not invent finance numbers, does not create fake/demo exported reports, and does not mark local preview exports as official accounting statements.

CSV export is client-side and uses clean headers for each supported report type. CSV rows are built from role-scoped records only and avoid raw JSON dumps or permanent file URLs. When activity logging is configured, report export actions attempt a non-blocking `report_exported` activity log entry.

PDF export uses a lightweight browser print/export-to-PDF flow instead of adding a heavy PDF dependency. The printable report includes the PropFlow name, workspace name, title, date range, generated date, property/owner context where applicable, summary metrics, report rows, and the disclaimer: “This report is for property management review and may require accounting verification.” Generated PDFs are not uploaded automatically, public report links are not created, and private signed file URLs are not embedded in exported content.

Role-based visibility follows the existing app navigation and Supabase RLS model. Workspace Owners and Property Managers can see the full report center for their workspace. Hosts see operational reports. Accountants can see finance-oriented reports where the role exists. Property Owners see only assigned-property owner/occupancy/performance report data and released/ready owner report records returned by RLS. Cleaner and Maintenance Crew roles do not receive finance or owner report center access.

Plan limits use the existing `planLimits` helpers. Basic owner reports remain visible where permitted, monthly owner-report usage is shown, and advanced reports display upgrade messaging when the current plan does not include advanced reporting. Frontend gates are UX only; backend/database plan-limit enforcement remains the production source of truth.

The database foundation enhances the existing `public.owner_reports` metadata table rather than duplicating it. It adds optional private report file metadata linkage through `file_uploads`, JSON summary metadata, generated-by metadata, and stricter report type/status alignment while preserving existing rows and RLS protections.

Known future TODOs:

- Scheduled monthly owner reports.
- Email delivery through Resend.
- SMS/WhatsApp alerts through Twilio.
- Stored generated PDFs.
- AI report summaries.
- Accountant-grade financial automation.

### Calendar + iCal MVP foundation alignment

PropFlow now keeps a workspace-scoped calendar foundation that combines internal bookings, check-in/check-out markers, cleaning task dates, maintenance due dates, and imported iCal blocks from the existing `calendar_import_feeds` and `calendar_import_events` tables. The shared `src/lib/calendarImports.js` helper normalizes iCal providers, validates HTTPS feed URLs, parses ICS dates/events, maps imported records, deduplicates imports, builds unified calendar event objects, and returns event tone classes for the custom calendar UI.

Supported one-way iCal providers for the MVP foundation are Airbnb iCal, Booking.com iCal, Vrbo iCal, Google iCal, and Other iCal. Managers add feeds manually; manual imports are user-triggered through the authenticated serverless endpoint at `/api/import-ical-feed`, which aliases the existing sync implementation. The endpoint validates the Supabase session, relies on RLS-scoped feed access, fetches feeds server-side, requires HTTPS URLs, blocks localhost/private/internal hostnames and resolved private IPs, limits feed size/event counts, parses events, upserts imported calendar events, updates feed sync status, and returns summary counts only. It does not log full feed contents or expose service-role keys to frontend code.

Calendar visibility remains role-safe: Workspace Owners/Company Admins, Property Managers, and Hosts can manage iCal feeds and imported events for their workspace; assigned Property Owners can view imported blocks for assigned properties without seeing feed URLs; cleaners and maintenance users continue to see their assigned cleaning/work-order schedules and booking context through existing task-scoped RLS; suspended/revoked users are excluded by active workspace-membership checks. No policy grants global `USING (true)` access to customer calendar data.

Known future TODOs: automatic scheduled iCal sync, two-way channel manager sync, full Airbnb/Booking.com/Vrbo API integrations, Google Calendar OAuth, automated reminders, conflict detection UX expansion, and advanced availability rules. None of those future integrations are added in this MVP foundation.

### Direct booking request + payment foundation hardening

PropFlow now treats public direct booking as a safe request-first MVP workflow. Public `/book/:slug` pages load only the safe public page/property fields returned by the direct-booking RPCs, show stay rules and rate previews where configured, and submit booking requests through `/api/create-direct-booking-request` instead of writing directly to Supabase from the browser. The endpoint validates the public page slug/page id, active published page status, property/workspace ownership, guest name, email format, check-in/check-out dates, stay length, adult/child counts, required phone/message rules, and availability before inserting a request.

Manual approval remains the default. Manual pages create `direct_booking_requests` rows with a manager-review status and `payment_status = not_required`. If a page is explicitly configured for `booking_mode = instant_booking` and `payment_mode = full_payment`, the server endpoint may start Stripe Checkout after validation and returns only the request id, status, safe message, and Checkout URL. Stripe secrets stay server-only; the frontend never imports or reads `STRIPE_SECRET_KEY`, and the Supabase service-role key is used only by serverless endpoints.

Direct booking Stripe Checkout sessions use payment metadata for `workspace_id`, `property_id`, `direct_booking_request_id`, and `booking_type = direct_booking`. The Stripe webhook updates `direct_booking_requests.payment_status` to `paid`, `failed`, or `expired`, stores safe Stripe session/payment-intent ids, and creates non-blocking notifications/activity logs for managers. The webhook does not automate refunds and does not add deposit logic.

Availability checks now use a shared helper for normalized date ranges, overlap detection, availability blocks, conflict detection, and clean conflict messages. Public request submission and manager conversion both re-check active bookings, imported calendar blocks, and approved/paid/converted direct booking requests. Pending unpaid requests do not block availability by default. Conversion creates a normal internal booking through the existing booking workflow, so converted direct bookings appear on the Bookings and Calendar pages and contribute to existing occupancy/report calculations without duplicating imported iCal events.

Workspace Owners/Company Admins, Property Managers, and Hosts manage direct booking pages and requests from the dashboard. They can view page status, copy public links, filter requests by workflow/payment status, approve/reject requests, and convert approved/paid requests to bookings after conflicts and payment-cleared status are checked again. Assigned Property Owners receive read-only visibility for assigned-property requests through RLS; cleaners and maintenance users do not receive public booking request/payment detail access from this foundation. Suspended users remain blocked by active membership/profile/workspace checks.

Database hardening keeps the existing `direct_booking_pages` and `direct_booking_requests` tables instead of duplicating them. The latest migration adds adults/children, payment status, Stripe Checkout session id, Stripe payment-intent id, payment/status constraints, indexes, removes anonymous direct inserts, and relies on the validated server endpoint for public submissions. Public guests cannot read request rows, private workspace data, private property records, payments, notifications, activity logs, or files.

Known future TODOs:

- Deposit payments.
- Refund automation.
- Automated guest emails through Resend.
- Automated guest SMS/WhatsApp through Twilio.
- Guest portal accounts.
- Advanced availability and pricing rules.
- Coupon codes.
- Full Airbnb/Booking.com/Vrbo channel-manager integrations.
- Automated cleaning task creation from converted direct bookings.

## Resend transactional email foundation

PropFlow includes a safe server-side transactional email foundation for Resend. The browser never receives `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, or the Supabase service-role key.

### Server-only environment variables

Set these only in Vercel Project Settings or a trusted local server environment:

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL=PropFlow <notifications@your-domain.example>
RESEND_REPLY_TO_EMAIL=support@your-domain.example # optional
APP_URL=https://your-app.example
```

Local/demo safety: Resend sends are treated as `provider_not_configured` when the runtime looks local, demo, preview, test, or development unless `RESEND_ALLOW_NON_PRODUCTION_SENDS=true` is set in a trusted non-production server environment. Do not enable that flag for normal local demos.

### Templates included

The approved transactional templates are:

- `team_invite`
- `cleaning_task_assigned`
- `maintenance_work_order_assigned`
- `direct_booking_request_confirmation`
- `direct_booking_request_received`
- `direct_booking_payment_succeeded`
- `direct_booking_payment_failed`
- `owner_report_ready`
- `billing_payment_failed`
- `subscription_billing_warning`

Templates include plain-text fallbacks, simple PropFlow-branded HTML, same-origin app links from `APP_URL`, escaped user-provided content, and no tracking pixels.

### Delivery logs and provider-not-configured behavior

Transactional sends write safe delivery metadata to `public.notification_delivery_logs` using the existing notification delivery-log table. Logs track channel, provider, template key, subject, recipient address, safe status, provider message ID, timestamps, and safe metadata. Full email bodies, secrets, payment card data, raw signed file URLs, and private file contents are not stored.

If Resend is not configured, the main product action still completes. The delivery log is marked `provider_not_configured`, and API responses return safe copy such as “Email provider is not configured yet.” or “Email could not be sent, but the main action completed.” Raw provider errors and stack traces are not shown to normal users.

Webhook-triggered emails use idempotency keys based on Stripe event IDs and entity IDs to reduce duplicate email risk during webhook retries.

### Security notes

- `RESEND_API_KEY` is read only inside `/api/*` server code.
- Supabase service-role access is used only by trusted server routes/helpers.
- RLS remains enabled on delivery logs; workspace managers can view workspace delivery metadata, individual recipients can view their own delivery metadata, owner-report recipients are constrained to their own logs, and client inserts are restricted to internal in-app delivery logs.
- SMS, WhatsApp, Twilio, marketing newsletters, bulk campaigns, scheduled emails, AI-generated emails, attachments, and retry queues are not implemented in this email foundation.

### Future email/notification TODOs

- Add unsubscribe/preference center if marketing email is ever introduced.
- Authenticate sending domains with SPF/DKIM and monitor deliverability.
- Add a retry queue for transient provider failures.
- Add safe attachment support after private-file authorization is designed.
- Add scheduled owner reports/reminders.
- Add SMS/WhatsApp through Twilio in a separate PR.


### 2026-05-18 bookings workspace CRUD readiness
- Bookings are now prepared for workspace-scoped Supabase CRUD through `src/lib/bookings.js` and AppContext wiring.
- Required client env vars remain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; no service-role key is used in frontend code.
- Missing Supabase env vars keep safe non-crashing fallbacks (empty records and user-facing setup message).
- Recommended next PR: workspace-scoped Supabase CRUD for Owners / Property Owners or Guest CRM.


- Maintenance Work Orders workspace-scoped Supabase CRUD wiring is now prepared with `src/lib/maintenanceWorkOrders.js`, workspace-scoped queries, and RLS alignment migration support. Missing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` remains non-crashing with safe empty states. Next recommended PR: Owners / Property Owners Supabase CRUD or Guest CRM Supabase CRUD.

- Owners / Property Owners are now prepared for workspace-scoped Supabase CRUD through the shared `src/lib/owners.js` helper and workspace-scoped owner-contact policies. Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` remains a safe non-crashing fallback state.
- Recommended next PR: wire Guest CRM to workspace-scoped Supabase CRUD using the same helper + RLS alignment pattern.

### 2026-05-18 guest crm workspace CRUD readiness
- Guest CRM / Contacts are now prepared for workspace-scoped Supabase CRUD through `src/lib/guests.js`, AppContext guest-create wiring, and guest-contact RLS alignment migration support.
- Required frontend Supabase env vars remain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Missing env vars stay non-crashing with safe empty-state fallbacks.
- Recommended next PR: Reports / Owner Reports Supabase CRUD or Supplies / Inventory Supabase CRUD.

## RLS role-matrix verification

A lightweight static security test now verifies workspace scoping, role-policy presence, cross-workspace guards, frontend secret-key safety, and AppContext Supabase client safety for core Supabase-backed modules.

Run it as part of the normal suite with:

```bash
npm test
```

See `docs/RLS_ROLE_MATRIX.md` for a founder-friendly access matrix.


- File Uploads / Private Storage are prepared for workspace-scoped Supabase Storage via `src/lib/fileUploads.js` helper methods and workspace-scoped metadata access.
- Operational/customer files remain private by default in the `workspace-files` bucket; do not use public buckets for customer operational files.
- Missing Supabase env vars should fail safely (no crash) for file list/read helpers and surface user-friendly upload errors when upload is attempted without config.
- OCR, media compression, video processing pipelines, public share links, and external storage providers remain future follow-up items.
- Recommended next PR: Notifications Supabase data wiring.
