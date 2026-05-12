import React from 'react';
import { Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';

import { DataTable } from './DataTable.jsx';
import { EmptyState } from './EmptyState.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { useCreateAction } from './CreateActionProvider.jsx';
import { formatDate } from '../lib/formatters.js';
import {
  assignablePropertyRoles,
  canManagePropertyAssignments,
  formatAssignmentRole,
  getAssignmentRole,
  getAssignmentUserId,
  getMemberEmail,
  getMemberId,
  getMemberName,
  listAssignmentsByProperty,
  listEligibleMembersByRole,
} from '../lib/propertyAssignments.js';
import { PropertyAssignmentModal } from './PropertyAssignmentModal.jsx';

function findMember(members, userId) {
  return (members || []).find((member) => getMemberId(member) === userId);
}

function groupAssignments(assignments) {
  return assignablePropertyRoles.map((role) => ({
    role,
    assignments: assignments.filter((assignment) => getAssignmentRole(assignment) === role),
  }));
}

export function PropertyAccessPanel({ property, app, onMessage }) {
  const { openCreateAction } = useCreateAction();
  const { data, memberships, currentWorkspace, removePropertyAssignment } = app;
  const [modalOpen, setModalOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [error, setError] = React.useState('');
  const canManage = canManagePropertyAssignments(memberships, currentWorkspace);
  const assignments = listAssignmentsByProperty(data.propertyAssignments || [], property?.id);
  const hasEligibleMembers = assignablePropertyRoles.some((role) => listEligibleMembersByRole(data.members || [], role).length > 0);

  const remove = async (assignment) => {
    if (!canManage || !assignment?.id) return;
    setBusyId(assignment.id);
    setError('');
    try {
      await removePropertyAssignment(assignment.id);
      onMessage?.('Property assignment removed.');
    } catch (err) {
      setError(err?.message || 'Property assignment could not be removed.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="card property-access-panel">
      <div className="card-header">
        <div>
          <p className="eyebrow">Property access</p>
          <h3>Assigned Team</h3>
          <p>Owners, cleaners, maintenance crew, hosts, and accountants assigned to this property.</p>
        </div>
        <ShieldCheck size={20} className="muted" />
      </div>

      {error && <div className="helper error-helper" role="alert">{error}</div>}

      <div className="property-access-actions">
        {canManage ? (
          <>
            <button type="button" className="primary" onClick={() => setModalOpen(true)} data-skip-create-action="true">
              <Plus size={16} /> Assign team member
            </button>
            {!hasEligibleMembers && (
              <button type="button" onClick={() => openCreateAction('invite')} data-skip-create-action="true">
                <UserPlus size={16} /> Invite team member
              </button>
            )}
          </>
        ) : (
          <span className="helper">Assignment management is read-only for your role.</span>
        )}
      </div>

      {!assignments.length ? (
        <EmptyState
          compact
          icon={Users}
          title="No team members assigned yet."
          description="Assign owners, cleaners, maintenance crew, hosts, or accountants to control who can access this property."
          action={canManage ? <button type="button" className="primary" onClick={() => setModalOpen(true)} data-skip-create-action="true">Assign team member</button> : null}
        />
      ) : (
        <div className="assignment-role-stack">
          {groupAssignments(assignments).map(({ role, assignments: roleAssignments }) => (
            <div className="assignment-role-group" key={role}>
              <div className="assignment-role-group-header">
                <strong>{formatAssignmentRole(role)}</strong>
                <StatusBadge tone={roleAssignments.length ? 'success' : 'info'}>{roleAssignments.length}</StatusBadge>
              </div>

              {roleAssignments.length ? (
                <DataTable
                  compact
                  rows={roleAssignments}
                  empty="No assignments for this role."
                  columns={[
                    {
                      key: 'person',
                      label: 'Person',
                      render: (row) => {
                        const member = findMember(data.members || [], getAssignmentUserId(row));
                        return (
                          <span>
                            <strong>{member ? getMemberName(member) : 'Unknown member'}</strong>
                            <small>{member ? getMemberEmail(member) : getAssignmentUserId(row)}</small>
                          </span>
                        );
                      },
                    },
                    {
                      key: 'role',
                      label: 'Assignment role',
                      render: (row) => formatAssignmentRole(getAssignmentRole(row)),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (row) => {
                        const member = findMember(data.members || [], getAssignmentUserId(row));
                        return <StatusBadge tone={member?.status === 'active' ? 'success' : 'warning'}>{member?.status || 'unknown'}</StatusBadge>;
                      },
                    },
                    {
                      key: 'created_at',
                      label: 'Assigned',
                      render: (row) => formatDate(row.created_at || row.createdAt),
                    },
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (row) => canManage ? (
                        <button type="button" onClick={() => remove(row)} disabled={busyId === row.id} data-skip-create-action="true">
                          <Trash2 size={16} /> {busyId === row.id ? 'Removing…' : 'Remove'}
                        </button>
                      ) : '—',
                    },
                  ]}
                />
              ) : (
                <p className="assignment-role-empty">No {formatAssignmentRole(role).toLowerCase()} assigned.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <PropertyAssignmentModal
          propertyId={property.id}
          onClose={() => setModalOpen(false)}
          onSaved={(message) => onMessage?.(message)}
        />
      )}
    </section>
  );
}
