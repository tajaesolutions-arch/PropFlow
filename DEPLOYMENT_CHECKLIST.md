# PropFlow Runtime Deployment Checklist

Use this checklist when validating PropFlow against a real Supabase project and Vercel deployment. This is a runtime validation kit, not a product-feature change. Do not add fake data, weaken RLS, expose secrets, or enable live provider sends/payments until those backends are deliberately implemented.

## 1. Preflight

- [ ] Use a dedicated Supabase project for the target environment.
- [ ] Use a dedicated Vercel project/environment for Preview or Production.
- [ ] Confirm the branch being deployed is the intended release branch.
- [ ] Confirm no real secrets are committed to the repository.
- [ ] Review `MIGRATION_MANIFEST.md` before applying SQL.

## 2. Create the Supabase project

1. Open Supabase Dashboard.
2. Create a new project under the PropFlow organization/account.
3. Select the target region and save the project ref.
4. Wait until Auth, Database, Storage, and API status are healthy.
5. Copy these values from **Project Settings → API**:
   - Project URL → `VITE_SUPABASE_URL` and server `SUPABASE_URL`.
   - Anon public key → `VITE_SUPABASE_ANON_KEY` and server `SUPABASE_ANON_KEY`.
6. Do **not** copy the service-role key into any Vite/frontend environment variable.

## 3. Apply migrations in order

Apply every SQL file in `supabase/migrations/` in ascending filename order. The complete order is documented in `MIGRATION_MANIFEST.md` and repeated in `README.md`.

Manual SQL Editor flow:

1. Open Supabase Dashboard → SQL Editor.
2. Create a new query tab for the first migration.
3. Paste the full file contents.
4. Run the query and save the output or screenshot for release evidence.
5. Repeat for every migration in filename order.
6. If a migration reports an expected idempotent notice, continue only after confirming no blocking error occurred.
7. Do not skip `202605100020_production_readiness_rls_patch.sql`.

CLI flow when the Supabase CLI is available:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## 4. Refresh Supabase schema cache

After all migrations run:

- [ ] Open **Project Settings → API** and confirm the API is healthy.
- [ ] Wait 1-2 minutes for PostgREST schema cache refresh.
- [ ] If an RPC/table is missing in the app, trigger a schema reload from Supabase Dashboard if available, or run `notify pgrst, 'reload schema';` from SQL Editor.
- [ ] Re-test workspace creation RPC, direct booking RPCs, iCal tables, and admin RPCs before changing policies.

## 5. Create private Storage bucket

1. Open Supabase Dashboard → Storage.
2. Create or confirm bucket name: `workspace-files`.
3. Set **Public bucket** to **off/private**.
4. Keep file size/MIME limits aligned with operational uploads.
5. Confirm storage policies from the migrations are present.
6. In Vercel/frontend env, set `VITE_SUPABASE_STORAGE_CONFIGURED=true` only after this bucket exists and policies are applied.

## 6. Configure Supabase Auth redirects

Add the exact runtime origins before testing auth:

- Local development: `http://localhost:5173/*`.
- Vercel Preview domain(s): `https://<preview-domain>/*`.
- Production domain: `https://<production-domain>/*`.
- Any custom domain: `https://<custom-domain>/*`.

Test sign-up, login, logout, password recovery if enabled, and protected route redirects.

## 7. Bootstrap PropFlow Admin

PropFlow Admin is SaaS/platform-level only.

1. Sign up the founder/team user through Supabase Auth or the app.
2. Confirm `public.profiles` contains that user's profile row.
3. From a trusted Supabase SQL console, run:

```sql
update public.profiles
set is_propflow_admin = true
where email = '<founder-email@example.com>';
```

4. Do not add `propflow_admin` to customer `workspace_members.roles`.
5. Log in as founder and verify automatic routing to `/admin`.
6. Log in as a non-admin customer user and verify `/admin` denies access.

## 8. Configure Vercel environment variables

Frontend-safe Vite variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=preview|production
VITE_APP_URL=https://<deployed-domain>
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Server-only variables for current API routes and guarded provider stubs:

```bash
APP_URL=https://<deployed-domain>
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # server-only; required by trusted API routes
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL= # optional
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
```

Notes:

- Vercel automatically provides `VERCEL_URL`; set `APP_URL` to the canonical deployed origin used for API CORS.
- Leave optional provider secrets blank until live Stripe/Resend/Twilio workflows are intentionally enabled; missing providers return safe `provider_not_configured` responses where supported.
- Never set `SUPABASE_SERVICE_ROLE_KEY` in frontend/Vite env vars. It is required only by trusted Vercel API routes such as public direct-booking request creation, Stripe webhooks, and transactional email workflow validation.

## 9. Deploy on Vercel

1. Import or open the PropFlow Vercel project.
2. Use Framework Preset: **Vite**.
3. Install Command: `npm install`.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add Preview and Production env vars.
7. Deploy the target branch.
8. Review build logs for install/build success and serverless function bundling.
9. Open the deployment URL and complete the runtime test plans.

## 10. Runtime smoke tests

- [ ] Public landing, pricing, login, signup, join, suspended, and `/book/:slug` render safely.
- [ ] Unauthenticated protected routes redirect to `/login`.
- [ ] Authenticated user without workspace redirects to `/workspace-setup`.
- [ ] Workspace creation succeeds through `create_workspace_with_owner` RPC.
- [ ] PropFlow Admin routes to `/admin`; customer roles route to their dashboards.
- [ ] Workspace Owner/Company Admin can manage workspace setup, properties, bookings, files, billing state, direct bookings, iCal imports, notifications, and settings.
- [ ] Property Manager/Host can access intended operational pages without platform admin access.
- [ ] Property Owner only sees assigned owner data.
- [ ] Cleaner only sees assigned cleaning tasks and allowed task updates.
- [ ] Maintenance Crew only sees assigned work orders and allowed updates.
- [ ] Accountant can review finance/billing where allowed and cannot perform owner-only operations.
- [ ] RLS isolation prevents user A/workspace A from reading or writing workspace B data.
- [ ] Public `/book/:slug` exposes only safe public fields and accepts valid requests only.
- [ ] iCal sync endpoint blocks unsafe URLs and imports valid feed events as expected.
- [ ] Private file upload creates metadata and signed URLs only for authorized users.
- [ ] Billing checkout/portal stays in provider-not-configured state until Stripe is implemented.

## 11. Release evidence

Record these before promoting production:

- [ ] Supabase project ref.
- [ ] Migration application date/time and operator.
- [ ] Schema cache refresh confirmation.
- [ ] `workspace-files` private bucket screenshot/confirmation.
- [ ] PropFlow Admin bootstrap confirmation.
- [ ] Vercel deployment URL and build log link.
- [ ] Completed `SUPABASE_RUNTIME_TEST_PLAN.md`.
- [ ] Completed `VERCEL_RUNTIME_TEST_PLAN.md`.
