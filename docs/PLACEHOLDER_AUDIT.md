# Dashboard Placeholder Audit (May 19, 2026)

## Scope searched
- Dashboard and role dashboards
- Reports, calendar, inventory, notifications pages
- Create-action wiring and app context helpers

## Placeholders found
- Intentional app-level coming-soon routes (`/smart-tools`, `/help`) still use `ComingSoonPage` and remain intentionally preserved.
- Dashboard had low-interaction patterns (non-clickable KPI cards, no quick-action coverage for owner/guest/supply, and no dashboard schedule snapshot).
- Dashboard did not surface notification-driven operations context in KPI cards.

## Fixed in this PR
- Dashboard KPI cards are now actionable links to live routes (`/reports`, `/bookings`, `/maintenance`, `/inventory`, `/notifications`).
- Dashboard quick actions now include owner/guest creation and supply pathing using existing create-action/modal flows and existing inventory route.
- Dashboard now includes a real upcoming schedule snapshot (next check-in, check-out, cleaning, maintenance).
- Added dashboard contract test to prevent re-introducing obvious placeholder/demo wording and to enforce route/action contract safety.

## Intentionally kept
- Smart Tools / AI Tools and Help routes remain intentional coming-soon pages.
- Sample-data fallback module remains for safe backwards compatibility when environment is not configured; dashboard does not directly import sample data.

## Recommended next PRs
- Expand operational alerts with checkout-needs-cleaning linkage using stronger booking→cleaning relation heuristics.
- Add richer notification-derived recent activity timeline card with grouped event types.
- Add a small dashboard-empty-state CTA component set reused across dashboard cards for stricter UX consistency.
