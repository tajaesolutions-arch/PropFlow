# PropFlow Production Readiness QA Audit

## Audit date
2026-05-11

## Audit scope
This launch-readiness pass inspected the React/Vite app shell, route map, shared context/data layer, layout/navigation components, create-action provider, public direct booking page, API serverless functions, README/runbook, and Supabase migrations under `supabase/migrations/`.

## Validation summary
- `npm install` completed with the checked-in dependency set.
- `npm run build` completed successfully with Vite.
- `git diff --check` completed successfully.
- Supabase CLI was not available in this container, so SQL migrations were reviewed statically and the new patch migration was kept non-destructive.

## Route audit results
- Public routes `/`, `/pricing`, `/login`, `/signup`, `/join`, `/suspended`, and `/book/:slug` remain public-safe and outside the private dashboard layout where appropriate.
- Protected routes continue to require an authenticated user and an active workspace unless the user is a PropFlow Admin entering `/admin`.
- Platform Admin users are now redirected to `/admin` instead of customer workspace routes.
- Customer billing recovery routes remain limited to Workspace Owners and Accountants.

## Role access matrix findings
- PropFlow Admin is treated as a SaaS platform role and no longer receives normal customer workspace navigation.
- Workspace Owners / Company Admins retain full workspace operations and billing/team/settings access.
- Property Managers and Hosts retain operational routes but not platform admin or billing management.
- Property Owners, Cleaners, Maintenance Crew, and Accountants retain their role-specific dashboards and route-limited access.
- Customer invite role validation continues to reject `propflow_admin`.

## Workspace scoping findings
- AppContext workspace-owned reads are scoped by `currentWorkspace.id` or handled through dedicated RPCs.
- Create/update flows reviewed during this pass continue to include workspace or property scoping and defensive role checks.
- The new RLS patch removes implicit platform-admin access from generic workspace helper functions so admin operations use dedicated platform RPCs instead of customer table access.

## RLS findings
- No broad `USING (true)` or `WITH CHECK (true)` policies were found.
- Added `supabase/migrations/202605100020_production_readiness_rls_patch.sql` to harden public direct booking table access and direct request insert validation.
- The patch removes public direct table select access in favor of safe public RPC reads.
- The patch validates direct booking requests against published pages, min/max nights, guest count, existing bookings, active direct requests, leases, and imported iCal blocks.
- RLS was not weakened.

## Placeholder honesty findings
- README now explicitly documents that Stripe checkout/portal/webhooks, Resend/Twilio delivery, direct booking payments, CSV/PDF exports, receipt OCR, AI tools, rent automation, e-signature/legal generation, scheduled owner reports, and channel-manager/two-way iCal integrations are not live.
- Public direct booking copy remains request-only and does not imply online payment collection.

## Dashboard safety findings
- Dashboards were reviewed for role routing and empty-state safety; no fake/demo data was added.
- Platform Admin dashboard continues to rely on audited platform RPCs and setup-required messaging.

## Public direct booking findings
- `/book/:slug` renders without the private sidebar.
- Public reads use safe RPCs for page data and unavailable ranges.
- Public inserts are now backed by stronger RLS validation and friendlier server-validation error copy.
- Private files, owner financials, team data, and operational details are not exposed by the public page.

## API endpoint security findings
- Stripe checkout and billing portal endpoints remain disabled stubs that return provider-not-configured responses.
- Stripe webhook endpoint requires server-side Stripe configuration before any processing and still does not process live events.
- iCal sync requires an authenticated bearer token and now adds DNS/IP SSRF checks, redirect revalidation, request body size limits, fetch timeouts, and response byte limits.
- No service-role keys were added or exposed.

## Mobile/responsive findings
- Existing mobile table/modal/sidebar safeguards remain in place.
- No architecture-level layout rebuild was performed in this stabilization PR.

## Remaining manual Supabase/Vercel runtime tests
- Apply all migrations to a real Supabase project and verify PostgREST schema cache refresh.
- Bootstrap a founder profile with `is_propflow_admin = true` from a trusted SQL console.
- Create the private `workspace-files` storage bucket and test signed URL upload/download flows.
- Smoke test every listed public and protected route with real users for each role.
- Exercise direct booking request submission against real published pages with overlapping dates and imported iCal blocks.
- Verify Vercel Preview/Production env vars and serverless function responses.
