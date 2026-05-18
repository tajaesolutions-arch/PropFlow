# PropFlow RLS Role Matrix (Core Workspace Modules)

This document is a founder-friendly map of who can do what in the current Supabase-backed MVP modules.

## Modules covered in this matrix

- Properties
- Bookings
- Cleaning Tasks
- Maintenance Work Orders
- Owners (contacts with `contact_type = 'owner'`)
- Guests/Customers (contacts with `contact_type in ('guest','customer')`)

## Role access summary

### Workspace Owner / Company Admin
- Full workspace operational access in the core modules above.
- Can create/update/delete where policies allow manager-level writes.

### Property Manager
- Operational manager access inside their workspace for the core modules.
- Intended to manage daily operations data across properties, bookings, cleaning, and maintenance.

### Host
- Operational access where host roles are already included by existing policies/helpers.
- This PR does not expand host permissions beyond current implementation.

### Property Owner
- Intended as mostly view-only for assigned property context.
- Should not receive broad operational editing powers in core modules unless explicitly granted by policy.

### Cleaner
- Assigned-task access only (`cleaning_tasks.assigned_cleaner_id = auth.uid()`).
- No broad access to unrelated bookings/properties/financial/CRM records.

### Maintenance Crew
- Assigned-work-order access only (`maintenance_work_orders.assigned_maintenance_id = auth.uid()`).
- No broad access to unrelated bookings/properties/financial/CRM records.

### PropFlow Admin (SaaS-level)
- Platform/admin scope is separate from customer workspace RLS.
- Frontend must not use service-role credentials.

## Data-safety model verified by static tests

- Workspace scoping via `workspace_id` in helpers and migrations.
- Relationship guards (property/contact/workspace helpers) for cross-workspace safety.
- Contact type separation for owner vs guest/customer usage.
- Sensitive-key guardrails in frontend source (no service-role or backend-secret usage).
- AppContext safety guard to avoid unsafe bare Supabase client access patterns.

## Still requires live staging DB verification

Static tests are a safety net, not a full DB simulation. Continue with live staged verification for:

- Real authenticated user role matrix walkthrough (all roles above).
- Cross-workspace denial checks with real memberships.
- Revoked/suspended member behavior.
- Storage policy checks for private operational files.
- Any report/export surfaces wired after these core modules.
