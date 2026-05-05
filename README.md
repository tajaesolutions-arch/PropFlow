# PropFlow

PropFlow is a production-oriented MVP foundation for a property management SaaS supporting homeowners, Airbnb hosts, property managers, real estate companies, landlords, cleaning companies, and maintenance teams.

## What is included

- React + Vite app with a Vercel-ready SPA rewrite.
- Supabase client setup using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Demo mode that works without Supabase environment variables.
- Multi-workspace application shell with workspace switcher and workspace-scoped local demo data.
- Role-aware demo login routing:
  - PropFlow Admin → `/admin`
  - Workspace Owner / Company Admin → `/dashboard`
  - Property Manager → `/dashboard`
  - Host → `/dashboard`
  - Owner → `/owner-dashboard`
  - Cleaner → `/cleaner-dashboard`
  - Maintenance Crew → `/maintenance-dashboard`
- Suspended account handling at `/suspended`.
- Public pages: landing, pricing, login, signup, join workspace, suspended account.
- Core app pages: dashboard, properties, property detail, bookings, cleaning, maintenance, owners, guests/CRM, reports, notifications, settings, account settings, admin dashboard, owner dashboard, cleaner dashboard, and maintenance dashboard.
- Reusable components: `AppLayout`, `Sidebar`, `TopBar`, `StatCard`, `ChartCard`, `DataTable`, `StatusBadge`, `FilterBar`, `SearchBox`, `EmptyState`, `RoleGuard`, `WorkspaceSwitcher`, and `AccountMenu`.
- Supabase migration and demo seed files for workspace-scoped SaaS tables and RLS policies.

## Tech stack

- React
- Vite
- Supabase
- Lucide React icons
- Recharts
- Standard CSS

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the local Vite URL shown in your terminal.

## Build

```bash
npm run build
```

## Environment variables

Create `.env.local` when connecting a real Supabase project:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

If these variables are missing, PropFlow displays a clean helper on the login/settings screens and keeps demo UI available.

## Supabase setup

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/202605050001_propflow_schema.sql`.
3. Create real auth users for your demo/team accounts.
4. Update UUIDs in `supabase/seed/seed_demo.sql` to match real `auth.users.id` values.
5. Run the seed file.
6. Configure your production auth callback URLs for local dev and Vercel.

The schema stores roles on `workspace_members.roles`, supports multiple roles per workspace, includes `workspace_id` on tenant-scoped tables, and enables simple RLS policies that only allow active workspace members or PropFlow admins to access workspace data.

## Demo login instructions

Go to `/login` and use any demo login button:

- PropFlow Admin
- Workspace Owner
- Property Manager
- Host
- Owner
- Cleaner
- Maintenance Crew
- Suspended User

Demo login automatically routes users by role. The login page does not ask users to manually choose a destination.

## Vercel deployment

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Use the default Vite build command:

```bash
npm run build
```

4. Use `dist` as the output directory.
5. Add Supabase environment variables in Vercel project settings.
6. `vercel.json` rewrites all paths to `index.html` so client-side routes work.

## Production TODOs

- Replace demo auth with full Supabase auth session handling and membership lookup after login.
- Replace local demo state reset with Supabase RPC/service functions.
- Add Stripe Checkout and billing portal integration where TODO comments are shown in pricing/settings.
- Add storage bucket upload flows for property, cleaning, and maintenance photos.
- Add real PDF/CSV export generation and owner report email automation.
- Add advanced permission checks per action, not just per route/page.
- Add live currency conversion only after selecting a reliable FX provider and audit approach.
- Add automated tests, observability, error boundaries, and production analytics.
