# Core Page Placeholder Audit (May 19, 2026)

## Scope searched
Focused core app pages/components plus routing/context surfaces:
- `src/pages/PropertiesPage.jsx`
- `src/pages/PropertyDetailPage.jsx`
- `src/pages/BookingsPage.jsx`
- `src/pages/CleaningPage.jsx`
- `src/pages/CleanerDashboardPage.jsx`
- `src/pages/MaintenancePage.jsx`
- `src/pages/MaintenanceDashboardPage.jsx`
- `src/pages/OwnersPage.jsx`
- `src/pages/OwnerDashboardPage.jsx`
- `src/pages/GuestsPage.jsx`
- `src/pages/ReportsPage.jsx`
- `src/pages/InventoryPage.jsx`
- `src/pages/CalendarPage.jsx`
- `src/pages/NotificationsPage.jsx`
- `src/pages/SettingsPage.jsx`
- `src/pages/AccountSettingsPage.jsx`
- `src/components/CreateActionProvider.jsx`
- `src/lib/AppContext.jsx`
- `src/data/sampleData.js`
- `src/routes/AppRouter.jsx`
- `README.md`

Search terms used:
`placeholder`, `coming soon`, `demo`, `sample`, `lorem`, `fake`, `static`, `TODO`, `not implemented`, `export coming soon`, `sync coming soon`, `connect later`, `mock`.

## Placeholders fixed in this PR
- Added a dedicated core-page placeholder contract test to block obvious customer-facing fake/demo/mock/lorem wording regressions in core pages.
- Added contract assertions that core pages do not directly import `sampleData`.
- Added route/action contract checks so clickable CTA and route assumptions stay aligned with `AppRouter` and `CreateActionProvider`.
- Added static secret-safety checks across core frontend surfaces to catch accidental `service-role` references.

## Placeholders intentionally kept
- Intentional future-state messaging such as `Coming soon` and provider `Not configured yet` states where features are explicitly out-of-scope for this PR.
- Reports local export notices and disabled-provider copy that accurately communicates current behavior without fake export generation.
- Smart Tools / AI Tools coming-soon surfaces remain intentionally preserved outside this core-page polish scope.

## Placeholders deferred to later PRs
- Provider integrations (Stripe backend completion, Resend/Twilio delivery wiring) remain setup-gated.
- Calendar external sync automation and full provider/channel integrations remain future work.
- PDF generation pipelines and scheduled report delivery remain deferred while frontend messaging stays honest and disabled where required.

## Recommended next PR
- Continue replacing residual “local/demo/setup-mode” internal phrasing in user-facing helper copy with polished, role-specific readiness language while preserving safety constraints and disabled-state honesty.

- Dashboard setup card and onboarding page now share one real-data setup-progress utility (`src/lib/setupProgress.js`).
