# PropFlow Repo QA Status

Date: 2026-05-12
Branch: chore/add-github-ci-qa-guardrails-20260512

## Purpose

This document records the current repository guardrail status after the CI workflow update. It is meant to keep PropFlow development controlled while Codex usage is unavailable and while changes are made through GitHub or manual VS Code workflows.

## Current guardrails

- GitHub Actions CI exists at `.github/workflows/ci.yml`.
- CI runs on pull requests into `main`.
- CI runs on pushes to `main`.
- CI can be triggered manually with `workflow_dispatch`.
- CI installs dependencies with `npm ci`.
- CI builds the production bundle with `npm run build`.
- CI verifies the `dist` output folder exists.
- CI includes a basic committed-credential pattern scan.

## Current project facts

- PropFlow uses React, Vite, Supabase JS, Lucide React, and Recharts.
- `package.json` currently has `dev`, `build`, and `preview` scripts.
- No formal lint script exists yet.
- No formal automated test framework exists yet.
- The app depends on manual QA for route, role, workspace, Supabase, storage, billing, and provider behavior.

## Open GitHub issues observed before this guardrail PR

- Issue 18: Phase 2 workspace, role-based access, and workspace-scoped data foundation.
- Issue 13: Fix booking modal submit and persistent form UX.
- Issue 11: Guardrail to prevent infinite loading screens and stuck user states.

Some later merged PRs appear to have addressed parts of these issues. Each issue should be rechecked against the current app before starting new implementation work.

## Recommended next QA steps

1. Recheck issue 13 manually against the live app because booking and lease modal logic now exists in `src/pages/BookingsPage.jsx` and shared create-action logic exists in `src/components/CreateActionProvider.jsx`.
2. Recheck issue 11 manually by testing login, refresh, workspace setup, billing-restricted states, Supabase-not-configured states, and route fallback screens.
3. Split issue 18 into smaller follow-up issues if any remaining workspace/role/data-scoping work is still incomplete.
4. Add a lightweight test framework only after the CI workflow is stable. Suggested first target: route/auth helper unit tests, not full browser automation.
5. Avoid broad feature PRs until the current open issues are triaged.

## PR safety policy for future work

Every future PR should state:

- What changed.
- What did not change.
- Whether app code, database schema, RLS, storage policies, billing, provider logic, or documentation was touched.
- Whether `npm ci` or `npm install` was run.
- Whether `npm run build` passed.
- Which routes or workflows were manually checked.
- Any known remaining issues.

## Do not do in small PRs

- Do not rebuild the app.
- Do not replace the current architecture.
- Do not add fake production data.
- Do not weaken workspace scoping.
- Do not move platform-admin behavior into customer workspace roles.
- Do not make provider integrations live unless the PR is specifically scoped for that provider.
