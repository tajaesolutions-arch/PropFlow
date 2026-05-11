# Supabase Runtime Test Plan

This plan verifies that PropFlow's migrations, RLS, auth, storage, and runtime data boundaries work in a real Supabase project.

## Required test accounts

Create real Supabase Auth users for each role. Use test emails in a non-production tenant unless this is the final production acceptance pass.

- PropFlow Admin / founder team user.
- Workspace Owner / Company Admin.
- Property Manager.
- Host.
- Property Owner.
- Cleaner.
- Maintenance Crew.
- Accountant / Bookkeeper.
- Optional unrelated user in a second workspace for cross-workspace RLS tests.

## A. Migration verification

1. Apply migrations in the exact filename order from `MIGRATION_MANIFEST.md`.
2. Confirm all expected base tables exist.
3. Confirm RLS is enabled on customer-facing workspace tables.
4. Confirm `public.create_workspace_with_owner(...)` exists after the final RPC migration.
5. Confirm direct booking public RPCs exist after `202605100016_direct_booking_foundation.sql` and the production patch.
6. Confirm iCal import tables exist after `202605100018_ical_calendar_import_foundation.sql`.
7. Confirm platform admin RPCs exist after `202605100019_platform_admin_foundation.sql`.
8. Refresh schema cache; do not add broad policies to work around stale-cache errors.

## B. Auth redirects and workspace bootstrap

1. Configure Supabase Auth redirect URLs for local, preview, and production origins.
2. Sign up a new non-admin user.
3. Verify the user lands on `/workspace-setup` when no membership exists.
4. Create a workspace through the app.
5. Verify rows are created in `workspaces` and `workspace_members` with the user as owner/admin.
6. Verify direct inserts from an authenticated client are not required for initial workspace creation.

## C. PropFlow Admin bootstrap

1. Sign up the founder/team user.
2. Run the trusted SQL bootstrap:

```sql
update public.profiles
set is_propflow_admin = true
where email = '<founder-email@example.com>';
```

3. Log in as the founder and verify routing to `/admin`.
4. Confirm platform overview/health RPCs return data.
5. Log in as a Workspace Owner and verify `/admin` is denied.
6. Attempt to invite `propflow_admin` through workspace team UI; verify it is blocked.

## D. Role-by-role access tests

For every test, verify data shown belongs only to the active workspace and role scope.

### Workspace Owner / Company Admin

- [ ] Routes to `/dashboard`.
- [ ] Can create/edit/archive properties.
- [ ] Can invite customer roles only.
- [ ] Can create bookings, cleaning tasks, maintenance work orders, supplies, expenses, direct booking pages, and iCal feeds where UI supports them.
- [ ] Can access billing recovery/provider-not-configured page.
- [ ] Cannot become PropFlow Admin through customer workspace flows.

### Property Manager

- [ ] Routes to `/dashboard`.
- [ ] Can manage operational properties/bookings/tasks/work orders as allowed.
- [ ] Cannot access `/admin`.
- [ ] Cannot grant platform admin role.

### Host

- [ ] Routes to `/dashboard`.
- [ ] Can manage host-scoped guest/direct booking operations as allowed.
- [ ] Cannot create/convert property owner contacts where RLS forbids it.
- [ ] Cannot access `/admin`.

### Property Owner

- [ ] Routes to `/owner-dashboard`.
- [ ] Sees assigned properties only.
- [ ] Sees owner reports/revenue/expenses only where allowed.
- [ ] Cannot access cleaner/maintenance/admin-only data.

### Cleaner

- [ ] Routes to `/cleaner-dashboard`.
- [ ] Sees assigned cleaning tasks only.
- [ ] Can perform allowed workflow updates and upload allowed before/after photos.
- [ ] Cannot read unrelated bookings, finance, owner reports, or maintenance data.

### Maintenance Crew

- [ ] Routes to `/maintenance-dashboard`.
- [ ] Sees assigned work orders only.
- [ ] Can perform allowed work-order updates and upload allowed media.
- [ ] Cannot read unrelated bookings, finance, owner reports, or cleaning task data.

### Accountant / Bookkeeper

- [ ] Routes according to current highest-permission routing.
- [ ] Can access allowed finance/billing/reporting surfaces.
- [ ] Cannot manage platform admin operations.
- [ ] Cannot perform owner-only team/security actions unless explicitly allowed by RLS.

## E. Workspace creation and RLS isolation

1. Create Workspace A with owner A.
2. Create Workspace B with owner B.
3. Add at least one property, booking, task, work order, expense, file metadata row, direct booking page, and iCal feed per workspace.
4. While authenticated as a Workspace A user, attempt to read/update Workspace B rows through the app and Supabase client calls.
5. Expected: Workspace B rows are invisible or rejected by RLS.
6. Repeat for owner, cleaner, maintenance, and accountant scoped users.
7. Do not fix failures by adding `USING (true)` or broad cross-workspace policies.

## F. Public `/book/:slug` tests

1. As owner/manager/host, publish a direct booking page for a property.
2. Open `/book/:slug` in a logged-out browser.
3. Verify the page renders outside the private dashboard/sidebar layout.
4. Verify only safe public property/page fields are visible.
5. Submit a valid inquiry/request.
6. Attempt invalid requests:
   - Dates shorter than minimum stay.
   - Dates longer than maximum stay.
   - Dates overlapping existing bookings/imported iCal blocks.
   - Payloads containing privileged internal fields.
7. Expected: valid request is captured; invalid/privileged attempts are rejected.

## G. iCal sync tests

1. Add a valid iCal feed URL for a property.
2. From the app, trigger sync or call `/api/sync-ical-feed` with an authenticated bearer token and JSON body.
3. Verify feed events import within the configured limits.
4. Verify conflict logs or unavailable ranges appear where applicable.
5. Test blocked URLs:
   - `localhost` or `.local` hostnames.
   - Private IPv4/IPv6 addresses.
   - Embedded credentials.
   - Oversized feeds over 2 MB.
   - Unsafe redirects.
6. Expected: unsafe feeds fail safely; no service-role key is exposed to the browser.

## H. Private file signed URL tests

1. Confirm Storage bucket `workspace-files` is private.
2. As allowed workspace user, upload a property/cleaning/maintenance/document/receipt file through the app.
3. Confirm a `file_uploads` metadata row exists with the correct `workspace_id` and storage path.
4. Open/view the file through the app and verify a short-lived signed URL is generated.
5. Try accessing the raw storage URL without a signed URL.
6. Try accessing another workspace's file metadata and object.
7. Expected: only authorized signed URL access works.

## I. Billing provider-not-configured tests

1. Leave Stripe env vars blank unless real billing backend work is intentionally in scope.
2. Open `/billing` as a Workspace Owner.
3. Click checkout/plan and billing portal actions.
4. Expected: guarded API route returns provider-not-configured/setup-required response; UI records/shows safe provider-not-configured state; no fake paid state is created.
5. Confirm staff billing restriction/recovery messaging is visible when subscription rows are in warning/restricted test states.

## J. Acceptance criteria

- [ ] All migrations applied in order without blocking errors.
- [ ] Schema cache refreshed and RPCs are visible.
- [ ] Auth redirects work for deployed domains.
- [ ] PropFlow Admin is platform-only.
- [ ] Every customer role is scoped correctly.
- [ ] Cross-workspace RLS isolation passed.
- [ ] Public booking page is public-safe.
- [ ] iCal sync is server-side and SSRF-protected.
- [ ] Private files use signed URLs and private bucket policies.
- [ ] Billing remains provider-not-configured until real Stripe implementation.
