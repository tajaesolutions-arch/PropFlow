# Vercel Runtime Test Plan

This plan verifies PropFlow's Vite deployment, serverless API routes, environment variables, auth redirects, and provider-not-configured behavior on Vercel.

## A. Project settings

- [ ] Framework Preset: **Vite**.
- [ ] Install Command: `npm install`.
- [ ] Build Command: `npm run build`.
- [ ] Output Directory: `dist`.
- [ ] `/api/*` serverless functions deploy with the frontend.
- [ ] Production and Preview environments have separate Supabase projects or clearly documented shared test usage.

## B. Environment variables

Set frontend-safe variables in Preview and Production:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=preview|production
VITE_APP_URL=https://<deployed-domain>
VITE_SUPABASE_STORAGE_CONFIGURED=true|false
```

Set server-only variables in Vercel Project Settings, not in frontend code:

```bash
APP_URL=https://<deployed-domain>
SUPABASE_URL=
SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
```

Notes:

- `APP_URL` is used by API CORS origin checks. `VERCEL_URL` is injected by Vercel and should not need manual entry.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of Vite/frontend variables. Current API routes do not need it.
- Leave Stripe/Resend/Twilio secrets blank until live provider implementations are intentionally added.

## C. Deploy and inspect build

1. Deploy the target branch.
2. Confirm `npm install` completed.
3. Confirm `npm run build` completed.
4. Confirm Vercel detected the API functions:
   - `/api/create-checkout-session`
   - `/api/create-billing-portal-session`
   - `/api/stripe-webhook`
   - `/api/sync-ical-feed`
5. Open browser console on first load and confirm no missing-env crash occurs when env vars are present.

## D. Auth redirect tests

1. In Supabase Auth URL configuration, add the Vercel preview/production URLs before testing.
2. Visit the Vercel deployment logged out.
3. Confirm public pages render:
   - `/`
   - `/pricing`
   - `/login`
   - `/signup`
   - `/join`
   - `/suspended`
   - `/book/:slug`
4. Attempt protected route while logged out, such as `/dashboard`; expected redirect is `/login`.
5. Sign up/login as a new user with no workspace; expected redirect is `/workspace-setup`.
6. Create workspace; expected route is `/dashboard` for owner/admin role.
7. Log in as PropFlow Admin; expected route is `/admin`.
8. Log out and verify session is cleared.

## E. API route validation

### Billing checkout stub

```bash
curl -i -X POST https://<deployment>/api/create-checkout-session \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <user-jwt>' \
  --data '{"workspaceId":"<workspace-id>","plan":"starter"}'
```

Expected while Stripe is not implemented: `501` with `provider_not_configured` or a missing-session/setup response when auth/env is intentionally absent. No paid subscription state is created.

### Billing portal stub

```bash
curl -i -X POST https://<deployment>/api/create-billing-portal-session \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <user-jwt>' \
  --data '{"workspaceId":"<workspace-id>"}'
```

Expected while Stripe is not implemented: `501` provider-not-configured/setup response and no fake redirect URL.

### Stripe webhook stub

```bash
curl -i -X POST https://<deployment>/api/stripe-webhook \
  -H 'content-type: application/json' \
  --data '{}'
```

Expected until a real webhook implementation is added: setup-required/provider-not-configured when Stripe env is absent, or `501 webhook_not_implemented` when env exists.

### iCal sync route

```bash
curl -i -X POST https://<deployment>/api/sync-ical-feed \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <user-jwt>' \
  --data '{"feedId":"<feed-id>"}'
```

Expected: authenticated request runs under the user's Supabase JWT/RLS; unsafe feed URLs fail safely; valid feeds import within limits.

## F. Role and route checks on Vercel

- [ ] Workspace Owner / Company Admin routes to `/dashboard` and can test workspace creation, property creation, files, direct bookings, iCal imports, and billing provider-not-configured state.
- [ ] Property Manager routes to `/dashboard` and cannot access `/admin`.
- [ ] Host routes to `/dashboard` and cannot access `/admin`.
- [ ] Property Owner routes to `/owner-dashboard` and sees only assigned owner data.
- [ ] Cleaner routes to `/cleaner-dashboard` and sees only assigned tasks.
- [ ] Maintenance Crew routes to `/maintenance-dashboard` and sees only assigned work orders.
- [ ] Accountant can access allowed finance/billing surfaces but not platform admin.
- [ ] PropFlow Admin routes to `/admin` and is redirected away from customer workspace pages.

## G. Public booking and private storage checks

- [ ] `/book/:slug` renders outside the private app shell.
- [ ] Valid booking request/inquiry creates a safe direct booking request.
- [ ] Invalid dates/overlaps/privileged payload fields are rejected.
- [ ] Private uploads use the `workspace-files` bucket.
- [ ] File viewing uses signed URLs only.
- [ ] Raw/private object URLs are not public.

## H. Billing provider-not-configured acceptance

- [ ] Missing Stripe env vars do not crash the app.
- [ ] Checkout action does not create a fake paid subscription.
- [ ] Portal action does not create a fake redirect.
- [ ] Billing events/status clearly indicate provider-not-configured/setup-required.
- [ ] Staff restriction/recovery behavior is still role-scoped.

## I. Vercel acceptance criteria

- [ ] Deployed app loads with configured env vars.
- [ ] Auth redirects match Supabase settings.
- [ ] Serverless API routes respond with expected guarded states.
- [ ] No secrets are visible in browser bundle, page source, console logs, or network responses.
- [ ] Supabase RLS behavior matches `SUPABASE_RUNTIME_TEST_PLAN.md` from the deployed app.
