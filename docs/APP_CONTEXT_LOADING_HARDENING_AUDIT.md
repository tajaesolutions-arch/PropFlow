# AppContext Loading and Error Hardening Audit

Date: 2026-05-12
Related issue: #11

## Purpose

This audit defines the next safe implementation scope for preventing stuck user states inside `src/lib/AppContext.jsx`. The previous router-level guardrail added a recovery screen when global auth/workspace loading takes too long. This document covers the follow-up work needed inside the app context layer.

## Current status

Completed before this audit:

- GitHub CI build guardrails are active.
- Router-level loading recovery exists in `src/routes/AppRouter.jsx`.
- Users should no longer be left with only an indefinite loading spinner if `authLoading` remains true too long.

Still to verify or harden:

- AppContext session bootstrap should always resolve loading state.
- Workspace/member/profile fetch errors should become visible app warnings rather than permanent blockers.
- Optional module queries should fail gracefully to empty arrays where the table is missing or not configured.
- Refresh/retry behavior should be predictable after transient Supabase/network failures.

## Implementation target

Primary file:

```text
src/lib/AppContext.jsx
```

Potential supporting files:

```text
src/routes/AppRouter.jsx
src/components/layout/AppLayout.jsx
src/components/EnvironmentSetupNotice.jsx
docs/REPO_QA_STATUS.md
```

## Required behavior

### 1. Auth/session bootstrap

- `authLoading` must always become false after the initial session check finishes.
- Session bootstrap should use `try/catch/finally`.
- Supabase-not-configured state should set a safe anonymous app state and end loading.
- Auth/network errors should set a visible app-level warning and end loading.
- Stale local workspace ids should not block the app.

### 2. Workspace loading

- Missing workspace membership should route to `/workspace-setup` instead of leaving the user loading.
- Workspace fetch errors should not leave `currentWorkspace` in an impossible half-loaded state.
- If the selected workspace id is invalid, AppContext should choose the first active membership workspace or clear the selection safely.
- Suspended/revoked memberships should not be treated as active workspace access.

### 3. Optional module query fallback

These modules should fail safely if their table, view, or relationship is missing during setup:

- bookings
- leases
- contacts
- cleaning tasks
- maintenance work orders
- invites
- members
- property assignments
- files/uploads
- notifications
- notification preferences
- notification delivery logs
- reports
- expenses
- supplies/inventory
- billing tables
- direct booking tables
- calendar import tables

Expected fallback:

- Use empty arrays or safe nulls from `emptyData`.
- Set a visible workspace warning message.
- Do not crash the route.
- Do not block dashboard rendering.

### 4. Retry behavior

Expose or preserve a safe refresh method from AppContext:

```text
refreshWorkspaceData()
```

Expected behavior:

- Can be called after transient Supabase/network errors.
- Does not duplicate records.
- Does not change the active workspace unexpectedly.
- Does not leave loading flags stuck if one query fails.

### 5. User-facing warning behavior

AppLayout should continue to show a workspace data warning when AppContext reports a loading/fetch issue.

Warnings should be:

- customer-safe
- non-technical where possible
- not raw stack traces
- not raw provider secrets or env names for normal customer users
- actionable enough to retry, reload, or contact support

## Do not change in this task

- Do not change Supabase schema.
- Do not change RLS policies.
- Do not change storage policies.
- Do not rewrite auth architecture.
- Do not add demo data.
- Do not add fake records.
- Do not enable external provider sending.
- Do not change Stripe billing behavior.
- Do not rebuild dashboards.

## Suggested implementation strategy

1. Inspect all `useState` loading flags in `AppContext.jsx`.
2. Inspect the initial auth/session `useEffect`.
3. Inspect workspace/member/profile loading functions.
4. Inspect `refreshWorkspaceData` and any functions it calls.
5. Confirm every async loading path has `finally` cleanup.
6. Add a small helper for optional query fallback if one does not already exist.
7. Avoid broad refactors. Patch only the risky stuck-loading paths.
8. Run CI and manually test the routes below.

## Manual QA checklist

Test without Supabase env vars:

- `/`
- `/pricing`
- `/login`
- `/signup`
- protected route redirect to `/login`

Test with Supabase configured:

- Login as a valid workspace owner.
- Refresh `/dashboard`.
- Refresh `/settings`.
- Refresh `/bookings`.
- Refresh `/cleaning`.
- Refresh `/maintenance`.
- Sign in as a user with no workspace and confirm `/workspace-setup`.
- Sign in as suspended user and confirm `/suspended`.
- Delete/clear stale `propflow.currentWorkspaceId` in browser storage and refresh.
- Temporarily simulate a missing optional table in a test Supabase project and confirm the route still renders with a warning.

## Acceptance criteria for the future implementation PR

- `npm ci` passes.
- `npm run build` passes.
- CI passes.
- No indefinite loading state after initial auth/session check.
- Supabase-not-configured state renders safely.
- Workspace-less users route to workspace setup.
- Optional module errors do not crash dashboard rendering.
- AppLayout shows a safe warning for workspace data fetch failures.
- No schema/RLS/provider changes are included.

## Recommended PR title for the implementation

```text
Harden AppContext loading and workspace data fallbacks
```
