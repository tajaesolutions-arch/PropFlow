import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { roles } from '../data/constants.js';

const statuses = ['reported', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];
const closedStatuses = new Set(['completed', 'cancelled']);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatLabel(value) {
  return value ? value.replaceAll('_', ' ') : '—';
}

function getWorkOrderPropertyId(workOrder) {
  return workOrder.propertyId || workOrder.property_id;
}

function getAssignedMaintenanceId(workOrder) {
  return workOrder.assignedMaintenanceId || workOrder.assigned_maintenance_id;
}

function getDueDate(workOrder) {
  return workOrder.due || workOrder.due_date || '';
}

function isOverdue(workOrder) {
  const dueDate = getDueDate(workOrder);
  return Boolean(dueDate && dueDate < today() && !closedStatuses.has(workOrder.status));
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getEstimatedCost(workOrder) {
  return Number(workOrder.estimatedCost || workOrder.estimated_cost || 0);
}

function getActualCost(workOrder) {
  return Number(workOrder.actualCost || workOrder.actual_cost || 0);
}

function getPartsNeeded(workOrder) {
  return workOrder.partsNeeded || workOrder.parts_needed || '';
}

function getVisibleMaintenanceJobs(workOrders, currentUser) {
  const isMaintenanceCrew = currentUser?.roles?.includes(roles.MAINTENANCE);

  if (!isMaintenanceCrew) {
    return workOrders;
  }

  const hasAssignmentData = workOrders.some((workOrder) => Boolean(getAssignedMaintenanceId(workOrder)));

  if (!hasAssignmentData) {
    return workOrders;
  }

  return workOrders.filter((workOrder) => getAssignedMaintenanceId(workOrder) === currentUser?.id);
}

export function MaintenanceDashboardPage() {
  const {
    data,
    currentWorkspace,
    currentUser,
    updateMaintenanceWorkOrder,
    uploadWorkspaceFile,
  } = useApp();

  const [message, setMessage] = React.useState('');
  const [uploadingWorkOrderId, setUploadingWorkOrderId] = React.useState('');
  const [savingWorkOrderId, setSavingWorkOrderId] = React.useState('');

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const allWorkOrders = data.maintenanceWorkOrders || [];
  const visibleWorkOrders = getVisibleMaintenanceJobs(allWorkOrders, currentUser);

  const openJobs = visibleWorkOrders.filter((workOrder) => !closedStatuses.has(workOrder.status));
  const urgentJobs = visibleWorkOrders.filter(
    (workOrder) => workOrder.priority === 'urgent' && !closedStatuses.has(workOrder.status),
  );
  const waitingPartsJobs = visibleWorkOrders.filter((workOrder) => workOrder.status === 'waiting_parts');
  const overdueJobs = visibleWorkOrders.filter(isOverdue);

  const totalEstimated = visibleWorkOrders.reduce(
    (total, workOrder) => total + getEstimatedCost(workOrder),
    0,
  );

  const priorityJobs = [...openJobs].sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b)) return 1;

    return String(getDueDate(a)).localeCompare(String(getDueDate(b)));
  });

  const updateStatus = async (workOrder, status) => {
    setSavingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : workOrder.completed_at,
      });

      setMessage(`Repair marked ${formatLabel(status)}.`);
    } catch (error) {
      setMessage(error.message || 'Could not update repair status.');
    } finally {
      setSavingWorkOrderId('');
    }
  };

  const updateField = async (workOrder, payload) => {
    setSavingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await updateMaintenanceWorkOrder(workOrder.id, payload);
      setMessage('Repair update saved.');
    } catch (error) {
      setMessage(error.message || 'Could not save repair update.');
    } finally {
      setSavingWorkOrderId('');
    }
  };

  const handleUpload = async (workOrder, file) => {
    if (!file) return;

    setUploadingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await uploadWorkspaceFile({
        file,
        category: 'maintenance_photo',
        relatedTable: 'maintenance_work_orders',
        relatedId: workOrder.id,
        propertyId: getWorkOrderPropertyId(workOrder),
      });

      setMessage('Maintenance photo uploaded to private workspace storage.');
    } catch (error) {
      setMessage(error.message || 'Maintenance photo upload failed.');
    } finally {
      setUploadingWorkOrderId('');
    }
  };

  return (
    <AppLayout
      title="Maintenance dashboard"
      subtitle="Assigned repairs, urgent issues, parts, costs, photos, and completion updates"
    >
      <div className="stat-grid dense">
        <StatCard label="Open repairs" value={openJobs.length} icon={Wrench} />
        <StatCard label="Urgent issues" value={urgentJobs.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Waiting for parts" value={waitingPartsJobs.length} icon={Package} />
        <StatCard
          label="Estimated cost"
          value={formatCurrency(totalEstimated, currency)}
          icon={DollarSign}
        />
      </div>

      <section className={`card ${urgentJobs.length ? 'urgent' : ''}`}>
        <div className="card-header">
          <div>
            <h3>Priority repair queue</h3>
            <p>
              Start assigned repairs, update work status, list parts needed, add costs, upload
              repair photos, and mark jobs completed.
            </p>
          </div>
        </div>

        {message && (
          <p className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}>
            {message}
          </p>
        )}
      </section>

      {priorityJobs.length ? (
        <div className="task-grid">
          {priorityJobs.map((workOrder) => (
            <section className={`card task-card ${isOverdue(workOrder) ? 'urgent' : ''}`} key={workOrder.id}>
              <div className="card-header">
                <div>
                  <h3>{workOrder.title || 'Maintenance issue'}</h3>
                  <p>
                    {workOrder.property || 'Assigned property'} · Due {getDueDate(workOrder) || 'not set'}
                  </p>
                </div>
                <StatusBadge>{workOrder.priority || 'medium'}</StatusBadge>
              </div>

              {isOverdue(workOrder) && (
                <div className="helper error-helper">
                  <AlertTriangle size={16} />
                  This repair is overdue.
                </div>
              )}

              <p>{workOrder.description || 'No description added.'}</p>

              <div className="metadata-grid">
                <span>
                  <Wrench size={16} />
                  {formatLabel(workOrder.status)}
                </span>
                <span>
                  <Package size={16} />
                  {getPartsNeeded(workOrder) || 'No parts listed'}
                </span>
                <span>
                  <DollarSign size={16} />
                  Est. {formatCurrency(getEstimatedCost(workOrder), currency)}
                </span>
                <span>
                  <Clock size={16} />
                  Due {getDueDate(workOrder) || 'not set'}
                </span>
              </div>

              <label>
                Status
                <select
                  value={workOrder.status || 'reported'}
                  disabled={savingWorkOrderId === workOrder.id}
                  onChange={(event) => updateStatus(workOrder, event.target.value)}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  Parts/materials needed
                  <input
                    defaultValue={getPartsNeeded(workOrder)}
                    onBlur={(event) =>
                      updateField(workOrder, {
                        parts_needed: event.target.value.trim() || null,
                      })
                    }
                  />
                </label>

                <label>
                  Actual cost
                  <input
                    type="number"
                    min="0"
                    defaultValue={getActualCost(workOrder) || ''}
                    onBlur={(event) =>
                      updateField(workOrder, {
                        actual_cost: cleanNumber(event.target.value),
                      })
                    }
                  />
                </label>

                <label className="full">
                  Repair notes
                  <textarea
                    defaultValue={workOrder.notes || ''}
                    placeholder="Add repair notes, access issues, parts updates, or completion details."
                    onBlur={(event) =>
                      updateField(workOrder, {
                        notes: event.target.value.trim() || null,
                      })
                    }
                  />
                </label>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  onClick={() => updateStatus(workOrder, 'in_progress')}
                  disabled={savingWorkOrderId === workOrder.id || workOrder.status === 'in_progress'}
                >
                  Start repair
                </button>

                <button
                  type="button"
                  onClick={() => updateStatus(workOrder, 'waiting_parts')}
                  disabled={savingWorkOrderId === workOrder.id || workOrder.status === 'waiting_parts'}
                >
                  Waiting for parts
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() => updateStatus(workOrder, 'completed')}
                  disabled={savingWorkOrderId === workOrder.id || workOrder.status === 'completed'}
                >
                  <CheckCircle2 size={16} />
                  Mark completed
                </button>
              </div>

              <label className="upload-button">
                <Camera size={16} />
                {uploadingWorkOrderId === workOrder.id ? 'Uploading…' : 'Upload issue/completion photo'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  disabled={uploadingWorkOrderId === workOrder.id}
                  onChange={(event) => handleUpload(workOrder, event.target.files?.[0])}
                />
              </label>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No assigned maintenance work orders right now."
          description="Assigned repairs, urgent issues, parts, costs, and completion updates will appear here."
        />
      )}

      {overdueJobs.length > 0 && (
        <section className="card urgent">
          <div className="card-header">
            <div>
              <h3>Overdue repairs</h3>
              <p>These assigned repairs are past due and still open.</p>
            </div>
            <AlertTriangle size={20} />
          </div>

          {overdueJobs.slice(0, 5).map((workOrder) => (
            <div className="list-row" key={workOrder.id}>
              <span>
                {workOrder.title}
                <small>{workOrder.property || 'Assigned property'} · due {getDueDate(workOrder)}</small>
              </span>
              <StatusBadge>{workOrder.status || 'reported'}</StatusBadge>
            </div>
          ))}
        </section>
      )}
    </AppLayout>
  );
}
