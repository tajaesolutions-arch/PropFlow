import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { roles } from '../data/constants.js';

const statuses = ['reported', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const closedStatuses = new Set(['completed', 'cancelled']);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '—';
}

function getWorkOrderPropertyId(workOrder) {
  return workOrder.propertyId || workOrder.property_id;
}

function getAssignedMaintenanceId(workOrder) {
  return (
    workOrder.assignedMaintenanceId ||
    workOrder.assigned_maintenance_id ||
    workOrder.maintenanceId ||
    workOrder.maintenance_id ||
    ''
  );
}

function isMaintenanceUser(currentUser) {
  return Boolean(currentUser?.roles?.includes(roles.MAINTENANCE));
}

function isAssignedToCurrentMaintenance(workOrder, currentUser) {
  const assignedMaintenanceId = getAssignedMaintenanceId(workOrder);
  if (!assignedMaintenanceId) return false;

  return assignedMaintenanceId === currentUser?.id;
}

function canUpdateMaintenanceJob(workOrder, currentUser) {
  if (closedStatuses.has(workOrder.status)) return false;
  if (!isMaintenanceUser(currentUser)) return true;
  return isAssignedToCurrentMaintenance(workOrder, currentUser);
}

function getDueDate(workOrder) {
  return workOrder.due || workOrder.due_date || '';
}

function getDescription(workOrder) {
  return workOrder.description || workOrder.issue_description || workOrder.issueDescription || '';
}

function getPropertyName(workOrder, properties = []) {
  const propertyId = getWorkOrderPropertyId(workOrder);
  const property = properties.find((item) => item.id === propertyId);

  return workOrder.property || property?.name || 'Assigned property';
}

function isOverdue(workOrder) {
  const dueDate = dateOnly(getDueDate(workOrder));
  return Boolean(dueDate && dueDate < today() && !closedStatuses.has(workOrder.status));
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(String(value).replace(/,/g, '').trim());
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
  if (!isMaintenanceUser(currentUser)) return workOrders;
  return workOrders.filter((workOrder) => isAssignedToCurrentMaintenance(workOrder, currentUser));
}

function statusTone(value) {
  const text = String(value || '').toLowerCase();

  if (text === 'urgent' || text === 'overdue' || text === 'cancelled') return 'error';
  if (['reported', 'assigned', 'waiting_parts', 'high'].includes(text)) return 'warning';
  if (text === 'completed') return 'success';

  return 'info';
}

function priorityRank(priority) {
  return {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  }[priority] ?? 4;
}

function matchesSearch(workOrder, properties, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [
    workOrder.title,
    getDescription(workOrder),
    getPropertyName(workOrder, properties),
    workOrder.priority,
    workOrder.status,
    getPartsNeeded(workOrder),
    workOrder.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

function sortMaintenanceJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b)) return 1;

    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    return String(getDueDate(a)).localeCompare(String(getDueDate(b)));
  });
}

function MaintenanceJobCard({
  workOrder,
  properties,
  currency,
  saving,
  uploading,
  onStatusUpdate,
  onFieldUpdate,
  onUpload,
}) {
  const overdue = isOverdue(workOrder);
  const status = workOrder.status || 'reported';
  const priority = workOrder.priority || 'medium';
  const actualCost = getActualCost(workOrder);
  const estimatedCost = getEstimatedCost(workOrder);
  const partsNeeded = getPartsNeeded(workOrder);
  const closed = closedStatuses.has(status);

  return (
    <article className={`card maintenance-dashboard-job-card ${overdue || priority === 'urgent' ? 'urgent' : ''}`}>
      <div className="maintenance-dashboard-job-top">
        <div>
          <p className="eyebrow">
            {closed ? 'Closed repair' : overdue ? 'Overdue repair' : priority === 'urgent' ? 'Urgent issue' : 'Assigned repair'}
          </p>
          <h3>{workOrder.title || 'Maintenance issue'}</h3>
          <p>
            {getPropertyName(workOrder, properties)} · Due {formatDate(getDueDate(workOrder), 'not set')}
          </p>
        </div>

        <div className="maintenance-dashboard-status-stack">
          <StatusBadge tone={priority === 'urgent' ? 'error' : statusTone(priority)}>
            {priority}
          </StatusBadge>

          <StatusBadge tone={overdue ? 'error' : statusTone(status)}>
            {overdue ? 'overdue' : status}
          </StatusBadge>
        </div>
      </div>

      {overdue && (
        <div className="helper error-helper">
          <AlertTriangle size={16} />
          This repair is overdue.
        </div>
      )}

      {closed && (
        <div className="helper">
          <ShieldCheck size={16} />
          This repair is closed. Status, notes, parts, cost, and upload controls are read-only here.
        </div>
      )}

      <p>{getDescription(workOrder) || 'No description added.'}</p>

      <div className="maintenance-dashboard-job-meta">
        <span>
          <Wrench size={16} />
          <strong>{formatLabel(status)}</strong>
          <small>Status</small>
        </span>

        <span>
          <Package size={16} />
          <strong>{partsNeeded || 'No parts listed'}</strong>
          <small>Parts</small>
        </span>

        <span>
          <DollarSign size={16} />
          <strong>{formatCurrency(estimatedCost, currency)}</strong>
          <small>Repair estimate</small>
        </span>

        <span>
          <DollarSign size={16} />
          <strong>{formatCurrency(actualCost, currency)}</strong>
          <small>Repair actual</small>
        </span>
      </div>

      <label>
        Status
        <select
          value={status}
          disabled={saving || closed}
          onChange={(event) => onStatusUpdate(workOrder, event.target.value)}
        >
          {statuses.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {formatLabel(statusOption)}
            </option>
          ))}
        </select>
      </label>

      <div className="form-grid">
        <label>
          Parts/materials needed
          <input
            defaultValue={partsNeeded}
            disabled={saving || closed}
            onBlur={(event) => {
              if (event.target.value !== partsNeeded) {
                onFieldUpdate(workOrder, {
                  parts_needed: event.target.value.trim() || null,
                });
              }
            }}
          />
        </label>

        <label>
          Actual repair cost
          <input
            type="number"
            min="0"
            step="0.01"
            defaultValue={actualCost || ''}
            disabled={saving || closed}
            onBlur={(event) => {
              const nextValue = cleanNumber(event.target.value);
              if (nextValue !== cleanNumber(actualCost)) {
                onFieldUpdate(workOrder, {
                  actual_cost: nextValue,
                });
              }
            }}
          />
        </label>

        <label className="full">
          Repair notes
          <textarea
            defaultValue={workOrder.notes || ''}
            disabled={saving || closed}
            placeholder="Add repair notes, access issues, parts updates, or completion details."
            onBlur={(event) => {
              if (event.target.value !== (workOrder.notes || '')) {
                onFieldUpdate(workOrder, {
                  notes: event.target.value.trim() || null,
                });
              }
            }}
          />
        </label>
      </div>

      {!closed && (
        <div className="maintenance-dashboard-actions">
          {status !== 'in_progress' && (
            <button
              type="button"
              onClick={() => onStatusUpdate(workOrder, 'in_progress')}
              disabled={saving}
              data-skip-create-action="true"
            >
              Start repair
            </button>
          )}

          {status !== 'waiting_parts' && (
            <button
              type="button"
              onClick={() => onStatusUpdate(workOrder, 'waiting_parts')}
              disabled={saving}
              data-skip-create-action="true"
            >
              Waiting for parts
            </button>
          )}

          {status !== 'completed' && (
            <button
              type="button"
              className="primary"
              onClick={() => onStatusUpdate(workOrder, 'completed')}
              disabled={saving}
              data-skip-create-action="true"
            >
              <CheckCircle2 size={16} />
              Mark completed
            </button>
          )}
        </div>
      )}

      <label className="upload-button">
        <Camera size={16} />
        {closed ? 'Upload disabled for closed repair' : uploading ? 'Uploading…' : 'Upload issue/completion photo'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading || closed}
          onChange={(event) => {
            const file = event.target.files?.[0];
            onUpload(workOrder, file);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </article>
  );
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
  const [filters, setFilters] = React.useState({
    query: '',
    status: 'open',
    priority: 'all',
    view: 'priority',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const properties = data.properties || [];
  const allWorkOrders = data.maintenanceWorkOrders || [];
  const visibleWorkOrders = getVisibleMaintenanceJobs(allWorkOrders, currentUser);
  const isMaintenanceCrew = isMaintenanceUser(currentUser);

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

  const totalActual = visibleWorkOrders.reduce(
    (total, workOrder) => total + getActualCost(workOrder),
    0,
  );

  const filteredJobs = sortMaintenanceJobs(
    visibleWorkOrders
      .filter((workOrder) => {
        if (filters.status === 'open') return !closedStatuses.has(workOrder.status);
        if (filters.status === 'all') return true;
        return workOrder.status === filters.status;
      })
      .filter((workOrder) => filters.priority === 'all' || workOrder.priority === filters.priority)
      .filter((workOrder) => {
        if (filters.view === 'priority') return true;
        if (filters.view === 'overdue') return isOverdue(workOrder);
        if (filters.view === 'urgent') return workOrder.priority === 'urgent';
        if (filters.view === 'waiting_parts') return workOrder.status === 'waiting_parts';
        return true;
      })
      .filter((workOrder) => matchesSearch(workOrder, properties, filters.query)),
  );

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const updateStatus = async (workOrder, status) => {
    if (!statuses.includes(status)) {
      setMessage('Select a valid maintenance status.');
      return;
    }

    if (!canUpdateMaintenanceJob(workOrder, currentUser)) {
      setMessage('You do not have permission to update this maintenance work order, or this repair is already closed.');
      return;
    }

    setSavingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : workOrder.completed_at,
      });

      setMessage(`Repair marked ${formatLabel(status)}.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Could not update repair status.');
    } finally {
      setSavingWorkOrderId('');
    }
  };

  const updateField = async (workOrder, payload) => {
    if (!canUpdateMaintenanceJob(workOrder, currentUser)) {
      setMessage('You do not have permission to update this maintenance work order, or this repair is already closed.');
      return;
    }

    setSavingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      if ('actual_cost' in payload && payload.actual_cost !== null && payload.actual_cost < 0) {
        setMessage('Actual repair cost must be 0 or more.');
        return;
      }

      await updateMaintenanceWorkOrder(workOrder.id, payload);
      setMessage('Repair update saved.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Could not save repair update.');
    } finally {
      setSavingWorkOrderId('');
    }
  };

  const handleUpload = async (workOrder, file) => {
    if (!file) return;

    if (!canUpdateMaintenanceJob(workOrder, currentUser)) {
      setMessage('You do not have permission to upload files for this maintenance work order, or this repair is already closed.');
      return;
    }

    setUploadingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await uploadWorkspaceFile({
        file,
        category: 'maintenance_completion_photo',
        maintenanceWorkOrderId: workOrder.id,
        propertyId: getWorkOrderPropertyId(workOrder),
      });

      setMessage('Maintenance photo uploaded to private workspace storage.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Maintenance photo upload failed.');
    } finally {
      setUploadingWorkOrderId('');
    }
  };

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      status: 'open',
      priority: 'all',
      view: 'priority',
    });
  };

  return (
    <AppLayout
      title="Maintenance dashboard"
      subtitle="Assigned repairs, urgent issues, parts, assigned repair costs, photos, and completion updates."
    >
      {message && (
        <section
          className={
            message.toLowerCase().includes('could not') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('permission')
              ? 'helper error-helper'
              : 'helper'
          }
          role="status"
        >
          {message}
        </section>
      )}

      {isMaintenanceCrew && (
        <section className="card maintenance-dashboard-hero">
          <div className="card-header">
            <div>
              <p className="eyebrow">Assignment visibility</p>
              <h3>Only assigned maintenance work orders are shown</h3>
              <p>
                Maintenance users only see work orders explicitly assigned to their user account. Unassigned maintenance work orders stay hidden until a workspace owner or property manager assigns them.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="card maintenance-dashboard-hero">
        <div>
          <p className="eyebrow">Repair cost visibility</p>
          <h3>Maintenance cost fields are work-order only</h3>
          <p>
            Maintenance users can view and update assigned open repair estimates, actual repair costs,
            parts, notes, photos, and statuses. Closed repairs are read-only. This dashboard does not show owner payout, revenue,
            net profit, payroll, or full workspace accounting.
          </p>
        </div>

        <ShieldCheck size={24} className="muted" />
      </section>

      <section className="stat-grid dense">
        <StatCard label="Open repairs" value={openJobs.length} icon={Wrench} />
        <StatCard label="Urgent issues" value={urgentJobs.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Waiting for parts" value={waitingPartsJobs.length} icon={Package} />
        <StatCard label="Assigned estimate" value={formatCurrency(totalEstimated, currency)} icon={DollarSign} />
      </section>

      <section className={`card maintenance-dashboard-hero ${urgentJobs.length ? 'urgent' : ''}`}>
        <div>
          <p className="eyebrow">Maintenance workflow</p>
          <h3>Priority repair queue</h3>
          <p>
            Start assigned repairs, update work status, list parts needed, add repair cost notes,
            upload repair photos, and mark jobs completed. Closed repair records stay read-only.
          </p>
        </div>

        <Wrench size={24} className="muted" />
      </section>

      <section className="card">
        <div className="maintenance-dashboard-filters">
          <label className="maintenance-dashboard-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search repair title, property, parts, notes, priority, or status..."
              aria-label="Search assigned maintenance jobs"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear maintenance search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="open">Open repairs</option>
              <option value="all">All visible repairs</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select value={filters.priority} onChange={setFilter('priority')}>
              <option value="all">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </label>

          <label>
            View
            <select value={filters.view} onChange={setFilter('view')}>
              <option value="priority">Priority order</option>
              <option value="urgent">Urgent issues</option>
              <option value="overdue">Overdue</option>
              <option value="waiting_parts">Waiting for parts</option>
              <option value="all">All views</option>
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {filteredJobs.length ? (
        <section className="maintenance-dashboard-job-grid">
          {filteredJobs.map((workOrder) => (
            <MaintenanceJobCard
              key={workOrder.id}
              workOrder={workOrder}
              properties={properties}
              currency={currency}
              saving={savingWorkOrderId === workOrder.id}
              uploading={uploadingWorkOrderId === workOrder.id}
              onStatusUpdate={updateStatus}
              onFieldUpdate={updateField}
              onUpload={handleUpload}
            />
          ))}
        </section>
      ) : visibleWorkOrders.length ? (
        <EmptyState
          eyebrow="Maintenance filters"
          icon={Wrench}
          title="No repair jobs match your filters"
          description="Adjust the search, status, priority, or view filter to find assigned maintenance jobs."
          action={
            <button type="button" onClick={clearFilters} data-skip-create-action="true">
              Clear filters
            </button>
          }
        />
      ) : (
        <EmptyState
          eyebrow="Maintenance dashboard"
          icon={Wrench}
          title="No assigned maintenance work orders right now"
          description="Assigned repairs, urgent issues, parts, work-order costs, and completion updates will appear here after a workspace owner or property manager assigns work orders to your account."
        />
      )}

      <section className="panel-grid two">
        <section className={`card ${overdueJobs.length ? 'urgent' : ''}`}>
          <div className="card-header">
            <div>
              <h3>Overdue repairs</h3>
              <p>Assigned repairs past due and still open.</p>
            </div>
            <AlertTriangle size={20} className="muted" />
          </div>

          {overdueJobs.length ? (
            overdueJobs.slice(0, 6).map((workOrder) => (
              <div className="list-row" key={workOrder.id}>
                <span>
                  <strong>{workOrder.title || 'Maintenance issue'}</strong>
                  <small>{getPropertyName(workOrder, properties)} · due {formatDate(getDueDate(workOrder), 'not set')}</small>
                </span>
                <StatusBadge tone="error">{workOrder.status || 'reported'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="No overdue repairs"
              description="Overdue assigned repairs will appear here."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Assigned repair cost summary</h3>
              <p>Estimated and actual repair costs for visible maintenance work orders only.</p>
            </div>
            <DollarSign size={20} className="muted" />
          </div>

          <div className="helper">
            Work-order cost fields are operational repair details. They are not owner payouts,
            revenue, net profit, payroll, or full accounting reports.
          </div>

          <div className="metadata-grid maintenance-dashboard-cost-grid">
            <span>
              <DollarSign size={16} />
              <strong>{formatCurrency(totalEstimated, currency)}</strong>
              <small>Repair estimate</small>
            </span>

            <span>
              <DollarSign size={16} />
              <strong>{formatCurrency(totalActual, currency)}</strong>
              <small>Repair actual</small>
            </span>

            <span>
              <Package size={16} />
              <strong>{waitingPartsJobs.length}</strong>
              <small>Waiting parts</small>
            </span>

            <span>
              <AlertTriangle size={16} />
              <strong>{urgentJobs.length}</strong>
              <small>Urgent jobs</small>
            </span>
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
