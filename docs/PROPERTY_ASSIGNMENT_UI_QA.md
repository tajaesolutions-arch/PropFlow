# Property Assignment UI QA

This QA note covers the frontend-only property assignment management workflow. The UI uses existing `workspace_members`, `profiles`, `properties`, `property_assignments`, and `contacts` records. No schema, migration, RLS, Stripe, Resend, direct booking, iCal, upload, or billing backend logic is changed by this feature.

## Assignment Role Matrix

| Assignment role | Eligible team member source | Typical access intent | Notes |
| --- | --- | --- | --- |
| `property_owner` | Active invited workspace member with `property_owner` role | Owner dashboard and assigned property/report visibility | Must be a login user; CRM owner contacts do not qualify. |
| `cleaner` | Active invited workspace member with `cleaner` role | Cleaner task/property context | Suspended/revoked members are hidden. |
| `maintenance` | Active invited workspace member with `maintenance` role | Maintenance work-order/property context | Suspended/revoked members are hidden. |
| `host` | Active invited workspace member with `host` role | Host property responsibility tracking | Host users do not manage assignments unless their current permissions explicitly allow it. |
| `accountant` | Active invited workspace member with `accountant` role | Finance/report property responsibility tracking | Accountant users are read-only for assignment management. |

`propflow_admin` is platform-level only and must not appear in customer workspace assignment dropdowns.

## Who Can Manage Assignments

- `workspace_owner`
- `property_manager`

Management includes opening the assignment modal, saving assignments, and removing property assignments. Supabase RLS remains the final enforcement layer; the frontend only guides the allowed workflow.

## Who Can Only View Assignments

- `host`
- `cleaner`
- `maintenance`
- `property_owner`
- `accountant`

Read-only roles may see relevant assignment context where the page is already available to them, but assignment controls should not be visible.

## CRM Owner vs Login Owner

PropFlow has two separate owner concepts:

1. **Owner contact / CRM record** — a person or company used for ownership records, communications, statements, and business context.
2. **Property Owner login user** — an invited workspace member with the `property_owner` role who can access the owner dashboard and assigned property/report data.

The UI must never convert CRM owner contacts into login users automatically. To give an owner portal access, invite them as a Property Owner and assign them to one or more properties.

## Property Detail Assignment Test Cases

- Workspace Owner can open a property profile and see the **Assigned Team** panel.
- Property Manager can open the same panel and manage assignments.
- Host, Cleaner, Maintenance, Property Owner, and Accountant see read-only assignment context only.
- Empty state reads: “No team members assigned yet.” and explains assigning owners, cleaners, maintenance crew, hosts, or accountants.
- Assignment rows show person name, email, assignment role, member status, assigned date, and a remove action for managers.
- Assignment role groups show counts for `property_owner`, `cleaner`, `maintenance`, `host`, and `accountant`.
- Removing an assignment shows a saving/removing state and a clear error if Supabase RLS blocks deletion.

## Assignment Modal Test Cases

- Opening from Property Detail preselects the current property.
- Property, Assignment role, and Team member fields are required.
- Team member dropdown only lists active members with the selected role.
- Suspended/revoked members do not appear.
- PropFlow Admin users do not appear.
- If no eligible member exists, the modal shows: “No active team member with this role yet. Invite one first.”
- Invite Team Member action opens the existing invite flow.
- Duplicate property + user + assignment role combinations are blocked before submit.
- Supabase errors are displayed without bypassing RLS.

## Settings / Team Assignment Test Cases

- Team rows show member name/email, roles, status, assigned property count, and assignment summary.
- Members with zero assignments display “Needs assignment.”
- Workspace Owners see lifecycle controls and **Manage assignments**.
- Property Managers can manage assignments but not owner-only lifecycle controls.
- Empty states cover:
  - Workspace has properties but no team: “Invite your team to start assigning property access.”
  - Workspace has team but no properties: “Add a property before assigning team access.”
  - Workspace has both but no assignments: “Assign property access so each person only sees what they need.”

## Property List Assignment Visibility Test Cases

- Property cards show compact chips for owner login assignment, cleaner count, maintenance count, and host/accountant count when present.
- Property table includes a compact Assigned Team column.
- Owner-facing property list remains scoped to assigned owner properties, including property assignments for the current user.

## Owners Page Clarity Test Cases

- Owner contacts are labeled as CRM/contact records without portal login.
- Property Owner workspace members are labeled as login access.
- Page copy says: “To give an owner portal access, invite them as a Property Owner and assign them to one or more properties.”
- Creating an owner contact does not create a login user.

## Cleaning / Maintenance Assignment Test Cases

- Cleaning task modal warns when a selected active cleaner is not assigned to the selected property.
- Maintenance work-order modal warns when a selected active maintenance user is not assigned to the selected property.
- Existing valid task/work-order creation is not blocked solely by the warning unless current backend/RLS rules block it.

## Mobile Checklist

Test at 390px and 768px:

- Assignment panel tables scroll or collapse using existing responsive table styles.
- Assignment modal fits within the viewport and scrolls vertically.
- Dropdowns remain usable.
- Remove buttons are visible but not oversized or dangerously easy to tap accidentally.
- Settings team rows remain readable.
- Property assignment chips wrap without clipping property card content.

## Known Remaining TODOs

- Backend/RLS should remain the source of truth for property-scoped data access; this PR only adds frontend workflow clarity.
- Future role management could allow safe role edits for active members; current assignment role must match existing member roles.
- Invite modal currently supports one primary role from the shared create action, while Settings supports multi-role invites.
- More detailed audit history per assignment can be added if the database exposes richer assignment metadata.
