# Supabase Production Readiness Audit

PR #196: **Audit Supabase readiness and workspace data safety**

This audit checks whether PropFlow is ready to keep moving from stable UI/runtime behavior toward real Supabase-backed production data. It is intentionally conservative: it documents larger database/security work instead of trying to rewrite the data model or RLS policies in one PR.

## Founder summary

PropFlow is **not yet ready for unrestricted live customer production traffic**, but it is in a good position for controlled Supabase production setup and role-based QA. The app already has a single frontend Supabase client, safe missing-environment behavior, authenticated session loading, workspace-aware frontend queries, private file-bucket direction, and many workspace-scoped RLS policies.

The remaining risk is mostly verification and completion work: run all migrations against the real Supabase project, test each role with real Auth users, confirm every RLS policy behaves correctly in Supabase, and resolve documented schema/RLS gaps before onboarding real customer workspaces.

## Current Supabase integration status

- Frontend Supabase is centralized in `src/lib/supabase.js` and creates a client only when the public Vite URL and anon key are present.
- When Supabase is not configured, the app keeps `authLoading` false, uses empty workspace-safe data, and shows setup messaging instead of crashing or hanging.
- The frontend uses Supabase Auth session state from `AppContext`; there is no separate frontend Supabase client or duplicate auth context.
- Serverless API routes have their own server-side clients for trusted operations. Those are separate from the browser client and must keep service-role credentials server-only.
- Demo login is not present in the production login UI. Demo seed files are isolated under `supabase/seed/` and must not be applied to production.

## Required environment variables

Frontend Vite variables required for login and authenticated workspace data:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Optional public frontend flags:

```bash
VITE_APP_ENV=local|preview|staging|production
VITE_APP_URL=https://your-app-domain.example
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Server-only variables such as Supabase service-role keys, Stripe secrets, Resend keys, and Twilio secrets must stay in trusted API/Vercel server settings only. They must never be exposed through `VITE_*` variables or browser code.

## Files and folders inspected

Frontend/runtime:

- `src/lib/supabase.js`
- `src/lib/AppContext.jsx`
- `src/lib/auth.js`
- `src/lib/safeAppState.js`
- `src/lib/optionalModuleFallback.js`
- `src/lib/fileUploads.js`
- `src/lib/activityLogs.js`
- `src/routes/AppRouter.jsx`
- `src/components/CreateActionProvider.jsx`
- `src/pages/*`

Supabase/database:

- `supabase/`
- `supabase/migrations/*`
- `supabase/seed/README.md`
- `supabase/seed/seed_demo.sql`

Project/deployment:

- `README.md`
- `package.json`
- `.github/workflows/ci.yml`
- `api/*`
- `api/_utils/*`

Searches were also run for Supabase clients, frontend queries/RPCs, Auth session calls, workspace and user scoping fields, role/membership handling, RLS language, service-role references, Vite Supabase variables, demo language, and sample-data references.

## RLS status summary

### What looks good

- Core customer tables are designed around `workspace_id` and most migrations enable RLS.
- The initial schema enables RLS for profiles, workspaces, workspace members, invites, properties, assignments, cleaning, maintenance, files, activity logs, and notifications.
- Later migrations add or align RLS for bookings, contacts/owners/guests, reports, expenses, supplies/inventory, direct bookings, leases, calendar imports, billing/subscription tables, platform admin records, private file uploads, and notification tables. Supplies / Inventory is now prepared for workspace-scoped Supabase CRUD through the shared anon client with safe missing-env empty states.
- Static search found no `USING (true)`, `WITH CHECK (true)`, or `DISABLE ROW LEVEL SECURITY` statements in the migration set.
- Private upload migrations use a private `workspace-files` bucket direction and workspace-scoped storage policies.
- PropFlow Admin functionality is modeled separately from normal customer workspace roles through platform-admin helper functions and platform tables.

### Risks to verify in Supabase before production

- The audit was static in this environment. Apply migrations to a real Supabase project and test RLS with actual Auth users for every launch role.
- Several older foundation migrations are superseded by later hardening migrations. Verify final effective policies after the full migration order is applied.
- Direct booking public insert/read RPC behavior is intentionally public-facing in limited areas. Confirm it exposes only public page/request data and never private workspace operations.
- Server-side API routes that use trusted credentials must validate workspace membership before writes and must not become a backdoor around RLS.
- Platform admin helper functions using `SECURITY DEFINER` require careful verification of `search_path`, grants, and caller checks in the deployed database.


### Supplies / Inventory CRUD readiness

Supplies / Inventory uses the existing `public.supplies` table and is scoped by `workspace_id` for list, detail, create, and update operations. The frontend helper returns safe empty arrays when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, and it does not create duplicate Supabase clients or reference service-role keys.

RLS remains the security boundary: workspace owners/company admins, property managers, and hosts can manage supplies where the deployed policies allow it; accountant visibility is read-only; lower operational roles do not receive broad full-inventory management access. Property assignment is constrained to properties in the active workspace so supply records cannot point across workspaces.

Advanced procurement is still future scope. Barcode scanning, vendor ordering, purchase orders, automated purchasing, and vendor payment workflows are not implemented in this PR. Recommended next PR: Calendar / iCal Supabase CRUD.

## Workspace scoping status

### Current frontend contract

The main app data loader scopes workspace records by `workspace_id` before putting them into AppContext. This includes:

- `workspace_members`
- `properties`
- `bookings`
- `leases`
- `contacts` / owners / guests
- `cleaning_tasks`
- `maintenance_work_orders`
- `supplies`
- `workspace_invites`
- `property_assignments`
- `file_uploads`
- `direct_booking_pages`
- `direct_booking_requests`
- `calendar_import_feeds`
- `calendar_import_events`
- `calendar_import_sync_runs`
- `calendar_import_conflicts`
- `notifications`
- `notification_preferences`
- `notification_provider_settings`
- `notification_delivery_logs`
- `activity_logs`
- `owner_reports`
- `expenses`
- `workspace_subscriptions`
- `billing_events`

`billing_plan_limits` is intentionally not workspace-scoped because it is plan metadata. It still needs controlled RLS/read behavior so it cannot be abused for writes.

### Role/scoping expectations

- Workspace Owners / Company Admins, Property Managers, and Hosts should see operational workspace data allowed by RLS.
- Property Owners should be limited to assigned properties, owner reports, owner-visible files, and owner-appropriate finance summaries.
- Cleaners should be limited to assigned cleaning tasks and allowed cleaning proof uploads.
- Maintenance Crew should be limited to assigned work orders and allowed maintenance uploads.
- Accountants/Bookkeepers should have finance/report visibility where explicitly intended.
- PropFlow Admin must stay a platform-level role and must not be represented as a normal `workspace_members.roles` value.

## Auth/session status

### Current behavior

- Login uses real Supabase Auth credentials and does not ask the user to pick a role manually.
- AppContext loads the profile, active workspace memberships, related workspaces, and selected active workspace after session load.
- Saved workspace selection is normalized so revoked or suspended memberships cannot be selected as the active workspace.
- Suspended accounts route to `/suspended`.
- Auth loading starts false when Supabase is missing and is cleared in the account-load `finally` block when Supabase is configured.
- Sign out calls Supabase Auth sign-out, clears session/user/workspace/membership state, removes saved workspace selection, resets data to safe empty state, and navigates to `/login`.

### Known auth gaps

- Production QA still needs real Supabase users for each role, including multi-workspace users and revoked/suspended membership scenarios.
- New users with no active workspace are safely routed to workspace setup/join, but the business onboarding flow still needs founder acceptance testing.
- Profile creation fallback exists when a profile row is missing. Verify the deployed trigger/RPC path is the preferred production source of profile records.

## Frontend/database compatibility notes

The frontend already normalizes many database snake_case fields into UI-friendly camelCase aliases, including:

- properties: `rental_type`, `property_type`, `nightly_rate`, `monthly_rent`, `square_feet`, `assigned_owner_id`
- bookings: `property_id`, `contact_id`, `guest_name`, `check_in`, `check_out`, `total_amount`, `owner_payout`
- cleaning: `property_id`, `assigned_cleaner_id`, `scheduled_for`, `checklist_items`, `cleaner_notes`
- maintenance: `property_id`, `assigned_maintenance_id`, `estimated_cost`, `actual_cost`, `due_date`
- leases: `workspace_id`, `property_id`, `tenant_contact_id`, `lease_start`, `lease_end`, `rent_amount`, `security_deposit_amount`
- contacts: `full_name`, `contact_type`
- reports: `property_id`, `owner_id`, `contact_id`, `report_type`, `start_date`, `end_date`, `summary_data`
- files: `workspace_id`, entity foreign keys, `file_name`, `file_path`, `bucket_name`, `mime_type`, `file_size`
- expenses: `property_id`, `booking_id`, `maintenance_work_order_id`, `cleaning_task_id`, `vendor_name`, `expense_date`, `payment_status`

Known compatibility items to verify against the final Supabase project:

- Some page-level UI fields are richer than the current database foundation. Keep mapping helpers tolerant of missing optional fields.
- Public direct-booking RPC return shapes must continue matching `PublicDirectBookingPage` expectations.
- `notification_provider_settings` should never return provider secrets to the frontend; only safe status/configuration metadata should be selected or exposed by RLS/API design.
- File upload paths must continue using `workspaces/{workspace_id}/...` and signed URLs must not be persisted.


## Properties module Supabase CRUD status (PR #197)

- Status: Properties are the first customer module wired to a focused Supabase data-access helper for workspace-scoped CRUD. The Properties page reads real `public.properties` rows for the selected active workspace and the shared Add Property modal creates real rows instead of faking successful saves.
- Table status: `public.properties` already exists in the foundational schema with `id`, `workspace_id`, `name`, `address`, `city`, `state`, `country`, `property_type`, `rental_type`, `status`, `bedrooms`, `bathrooms`, `square_feet`, `currency`, `nightly_rate`, `monthly_rent`, `assigned_owner_id`, `notes`, `created_by`, `created_at`, and `updated_at`. No broad table rewrite was needed.
- RLS status: Existing `properties_select_authorized` continues to use `can_access_property(workspace_id, id)`. Migration `202605170001_properties_workspace_crud_alignment.sql` keeps inserts workspace-scoped, allows Workspace Owner / Company Admin, Property Manager, and Host to create, keeps updates limited to Workspace Owner / Company Admin and Property Manager, enforces `created_by = auth.uid()`, and keeps assigned owners limited to active owner members in the same workspace.
- Frontend reads/writes: `src/lib/properties.js` provides `listProperties`, `getPropertyById`, `createProperty`, `updateProperty`, `buildPropertyPayload`, and `normalizeProperty` using the existing Supabase client only. AppContext uses these helpers for property loading and property save/update paths while preserving activity logs, notifications, plan-limit UX, and safe workspace refreshes.
- Missing-env behavior: Missing or invalid `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` returns safe empty/not-configured results, disables property submit, and does not show fake production data.
- Empty-state behavior: No active workspace shows a workspace-required state and does not issue property queries. Valid Supabase config with no rows shows the existing clean empty state. Detail routes show loading while workspace data is refreshing and a generic not-found state for unavailable records.
- Known limitations: Property photos, rich amenities, advanced owner-property financial summaries, and full edit parity for every downstream module remain outside this PR. Existing detail-page related data still depends on the broader AppContext workspace load rather than a standalone detail-query cache.
- Recommended next module: stabilize bookings only after properties are validated with real workspace users, since bookings depend on real `property_id` records and property-scoped RLS.

## Known schema gaps

These are not fixed in this PR because they require a deeper migration/design review:

- Final production reporting/export tables need end-to-end verification with generated file metadata, signed URL access, and owner visibility.
- Billing/subscription state currently has foundations and guards, but live Stripe provider behavior must be completed and tested in a separate PR.
- Notification provider configuration exists, but live Resend/Twilio sending should remain server-only and must be tested separately.
- Virus/malware scanning, video upload support, document previews, OCR/search, and retention policies are future file-management work.
- Platform-admin audit visibility should be verified with founder/team accounts only; customer roles must not receive platform-wide data.

## Known RLS gaps / verification checklist

Do not promote production traffic until these are tested in Supabase with real Auth users:

- [ ] Workspace Owner can manage only their workspace records.
- [ ] Property Manager/Host cannot read another workspace.
- [ ] Property Owner sees only assigned owner data and does not see manager-only operations or unrelated financials.
- [ ] Cleaner sees only assigned cleaning tasks/files and cannot read financial tables.
- [ ] Maintenance Crew sees only assigned work orders/files and cannot read financial tables.
- [ ] Accountant sees intended finance/report data only.
- [ ] Revoked membership loses access immediately and saved workspace selection is ignored.
- [ ] Suspended account/member routes safely and RLS blocks data access.
- [ ] PropFlow Admin can access platform admin functions only through the platform-admin path and is not assignable through customer invites.
- [ ] Public direct-booking endpoints cannot expose private workspace data.
- [ ] Storage bucket `workspace-files` is private and operational files are not publicly readable.
- [ ] API routes using trusted server credentials validate workspace membership/intent before every write.

## Recommended next PRs

1. **Supabase RLS live verification PR**: add SQL test scripts or Supabase CLI checks for every role/workspace scenario above.
2. **Schema compatibility PR**: compare final UI field usage to deployed table columns and add small forward-only migrations or mapping helpers for confirmed mismatches.
3. **Production auth QA PR**: create a documented manual test matrix for real Auth users, workspace creation/joining, revoked memberships, and suspended accounts.
4. **Private uploads verification PR**: test signed URL behavior and storage policies against the real `workspace-files` bucket.
5. **Provider hardening PRs**: separately wire Stripe, Resend, Twilio SMS, and Twilio WhatsApp server-side only after the database/auth baseline is verified.

## Do not merge to production until

- [ ] `npm ci`, `npm test`, and `npm run build` pass for the exact production commit.
- [ ] All Supabase migrations apply cleanly to a staging copy of the production project.
- [ ] RLS role tests pass for Workspace Owner, Property Manager, Host, Property Owner, Cleaner, Maintenance Crew, Accountant, suspended user, revoked member, and PropFlow Admin.
- [ ] No `.env` or secret files are committed.
- [ ] No frontend code references service-role keys or server-only provider secrets.
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel Preview/Production.
- [ ] Service-role, Stripe, Resend, and Twilio secrets exist only in trusted server/API environments when those providers are enabled.
- [ ] The `workspace-files` bucket is private and storage policies are active.
- [ ] Demo seed data has not been applied to production.
- [ ] Founder/team platform admin access has been manually verified and is separate from customer workspace admin roles.


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

- Reports / Owner Reports now use workspace-scoped Supabase-ready data helper (`src/lib/reports.js`) with safe fallback objects when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing.
- PDF/CSV export and scheduled reports remain follow-up items (current export remains local/manual-safe behavior).
- Recommended next PR: wire Supplies / Inventory Supabase CRUD (or Calendar/iCal Supabase CRUD).

- Calendar/iCal imports are now prepared for workspace-scoped Supabase data access (feeds/events are workspace-filtered; calendar UI can unify bookings, cleaning, maintenance, and imported records).
- Missing Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) should return safe empty calendar/import arrays without crashing.
- Live external iCal fetching, background sync, conflict resolution workflows, and full Airbnb/Vrbo/Booking.com API integrations remain future follow-up items.
- Recommended next PR: File Uploads/Private Storage integration or Notifications Supabase wiring.
