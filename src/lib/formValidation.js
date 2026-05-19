export function parseOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return { value: null, error: null };
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return { value: null, error: null };
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return { value: null, error: 'Must be a valid number.' };
  return { value: parsed, error: null };
}

export function isValidEmail(value) {
  if (!String(value || '').trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function validatePropertyForm(form = {}, opts = {}) {
  const errors = [];
  if (!String(form.name || '').trim()) errors.push('Property name is required.');
  if ('type' in form && !String(form.type || '').trim()) errors.push('Property type is required.');
  if ('address' in form && !String(form.address || '').trim()) errors.push('Address or location is required.');
  const nightly = parseOptionalNumber(form.nightly_rate ?? form.nightlyRate);
  const monthly = parseOptionalNumber(form.monthly_rent ?? form.monthlyRent);
  if (nightly.error) errors.push('Nightly rate must be numeric when provided.');
  if (monthly.error) errors.push('Monthly rent must be numeric when provided.');
  return {
    errors,
    normalized: {
      ...form,
      currency: String(form.currency || opts.workspaceCurrency || 'USD').toUpperCase(),
      nightly_rate: nightly.value,
      monthly_rent: monthly.value,
    },
  };
}

export function validateBookingForm(form = {}) {
  const errors = [];
  if (!form.property_id) errors.push('Property is required.');
  if (!String(form.guest_name || form.contact_name || '').trim()) errors.push('Guest/contact name is required.');
  if (!form.check_in) errors.push('Check-in date is required.');
  if (!form.check_out) errors.push('Check-out date is required.');
  if (form.check_in && form.check_out && new Date(form.check_out) <= new Date(form.check_in)) errors.push('Check-out must be after check-in.');
  const total = parseOptionalNumber(form.total_amount);
  if (total.error) errors.push('Total amount must be numeric when provided.');
  return { errors, normalized: { ...form, status: oneOf(form.status, ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'], 'pending'), payment_status: oneOf(form.payment_status, ['unpaid', 'partially_paid', 'paid', 'refunded'], 'unpaid'), total_amount: total.value } };
}

export function validateCleaningTaskForm(form = {}) { return { errors: [!form.property_id && 'Property is required.', !form.scheduled_for && 'Cleaning date/time is required.'].filter(Boolean), normalized: { ...form, status: oneOf(form.status, ['scheduled', 'in_progress', 'needs_inspection', 'completed', 'guest_ready', 'missed'], 'scheduled'), checklist_items: Array.isArray(form.checklist_items) ? form.checklist_items : [] } }; }

export function validateMaintenanceWorkOrderForm(form = {}) { const est = parseOptionalNumber(form.estimated_cost); const act = parseOptionalNumber(form.actual_cost); return { errors: [!form.property_id && 'Property is required.', !String(form.issue_title || '').trim() && 'Issue title is required.', est.error && 'Estimated cost must be numeric when provided.', act.error && 'Actual cost must be numeric when provided.'].filter(Boolean), normalized: { ...form, priority: oneOf(form.priority, ['low', 'medium', 'high', 'urgent'], 'medium'), status: oneOf(form.status, ['reported', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'], 'reported'), estimated_cost: est.value, actual_cost: act.value } }; }

export function validateOwnerForm(form = {}, properties = []) { const errors=[]; if(!String(form.name||'').trim()) errors.push('Owner name is required.'); if(form.email && !isValidEmail(form.email)) errors.push('Owner email must be valid.'); if(Array.isArray(form.assigned_property_ids)){const valid=new Set(properties.map((p)=>p.id)); if(form.assigned_property_ids.some((id)=>!valid.has(id))) errors.push('Assigned properties must belong to this workspace.');} return {errors, normalized: form}; }

export function validateGuestForm(form = {}) { const errors=[]; if(!String(form.name||'').trim()) errors.push('Guest name is required.'); if(form.email && !isValidEmail(form.email)) errors.push('Guest email must be valid.'); return {errors, normalized:{...form, contact_type: oneOf(form.contact_type, ['guest','customer'], 'guest')}}; }

export function validateSupplyForm(form = {}, properties = []) { const q=parseOptionalNumber(form.current_quantity); const min=parseOptionalNumber(form.low_stock_threshold); const errors=[]; if(!String(form.item_name||'').trim()) errors.push('Item name is required.'); if(q.error) errors.push('Quantity must be numeric when provided.'); if(min.error) errors.push('Minimum quantity must be numeric when provided.'); if(form.property_id && !properties.some((p)=>p.id===form.property_id)) errors.push('Selected property must belong to this workspace.'); return {errors, normalized:{...form, status: oneOf(form.status, ['in_stock','low_stock','out_of_stock','archived'], 'in_stock'), current_quantity:q.value, low_stock_threshold:min.value}}; }
