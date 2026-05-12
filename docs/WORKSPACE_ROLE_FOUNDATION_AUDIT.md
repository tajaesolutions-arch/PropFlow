# Workspace, Role, and Workspace-Scoped Data Foundation Audit

Date: 2026-05-12
Related issue: #18

## Purpose

Issue #18 was created as a broad Phase 2 foundation issue for PropFlow's multi-tenant SaaS architecture. Since several later PRs have already implemented much of this foundation, this audit records what appears complete, what still needs live verification, and how to split any remaining work into smaller tasks.

## Current conclusion

Issue #18 should no longer be treated as one large implementation task. The repo now contains a substantial workspace and role-access foundation. Remaining work should be handled as targeted QA or small follow-up issues rather than a broad rebuild.

## Evidence from current repo

### Role constants and priority routing

Implemented in `src/data/constants.js`:

- `propflow_admin`
- `workspace_owner`
- `property_manager`
- `host`
- `accountant`
- `property_owner`
- `cleaner`
- `maintenance`

Also present:

- customer workspace role list
- invite role options excluding platform admin
- property-scoped invite roles
- property assignment role options
- role priority order
- role redirect map

### Auth and role helper logic

Implemented in `src/lib/auth.js`:

- primary role resolution
- platform admin detection
- suspended platform-admin blocking
- post-login path resolution
- active workspace role resolution from memberships
- workspace-specific post-login redirects
- active workspace role checks

### Router protection

Implemented in `src/routes/AppRouter.jsx`:

- public routes
- protected routes
- route access maps
- platform admin routing to `/admin`
- workspace-less user routing to `/workspace-setup`
- suspended user routing to `/suspended`
- billing restriction handling
- role dashboard redirect correction
- unauthorized route denial behavior
- router-level loading recovery screen

### Workspace setup and join flow

Implemented in `src/pages/JoinWorkspacePage.jsx`:

- create new workspace form
- join existing workspace form
- invite token/link/code input
- create workspace validation
- Supabase-not-configured messaging
- logged-out user protection
- auto-join attempt from invite/code query string
- company-code copy makes clear that email match is required
- plan placeholder selection

### README/status evidence

The README currently states that these are present:

- Supabase Auth session handling
- workspace creation and invite/code-based join flow
- workspace memberships with fixed MVP roles
- role-priority routing
- suspended-account routing
- workspace creation through `public.create_workspace_with_owner(...)`
- invite/code join requiring matching authenticated email and valid invite
- multi-workspace switching
- RLS tightened for workspace membership, profile visibility, property assignments, maintenance insert reporting, and assigned property access

## Issue #18 acceptance criteria status

| Acceptance criterion | Current status |
|---|---|
| Authenticated user with no workspace routes to `/workspace-setup` | Appears implemented; needs live QA |
| User can create workspace and becomes workspace owner | Appears implemented through RPC; needs live Supabase QA |
| User can join only with valid invite or matching code + invited email | Appears implemented; needs live Supabase QA |
| User role is loaded from workspace membership data | Appears implemented |
| User routes to correct dashboard after login | Appears implemented |
| Unauthorized dashboard URLs are blocked | Appears implemented |
| Data is filtered by active `workspace_id` | Largely implemented according to README; must be QA-tested by role/workspace |
| Multi-workspace switching does not expose data | Needs live QA |
| Suspended users cannot access workspace data | Appears implemented in routing/RLS; needs live QA |
| App builds successfully | Covered by GitHub CI |
| Vercel deployment succeeds | Must be verified in Vercel environment |

## Remaining work should be split

### Follow-up 1: Live workspace and role QA

Create a test plan or issue to verify:

- new user without workspace
- create workspace as owner
- invite user as each role
- join by invite link
- join by company code with matching email
- reject company code without matching invite
- role-specific dashboard routing
- direct URL access blocking
- suspended user access blocking

### Follow-up 2: Cross-workspace data isolation QA

Create or use two workspaces and verify:

- properties do not leak between workspaces
- bookings do not leak between workspaces
- cleaning tasks do not leak between workspaces
- maintenance work orders do not leak between workspaces
- reports/files/expenses do not leak between workspaces
- switching workspace changes visible data correctly

### Follow-up 3: AppContext loading and fallback hardening

This is already documented in:

```text
docs/APP_CONTEXT_LOADING_HARDENING_AUDIT.md
```

This should remain a separate implementation task because it touches a large shared state file.

### Follow-up 4: Supabase migration/runtime validation

Verify against a real Supabase project:

- every migration applies in order
- `create_workspace_with_owner` exists and works
- invite/code join RPC or action path works
- RLS blocks unauthorized workspace data access
- private storage policies work for role-scoped file access

## Recommended issue decision

Do not use issue #18 for more implementation work. It is too broad now.

Recommended path:

1. Add a triage comment to issue #18.
2. Open smaller QA issues from the follow-up list above.
3. Close issue #18 after the first live Supabase workspace/role QA pass confirms the foundation works.

## Do not do next

- Do not rebuild the workspace system.
- Do not replace the current routing system.
- Do not create duplicate dashboard logic.
- Do not weaken RLS to make QA easier.
- Do not invite `propflow_admin` through customer workspace invites.
- Do not mix platform-admin permissions with customer workspace roles.
- Do not create fake/demo production records.

## Recommended next practical task

Create a small issue/PR for:

```text
Live QA workspace, role routing, and workspace data isolation
```

This should be a test-and-verify task before any more architecture changes.
