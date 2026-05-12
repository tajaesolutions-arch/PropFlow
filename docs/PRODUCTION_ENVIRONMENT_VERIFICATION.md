# Production Environment Verification

Use this launch-readiness checklist before real customer testing in Production. It verifies that PropFlow is wired to the intended Vercel, Supabase, Stripe, Resend, and private storage setup without committing secrets, weakening RLS, adding demo data, or changing backend architecture.

## 1. Environment variable audit

### Frontend-safe Vite variables

Set these in Vercel Preview and Production as separate environment values. They are bundled into browser code, so they must never contain private keys or provider secrets.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=preview|production
VITE_APP_URL=https://<deployed-domain>
VITE_SUPABASE_STORAGE_CONFIGURED=false
```

Verification:

- [ ] `VITE_SUPABASE_URL` points to the target Supabase project URL for that Vercel environment.
- [ ] `VITE_SUPABASE_ANON_KEY` is the public anon key only.
- [ ] `VITE_APP_ENV` is `production` for the production deployment and `preview` for preview deployments.
- [ ] `VITE_APP_URL` matches the canonical deployed origin for the same environment.
- [ ] `VITE_SUPABASE_STORAGE_CONFIGURED=true` is set only after the private `workspace-files` bucket and storage policies are complete.
- [ ] No service-role key, Stripe secret, Resend API key, Twilio auth token, or webhook secret appears in any `VITE_*` variable.

### Server-only Vercel variables

Set these in Vercel Project Settings for the appropriate environment only. They must not be committed, returned by API routes, logged in full, or prefixed with `VITE_`.

```bash
APP_URL=https://<deployed-domain>
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
```

Verification:

- [ ] `APP_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` match the frontend production project values.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in server-side Vercel variables for trusted API routes.
- [ ] Stripe variables are set only when Stripe test/live workflows are intentionally enabled.
- [ ] Resend variables are set only after the sending domain or sender is verified.
- [ ] `RESEND_ALLOW_NON_PRODUCTION_SENDS` remains blank or `false` unless a trusted non-production environment intentionally sends email.
- [ ] Missing providers show safe provider-not-configured/setup-required messages instead of exposing raw provider errors.
- [ ] Production and Preview values are configured separately in Vercel and are not accidentally copied across environments.

### Optional/future server-only variables

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
```

Verification:

- [ ] Twilio values remain server-only and are blank until SMS/WhatsApp sending is deliberately enabled.
- [ ] No optional provider secret is required for the Vite build to succeed.

## 2. Supabase production setup checklist

- [ ] Confirm the production Supabase project URL matches `VITE_SUPABASE_URL` and server `SUPABASE_URL`.
- [ ] Apply every migration in `supabase/migrations/` in ascending filename order.
- [ ] Confirm these table groups exist: profiles, workspaces, workspace members, properties, bookings, cleaning tasks, maintenance work orders, file uploads, notifications, owner reports, direct booking tables, calendar import tables, billing tables, and platform admin tables.
- [ ] Confirm RLS is enabled on every customer-owned or workspace-scoped table.
- [ ] Confirm the founder Platform Admin profile has `is_propflow_admin = true`.
- [ ] Confirm the Platform Admin is not granted customer workspace access through `workspace_members` unless they are separately testing a customer role with a different account.
- [ ] Confirm suspended users are blocked by the app and policies/functions used for access checks.
- [ ] Refresh PostgREST schema cache after migrations before testing the deployed app.

Safe verification SQL snippets only:

```sql
-- Confirm core tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'workspaces',
    'workspace_members',
    'properties',
    'bookings',
    'cleaning_tasks',
    'maintenance_work_orders',
    'file_uploads',
    'notifications',
    'owner_reports',
    'direct_booking_pages',
    'direct_booking_requests',
    'calendar_import_feeds',
    'calendar_import_events',
    'billing_subscriptions',
    'billing_events',
    'platform_admin_audit_logs'
  )
order by table_name;
```

```sql
-- Confirm RLS is enabled for customer/workspace data tables.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'workspaces',
    'workspace_members',
    'properties',
    'bookings',
    'cleaning_tasks',
    'maintenance_work_orders',
    'file_uploads',
    'notifications',
    'owner_reports',
    'direct_booking_pages',
    'direct_booking_requests',
    'calendar_import_feeds',
    'calendar_import_events',
    'billing_subscriptions',
    'billing_events'
  )
order by tablename;
```

```sql
-- Confirm founder platform admin flag by replacing the placeholder email.
select id, email, full_name, role, is_propflow_admin, suspended_at
from public.profiles
where lower(email) = lower('<founder-admin-email>');
```

```sql
-- Confirm platform admin is not assigned through customer workspace membership.
select wm.id, wm.workspace_id, wm.user_id, wm.role, wm.status
from public.workspace_members wm
join public.profiles p on p.id = wm.user_id
where p.is_propflow_admin is true;
```

```sql
-- Confirm suspended account records are visible for audit.
select id, email, role, suspended_at, suspension_reason
from public.profiles
where suspended_at is not null
order by suspended_at desc;
```

PostgREST schema cache refresh options:

- [ ] In Supabase Dashboard, open API settings and trigger a schema reload if available.
- [ ] Or run a harmless schema notification after migrations:

```sql
notify pgrst, 'reload schema';
```

## 3. Private storage bucket checklist

- [ ] Supabase Storage bucket name is exactly `workspace-files`.
- [ ] Bucket is private.
- [ ] Public access is off.
- [ ] File size limit matches current app rules: 25 MB maximum per object.
- [ ] Allowed MIME types match current app rules: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- [ ] Signed URLs are generated only after the current user is authorized for the workspace/property/file metadata.
- [ ] Storage policies do not allow public read for operational files.
- [ ] `VITE_SUPABASE_STORAGE_CONFIGURED=true` is set only after the bucket, limits, MIME allowlist, and policies are complete.

Safe verification SQL:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'workspace-files';
```

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%workspace%'
order by policyname;
```

## 4. Vercel production deployment checklist

- [ ] Production branch is `main`.
- [ ] Install command is `npm install`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] Frontend env vars are set in the Production environment.
- [ ] Server-only env vars are set in Production only where the related provider is enabled.
- [ ] Preview and Production variables are not accidentally mixed.
- [ ] Production deployment URL matches both `APP_URL` and `VITE_APP_URL`.
- [ ] `/api/*` routes deploy with the frontend.
- [ ] Browser source, built JS, network responses, and console output do not expose service-role keys, Stripe secrets, Resend keys, Twilio tokens, or webhook secrets.

## 5. Stripe setup checklist

- [ ] Start with Stripe test mode before live mode.
- [ ] Confirm Stripe Products/Prices exist for Starter, Pro, and Business.
- [ ] `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, and `STRIPE_PRICE_BUSINESS` match Stripe Dashboard price IDs for the intended mode.
- [ ] Webhook endpoint points to `https://<deployed-domain>/api/stripe-webhook`.
- [ ] Webhook signing secret is set as `STRIPE_WEBHOOK_SECRET` in server-only Vercel variables.
- [ ] Expected webhook events are enabled:
  - [ ] `checkout.session.completed`
  - [ ] `checkout.session.expired`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
  - [ ] `invoice.payment_succeeded`
- [ ] Failed payment and grace-period behavior is tested with Stripe test clocks or test cards.
- [ ] Stripe Billing Portal is enabled in Stripe Dashboard.
- [ ] Only Workspace Owners can open billing checkout/portal flows from the app.
- [ ] No Stripe secret keys are added to docs, frontend code, or screenshots.

## 6. Resend setup checklist

- [ ] `RESEND_API_KEY` is server-only and never appears in `VITE_*` variables.
- [ ] `RESEND_FROM_EMAIL` uses a verified sender or verified domain.
- [ ] `RESEND_REPLY_TO_EMAIL` points to a safe support inbox and does not expose a personal inbox unless intentional.
- [ ] Production sending is enabled only after domain/sender verification is complete.
- [ ] Provider-not-configured behavior works when Resend variables are missing.
- [ ] Invite, cleaning assignment, maintenance assignment, booking, owner report, and billing emails fail safely if the provider is missing.
- [ ] Email bodies do not expose private file URLs, secrets, full payment data, webhook payloads, or raw provider errors.

## 7. Platform Admin production test plan

- [ ] Log in with the founder Platform Admin email.
- [ ] Confirm post-login route lands on `/admin`.
- [ ] Confirm the admin does not need customer workspace membership to access platform admin pages.
- [ ] Confirm the admin sees platform metrics.
- [ ] Confirm the admin can review workspaces and users.
- [ ] Confirm a normal customer cannot access `/admin` manually.
- [ ] Confirm `propflow_admin` cannot be invited from the workspace team invite UI.

## 8. Real role test account matrix

| Role | Expected login route | Expected sidebar | Expected dashboard | Allowed pages | Blocked pages | Key actions to test | Data that should not be visible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Admin | `/admin` | Platform admin navigation only | Platform metrics/admin dashboard | Admin metrics, workspaces, users, platform review pages | Customer workspace pages unless using a separate customer membership test account | Review users/workspaces, verify suspensions, inspect platform metrics | Private customer operational records beyond admin-approved summaries unless explicitly supported |
| Workspace Owner | `/dashboard` | Full customer workspace navigation including billing/settings | Main workspace dashboard | Dashboard, properties, bookings, calendar, cleaning, maintenance, owners, guests, expenses, reports, files, notifications, billing, settings | `/admin` | Create workspace records, manage team, assign property access, open billing portal | Other workspaces, platform admin controls, provider secrets |
| Property Manager | `/dashboard` | Operations navigation without platform admin controls | Main operations dashboard | Properties, bookings, calendar, cleaning, maintenance, guests, notifications, allowed reports/files | `/admin`, owner-only billing/admin settings where restricted | Manage operations records and assignments | Other workspaces, billing secrets, unassigned restricted owner-only finance where not allowed |
| Host | `/dashboard` | Host/operations navigation | Main host dashboard | Bookings, calendar, guest-facing operations, assigned properties/tasks as allowed | `/admin`, billing management, platform settings | Manage bookings and guest operations for allowed workspace/property scope | Other workspaces, provider secrets, restricted financial/admin data |
| Property Owner | `/owner-dashboard` | Owner-limited navigation | Owner dashboard | Assigned property performance, reports/documents, maintenance/cleaning history, calendar visibility | `/admin`, main admin settings, team management, unassigned properties | View assigned property reports and operational updates | Other owners' properties, workspace-wide team/billing/provider configuration |
| Cleaner | `/cleaner-dashboard` | Cleaner task navigation | Cleaner task dashboard | Assigned cleaning tasks, checklist/status/photo upload where enabled | `/admin`, billing, finance, owner reports, unassigned properties/tasks | Start/complete assigned cleaning task, upload allowed before/after files | Guest/private finance data, unassigned tasks, other workspaces |
| Maintenance Crew | `/maintenance-dashboard` | Maintenance task navigation | Maintenance work-order dashboard | Assigned maintenance work orders, status updates, issue/completion uploads where enabled | `/admin`, billing, finance, owner reports, unassigned properties/tasks | Update assigned work order, add costs/status/photos where allowed | Unassigned work orders, unrelated property data, provider secrets |
| Accountant | `/dashboard` | Finance/reporting-focused navigation when enabled | Main dashboard or finance landing | Expenses, reports, billing visibility if role is allowed, financial exports | `/admin`, operational settings/team controls where restricted | Review expenses/reports and validate financial visibility | Other workspaces, operational records outside financial scope if restricted |
| Suspended User | `/suspended` or blocked state | No active workspace navigation | Suspended/access-blocked screen | Account recovery/support instructions only | All app workspaces, `/admin`, create/update actions | Confirm login is blocked from protected workflows | Any customer data after suspension |

## 9. End-to-end production smoke test

Customer flow:

1. [ ] Sign up as a new Workspace Owner.
2. [ ] Create workspace.
3. [ ] Add first property.
4. [ ] Invite Property Manager.
5. [ ] Invite Cleaner.
6. [ ] Invite Maintenance Crew.
7. [ ] Invite Property Owner.
8. [ ] Assign team members to property.
9. [ ] Add booking.
10. [ ] Add cleaning task.
11. [ ] Add maintenance work order.
12. [ ] Upload allowed file.
13. [ ] Create/view report.
14. [ ] Create direct booking page.
15. [ ] Submit public direct booking request.
16. [ ] Check notification.
17. [ ] Test billing checkout in Stripe test mode if configured.
18. [ ] Suspend/restrict a user and confirm access is blocked.

## 10. Provider status UX audit

- [ ] Workspace Owner-facing status messaging is clear when Stripe billing is configured or not configured, without exposing secret env var names.
- [ ] Workspace Owner-facing status messaging is clear when Resend email is configured or not configured, without exposing secret env var names.
- [ ] Workspace Owner-facing status messaging is clear when Supabase Storage is configured or not configured, without exposing secret env var names.
- [ ] Platform Admin/founder documentation can reference exact server-only variable names for setup verification.
- [ ] No new provider backend logic is required for this checklist.

## 11. Safety audit

- [ ] No secret key values are committed.
- [ ] No service-role key appears in frontend code.
- [ ] No Stripe secret appears in frontend code.
- [ ] No Resend key appears in frontend code.
- [ ] No `VITE_*` variable contains a secret.
- [ ] No public bucket is required for private operational files.
- [ ] No fake production data was added.
- [ ] No destructive SQL was added.
- [ ] No backend/schema/RLS/migration change was made as part of this verification pass.

## 12. Founder remaining manual steps

- [ ] Create/confirm the production Supabase project and apply migrations.
- [ ] Bootstrap the founder Platform Admin profile with `is_propflow_admin = true`.
- [ ] Configure the private `workspace-files` bucket and policies.
- [ ] Configure Vercel Production and Preview environment variables separately.
- [ ] Run the smoke test matrix with real test accounts.
- [ ] Enable Stripe test mode and Resend production sending only after dashboard-side setup is complete.
- [ ] Save deployment evidence: migration status, Vercel deployment URL, Stripe webhook test delivery, Resend domain verification, and storage bucket screenshot.
