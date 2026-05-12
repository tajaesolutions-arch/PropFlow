import React from 'react';
import { Building2, CheckCircle2, ShieldCheck, X } from 'lucide-react';

import { StatusBadge } from './StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { useCreateAction } from './CreateActionProvider.jsx';
import {
  assignablePropertyRoles,
  formatAssignmentRole,
  getMemberEmail,
  getMemberId,
  getMemberName,
  hasDuplicateAssignment,
  listEligibleMembersByRole,
} from '../lib/propertyAssignments.js';
import { roles } from '../data/constants.js';

function getPropertyName(property) {
  return property?.name || property?.address || 'Unnamed property';
}

function roleHelp(role) {
  if (role === roles.OWNER) return 'Property Owner access requires an invited workspace member with the Property Owner role. CRM owner contacts are not login users.';
  if (role === roles.CLEANER) return 'Cleaner assignments control property context for cleaning workflows.';
  if (role === roles.MAINTENANCE) return 'Maintenance assignments control property context for repair workflows.';
  if (role === roles.HOST) return 'Host assignments document which properties a host supports.';
  if (role === roles.ACCOUNTANT) return 'Accountant assignments document finance/report property visibility.';
  return 'Assignments should match the member role.';
}

export function PropertyAssignmentModal({ propertyId = '', userId = '', assignmentRole = roles.CLEANER, onClose, onSaved }) {
  const app = useApp();
  const { openCreateAction } = useCreateAction();
  const { data, currentWorkspace, createPropertyAssignment } = app;
  const properties = (data.properties || []).filter((property) => property.status !== 'archived');
  const assignments = data.propertyAssignments || [];
  const [form, setForm] = React.useState({
    propertyId: propertyId || properties[0]?.id || '',
    assignmentRole,
    userId,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const eligibleMembers = listEligibleMembersByRole(data.members || [], form.assignmentRole);
  const selectedMemberIsEligible = eligibleMembers.some((member) => getMemberId(member) === form.userId);
  const isDuplicate = Boolean(form.propertyId && form.userId && form.assignmentRole && hasDuplicateAssignment(assignments, form));

  React.useEffect(() => {
    setForm((current) => {
      if (!current.userId || listEligibleMembersByRole(data.members || [], current.assignmentRole).some((member) => getMemberId(member) === current.userId)) return current;
      return { ...current, userId: '' };
    });
  }, [data.members, form.assignmentRole]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setError('');
    setSuccess('');
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'assignmentRole' ? { userId: '' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    if (!currentWorkspace?.id) {
      setError('Select a workspace before assigning property access.');
      return;
    }

    if (!properties.length) {
      setError('Add a property before assigning team access.');
      return;
    }

    if (!form.propertyId || !form.assignmentRole || !form.userId) {
      setError('Choose a property, assignment role, and active team member.');
      return;
    }

    if (!selectedMemberIsEligible) {
      setError('Team member must be active and have the selected role. PropFlow Admin users cannot be assigned.');
      return;
    }

    if (isDuplicate) {
      setError('This team member is already assigned to this property with the selected role.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await createPropertyAssignment({ propertyId: form.propertyId, userId: form.userId, assignmentRole: form.assignmentRole });
      setSuccess('Property assignment saved.');
      onSaved?.('Property assignment saved.');
      window.setTimeout(() => onClose?.(), 650);
    } catch (err) {
      setError(err?.message || 'Property assignment could not be saved. Supabase RLS may have blocked this action.');
    } finally {
      setBusy(false);
    }
  };

  const openInvite = () => {
    openCreateAction('invite');
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel property-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="property-assignment-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Property access</p>
            <h2 id="property-assignment-title">Assign team member</h2>
            <p>Grant role-scoped access to a real invited workspace member for a specific property.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close assignment modal" data-skip-create-action="true">
            <X size={18} />
          </button>
        </header>

        <form className="modal-form" onSubmit={submit} noValidate>
          <div className="modal-body">
            <div className="assignment-guidance">
              <ShieldCheck size={18} />
              <span>{roleHelp(form.assignmentRole)}</span>
            </div>

            {error && <div className="helper error-helper" role="alert">{error}</div>}
            {success && <div className="helper" role="status"><CheckCircle2 size={16} /> {success}</div>}

            {!properties.length && (
              <div className="helper warning-helper">Add a property before assigning team access.</div>
            )}

            <div className="form-grid">
              <label>
                Property
                <select value={form.propertyId} onChange={set('propertyId')} disabled={busy || Boolean(propertyId)} required>
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{getPropertyName(property)}</option>
                  ))}
                </select>
                {propertyId && <small className="form-hint">Preselected from this property profile.</small>}
              </label>

              <label>
                Assignment role
                <select value={form.assignmentRole} onChange={set('assignmentRole')} disabled={busy} required>
                  {assignablePropertyRoles.map((role) => (
                    <option key={role} value={role}>{formatAssignmentRole(role)}</option>
                  ))}
                </select>
              </label>

              <label className="full">
                Team member
                <select value={form.userId} onChange={set('userId')} disabled={busy || !eligibleMembers.length} required>
                  <option value="">{eligibleMembers.length ? 'Select active team member' : 'No active team member with this role yet'}</option>
                  {eligibleMembers.map((member) => (
                    <option key={getMemberId(member)} value={getMemberId(member)}>
                      {getMemberName(member)} — {getMemberEmail(member)}
                    </option>
                  ))}
                </select>
                {!eligibleMembers.length ? (
                  <small className="form-hint">No active team member with this role yet. Invite one first.</small>
                ) : (
                  <small className="form-hint">Only active members with the selected role are shown. Suspended, revoked, and PropFlow Admin users are excluded.</small>
                )}
              </label>
            </div>

            {isDuplicate && (
              <div className="helper warning-helper">This exact property, member, and role assignment already exists.</div>
            )}

            {!eligibleMembers.length && (
              <div className="assignment-empty-actions">
                <Building2 size={18} />
                <span>No active team member with this role yet. Invite one first.</span>
                <button type="button" onClick={openInvite} data-skip-create-action="true">Invite team member</button>
              </div>
            )}

            <div className="assignment-role-summary">
              <StatusBadge tone="info">{formatAssignmentRole(form.assignmentRole)}</StatusBadge>
              <small>Assignments do not create users. Use invites for login access.</small>
            </div>
          </div>

          <footer className="modal-actions">
            <button type="button" onClick={onClose} disabled={busy} data-skip-create-action="true">Cancel</button>
            <button className="primary" type="submit" disabled={busy || !eligibleMembers.length || isDuplicate || !properties.length} data-skip-create-action="true">
              {busy ? 'Saving…' : 'Save assignment'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
