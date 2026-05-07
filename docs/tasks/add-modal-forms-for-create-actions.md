# Add modal forms for PropFlow create actions

## Task
Add modal pop-up forms for all main “Add” buttons in the PropFlow MVP.

## Goal
When a user clicks buttons such as:

- Add Property
- Add Booking
- Add Cleaning Task
- Add Maintenance Work Order
- Add Owner
- Add Guest
- Invite Team Member
- Add Expense / Add Report if those buttons exist

The app should open a clean modal pop-up form instead of doing nothing or sending the user to a blank/broken workflow.

All modal forms must use a shared create-action pattern so dashboard quick-action buttons and page-level Add buttons can open the same form components without duplicate logic.

## Guardrails

- Do not rebuild the app.
- Do not replace the current architecture.
- Do not redesign the full UI.
- Do not remove existing routes or pages.
- Keep this as a small, safe CRUD/UI workflow improvement.

## Modal behavior requirements

1. Clicking an Add button opens a centered modal dialog.
2. The background should dim slightly.
3. The modal should have:
   - Clear title
   - Short helper text
   - Required form fields
   - Cancel button
   - Save/Create button
   - Close X button
4. Pressing Cancel or X closes the modal without saving.
5. Pressing Save validates required fields.
6. If required fields are missing, show clear inline validation messages.
7. After successful save:
   - Close the modal.
   - Show a success message/toast if the app already has toast support.
   - Add the new record to the visible page state in demo mode.
   - Keep the UI stable with no refresh required.

## Important implementation notes

If the app is still using sample/demo data, save the new records into local component state or the existing demo/localStorage state system.

Do not fake-submit to Supabase unless the current app already has working Supabase CRUD helpers for that entity.

Prepare the code so Supabase integration can be added later cleanly.

## Design requirements

Use the existing PropFlow visual system:

- Background: `#F7F8FA`
- Cards/modal: `#FFFFFF`
- Sidebar: `#0B2545`
- Primary text: `#0F172A`
- Secondary text: `#64748B`
- Border: `#E5E7EB`
- Accent teal: `#1B998B`
- Success: `#16A34A`
- Warning: `#D97706`
- Error: `#DC2626`
- Info: `#2563EB`

The modal should feel premium, clean, compact, and SaaS-ready.

Avoid flashy gradients, oversized forms, cramped spacing, or browser-default inputs.

## Implementation instructions

### Step 1 — Inspect existing structure

Review:

- `package.json`
- `src/App.jsx` or `src/routes/AppRouter.jsx`
- `src/pages`
- `src/components`
- `src/lib/AppContext.jsx`
- `src/data/sampleData.js` if still present
- `src/styles/global.css`

Identify every visible “Add” button across the app.

### Step 2 — Create reusable modal components

Create reusable modal components if they do not already exist.

Suggested files:

- `src/components/ui/Modal.jsx`
- `src/components/ui/FormField.jsx`
- `src/components/ui/SelectField.jsx`
- `src/components/ui/TextareaField.jsx`

The modal should be reusable for all forms.

### Step 3 — Create add form components

Create separate form components for major entities.

Suggested files:

- `src/components/forms/AddPropertyForm.jsx`
- `src/components/forms/AddBookingForm.jsx`
- `src/components/forms/AddCleaningTaskForm.jsx`
- `src/components/forms/AddMaintenanceWorkOrderForm.jsx`
- `src/components/forms/AddOwnerForm.jsx`
- `src/components/forms/AddGuestForm.jsx`
- `src/components/forms/InviteTeamMemberForm.jsx`

Keep each form simple and MVP-ready.

### Step 4 — Required form fields

#### Add Property form

- Property name
- Property type
- Address / location
- City
- Country
- Currency
- Nightly rate or monthly rent
- Status
- Assigned owner optional
- Notes optional

#### Add Booking form

- Guest name
- Property
- Check-in date
- Check-out date
- Booking platform
- Booking status
- Payment status
- Total amount
- Guest notes optional

#### Add Cleaning Task form

- Property
- Assigned cleaner
- Cleaning date
- Cleaning time
- Related booking optional
- Status
- Checklist notes optional
- Supplies used optional

#### Add Maintenance Work Order form

- Property
- Issue title
- Issue description
- Priority
- Status
- Assigned maintenance person optional
- Estimated cost optional
- Due date
- Parts/materials needed optional

#### Add Owner form

- Owner name
- Email
- Phone optional
- Assigned property optional
- Payout percentage optional
- Notes optional

#### Add Guest form

- Guest name
- Email optional
- Phone optional
- Property/booking optional
- Notes optional

#### Invite Team Member form

- Email
- Role
- Assigned properties optional
- Invite expiration date optional
- Optional message

### Step 5 — Connect buttons

Update the relevant pages so their Add buttons open the correct modal.

Examples:

- Properties page → Add Property modal
- Bookings page → Add Booking modal
- Cleaning page → Add Cleaning Task modal
- Maintenance page → Add Maintenance Work Order modal
- Owners page → Add Owner modal
- Guests page → Add Guest modal
- Settings or Team page → Invite Team Member modal
- Dashboard quick actions → open the matching modal

Do not leave decorative Add buttons that do nothing.

### Step 6 — Demo state behavior

When a new record is created in demo mode:

- Add it to the page’s visible records immediately.
- Keep the data shape consistent with existing records.
- Generate a safe temporary ID such as `crypto.randomUUID()` if available, with fallback.
- Do not break filters/search/table rendering.
- Empty states should disappear when the first record is added.
- Use one centralized demo-state helper or AppContext action where practical, instead of each page managing completely separate local records.

### Step 7 — Validation

Add basic validation:

- Required text fields cannot be empty.
- Dates must be valid.
- Check-out date must be after check-in date.
- Amounts/costs must be numeric and cannot be negative.
- Email fields must roughly match email format when provided.
- Required select fields must have a selected value.

### Step 8 — Accessibility

Modal must:

- Close with Escape key.
- Trap focus inside the modal where practical.
- Use proper aria labels.
- Prevent background page scrolling while open.
- Be usable on mobile.

### Step 9 — Mobile responsiveness

On mobile:

- Modal should fit within screen width.
- Form should scroll inside modal if long.
- Buttons should remain tappable.
- Inputs should stack cleanly.

### Step 10 — Supabase readiness

Do not hardcode fake backend calls.

Add comments or helper boundaries where future Supabase insert calls should go.

If Supabase CRUD helpers already exist, use them carefully.

If they do not exist, keep demo-mode local state only and do not create broken API logic.

### Step 11 — Styling

Add or update CSS so:

- Modal overlay looks polished.
- Modal card has soft shadow, rounded corners, and clean spacing.
- Inputs, selects, textareas, and buttons match the rest of the app.
- Validation errors are clear but not aggressive.
- Save button uses the PropFlow teal accent.
- Cancel button is neutral.

### Step 12 — Build validation

Run:

```bash
npm install
npm run build
```

Fix all build errors.

## Suggested branch

`codex/add-modal-forms-for-create-actions`

## Suggested PR title

`Add modal forms for PropFlow create actions`

## Required PR summary

The implementation PR should include:

- Which Add buttons now open modal forms.
- Which forms were added.
- How demo-state saving works.
- Whether `npm run build` passed.
- Any known remaining limitations.
