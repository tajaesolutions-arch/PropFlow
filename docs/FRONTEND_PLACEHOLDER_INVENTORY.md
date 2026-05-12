# Frontend Placeholder Inventory

Launch-readiness audit for user-facing unfinished wording, dead UI, provider setup states, empty states, and role navigation. This pass is frontend-only and does not change Supabase schema, RLS, backend provider logic, migrations, or API behavior.

## Audit scope

Searched and inspected:

- `src/pages`
- `src/components`
- `src/lib`
- `src/styles/global.css`
- `src/data/constants.js`
- route, sidebar, topbar, layout, shared safety/empty-state components

Search terms included: placeholder, coming soon, soon, TODO, not implemented, demo, sample, fake, mock, lorem, disabled, provider not configured, under construction, future, AI tools, Twilio, WhatsApp, SMS, OCR, channel manager, Airbnb integration, Booking.com integration, and Vrbo integration.

## Inventory and decisions

| Page/component | Placeholder/dead UI found | Decision | Reason | Remaining future TODOs |
| --- | --- | --- | --- | --- |
| `src/components/layout/Sidebar.jsx` | Sidebar exposed advanced/unfinished operational items: Leases, Calendar Imports, Supplies / Inventory. Accountant nav also included non-core advanced items. | Hide/de-emphasize from role sidebar; keep routes intact. | Avoid confusing customer roles while preserving guarded routes/tests and direct access for existing workflows. | Re-introduce Leases, Calendar Imports, and Inventory only after they are fully productized in role-specific nav. |
| `src/pages/ComingSoonPage.jsx` | Smart Tools / AI and Help pages used launch-safety language that mentioned fake/demo data and internal implementation details. | Keep as polished coming-soon pages. | Smart Tools fits the product vision, but must clearly remain inactive and not trigger AI/email/SMS/payment work. | Add real AI workflows only after workspace-scoped backend permissions and product requirements are approved. |
| `src/components/UploadSafetyNotice.jsx` | Upload safety UI used placeholder wording and placeholder-only status labels. | Replace with setup-gated/setup-required language. | Uploads must not look broken or unfinished; storage setup should be clear and safe. | Enable uploads only when private bucket policies, signed URLs, file validation, role checks, and workspace scoping are verified. |
| `src/components/ReportsExportNotice.jsx` | Report/export readiness cards used placeholder wording. | Replace with setup-state language while keeping available CSV/print guidance. | Clarifies what is active now versus later without implying fake report data. | Add scheduled owner report delivery and stored generated PDFs later. |
| `src/components/BillingSafetyNotice.jsx` and `src/pages/BillingPage.jsx` | Stripe setup messaging exposed provider-not-configured language and fake-success wording. | Replace with provider-not-configured/setup-required wording and remove fake-success wording. | Billing buttons should never imply Stripe works when server-side setup is incomplete. | Finish Stripe checkout/portal/webhook setup outside this frontend-only PR. |
| `src/pages/PricingPage.jsx` | Pricing cards used `todo` styling and “no fake free plan” copy; Stripe status referenced backend env setup. | Replace user-facing copy with paid-plan/trial language and provider-setup wording. | Pricing should feel production-ready and not mention fake/demo concepts. | Keep Stripe checkout guarded by existing server-side endpoint behavior. |
| `src/pages/GuestsPage.jsx` | Guest CRM copy said no fake guest data. | Replace with clean workspace-record language. | Customers should see professional empty and record-source copy. | Continue using workspace-created bookings/contacts only. |
| `src/pages/DirectBookingsPage.jsx` | Empty requests state mentioned fake/demo requests. | Replace with professional empty state. | Direct booking queue should explain where records come from. | Payment automation remains provider-gated. |
| `src/pages/FilesPage.jsx` | Empty uploads state mentioned fake/demo files and migration readiness. | Replace with clean private-file empty state. | Files should present launch-ready storage setup without exposing migration language to users. | Enable more upload workflows once storage provider readiness is confirmed. |
| `src/pages/LeasesPage.jsx` | Empty state and document card used fake/placeholder wording. | Replace with existing-property and setup wording; hide from main sidebar. | Leases remain route-guarded but should not feel unfinished if accessed. | Productize e-signature, generated contracts, and document linking later. |
| `src/pages/ExpensesPage.jsx` | Export/upload cards and ledger copy used placeholder-safe/fake-demo wording; Add Expense button was disabled for read-only roles without a clear title and was not connected to the shared create action. | Replace wording, keep future export buttons disabled, and wire Add Expense to the existing shared create action for allowed roles. | Expenses are core finance MVP; available actions should be clear, disabled actions should explain why. | Backend CSV/PDF generation and receipt storage remain future work. |
| `src/pages/PublicBookingPage.jsx` and `src/pages/PublicDirectBookingPage.jsx` | Public booking payment/deposit cards used placeholder wording; direct booking visual used image placeholder label. | Replace with setup-gated wording and neutral preview label. | Public-facing direct booking should not expose unfinished language. | Connect Stripe payment rules only after backend billing is ready. |
| `src/components/OnboardingSetupNotice.jsx` | Setup checklist referenced plan placeholder and demo data. | Replace with selected-plan and clean-workspace wording. | Onboarding should communicate real setup progress only. | Subscription completion remains tied to provider readiness. |
| `src/components/SettingsAccountSafetyNotice.jsx`, `TeamWorkspaceSafetyNotice.jsx`, `OwnerAssignmentSafetyNotice.jsx`, `AuditSafetyNotice.jsx`, `InventorySafetyNotice.jsx` | Safety/readiness notices used placeholder terminology. | Replace with setup-gated/setup-state wording. | Keeps admin/settings/support notices professional while preserving safety warnings. | Replace setup-state cards with live settings once backend flows exist. |
| `src/pages/NotificationsPage.jsx` and `src/pages/NotificationSettingsPage.jsx` | Notification warnings referenced local/demo mode and provider placeholder states. | Replace with setup-required/provider-safe wording. | Normal users should see setup guidance, not demo-mode language. | Twilio SMS/WhatsApp remain inactive until server-side provider functions are connected. |
| `src/pages/DashboardPage.jsx` | Billing warning action said “Manage billing — Coming soon” even though Billing page exists. | Replace button label with “Manage billing”. | Avoid a working-looking action that simultaneously claims it is future-only. | Billing page still safely handles provider-not-configured responses. |
| `src/components/dashboard/DashboardCharts.jsx` | Chart cards say coming soon. | Keep as intentional coming-soon chart previews. | Charts are not core blockers when empty states explain no chart data yet. | Replace with real workspace charts as analytics matures. |
| `src/components/FileUploadDropzone.jsx` and `src/lib/fileUploads.js` | Video uploads are marked coming soon and blocked. | Keep as intentional disabled future support. | Prevents unsupported uploads while allowing supported file types. | Add video storage and validation later. |
| `src/data/constants.js` | Provider and direct booking setup statuses include placeholder-like internal keys. | Keep keys for compatibility; polish display labels where user-facing. | Changing stored status values could break existing data. | Migrate status keys only with a deliberate backend/schema plan, not in this PR. |

## Navigation result

- Workspace Owner / Property Manager / Host nav keeps core MVP pages: Dashboard, Properties, Bookings, Direct Bookings, Calendar, Cleaning, Maintenance, Owners, Guests, Expenses, Reports, Files/Documents, Team where allowed, Smart Tools, Notifications, Settings, Billing where allowed, and Help.
- Advanced items hidden from regular sidebar: Leases, Calendar Imports, Supplies / Inventory.
- Owner nav remains limited to owner dashboard, assigned properties, reports, files/documents, maintenance updates, notifications, and account.
- Cleaner nav remains task-focused: cleaner dashboard, cleaning tasks, notifications, and account.
- Maintenance nav remains work-order-focused: maintenance dashboard, assigned work orders, notifications, and account.
- Accountant nav focuses on accountant dashboard, properties for finance context, expenses, reports, files/documents, billing, notifications, and account.
- Platform Admin nav remains limited to Admin Dashboard.

## Provider setup states

- Stripe: Billing and pricing surfaces use provider-not-configured/setup-required wording and do not expose secrets.
- Resend: Notification settings remain provider-safe and server-side only.
- Supabase Storage: Upload notices explain setup required and private-by-default requirements.
- Twilio SMS/WhatsApp: Kept visible only as setup-gated provider status/settings, not active sending workflows.
- iCal imports: Route remains guarded; sidebar link is hidden until the workflow is ready for broader customer navigation.

## Remaining known frontend TODOs

- Replace setup-state notices with live controls after backend provider setup is complete.
- Reintroduce Leases, Calendar Imports, and Inventory into the sidebar only when each is launch-polished for the target role.
- Add real scheduled owner reports, advanced analytics, OCR/document search, deposit/refund automation, guest portal, and deep OTA/channel integrations in separate feature PRs.
- Add video upload support only after private storage validation and file handling are complete.
