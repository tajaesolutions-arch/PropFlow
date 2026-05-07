import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  Package,
  Plus,
  Search,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { hasAnyRole } from '../lib/auth.js';
import { roles, taskManagerRoles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const priorities = ['low', 'medium', 'high', 'urgent'];

const statuses = [
  'reported',
  'assigned',
  'in_progress',
  'waiting_parts',
  'completed',
  'cancelled',
];

const closedStatuses = new Set(['completed', 'cancelled']);

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '—';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function getWorkOrderPropertyId(workOrder) {
  return workOrder.propertyId || workOrder.property_id;
}

function getWorkOrderPropertyName(workOrder, properties = []) {
  const propertyId = getWorkOrderPropertyId(workOrder);
  const property = properties.find((item) => item.id === propertyId);

  return workOrder.property || property?.name || 'Unassigned property';
}

function getWorkOrderDueDate(workOrder) {
  return workOrder.due || workOrder.due_date || '';
}

function getWorkOrderDescription(workOrder) {
  return workOrder.description || workOrder.issue_description || workOrder.issueDescription || '';
}

function getPartsNeeded(workOrder) {
  return workOrder.partsNeeded || workOrder.parts_needed || '';
}

function getEstimatedCost(workOrder) {
  return toNumber(workOrder.estimatedCost ?? workOrder.estimated_cost);
}

function getActualCost(workOrder) {
  return toNumber(workOrder.actualCost ?? workOrder.actual_cost);
}

function isWaitingForParts(workOrder) {
  return ['waiting_parts', 'waiting_for_parts'].includes(String(workOrder.status || '').toLowerCase());
}

function isOverdue(workOrder) {
  const dueDate = dateOnly(getWorkOrderDueDate(workOrder));
  return Boolean(dueDate && dueDate < today() && !closedStatuses.has(workOrder.status));
}

function canManageWorkOrders(currentUser) {
  return hasAnyRole(currentUser, taskManagerRoles);
}

function canUpdateWorkOrders(currentUser) {
  return hasAnyRole(currentUser, [...taskManagerRoles, roles.MAINTENANCE]);
}

function statusTone(value) {
  const text = String(value || '').toLowerCase();

  if (text === 'urgent' || text.includes('overdue') || text.includes('cancelled')) return 'error';
  if (text.includes('waiting') || text.includes('reported') || text.includes('assigned')) return 'warning';
  if (text.includes('completed')) return 'success';

  return 'info';
}

function matchesSearch(workOrder, properties, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  const searchText = [
    workOrder.title,
    getWorkOrderDescription(workOrder),
    getWorkOrderPropertyName(workOrder, properties),
    workOrder.priority,
    workOrder.status,
    getPartsNeeded(workOrder),
    workOrder.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchText.includes(normalizedQuery);
}

function WorkOrderCard({
  workOrder,
  properties,
  currency,
  canUpdate,
  updating,
  uploading,
  onStatusUpdate,
  onActualCostUpdate,
  onUpload,
}) {
  const propertyName = getWorkOrderPropertyName(workOrder, properties);
  const description = getWorkOrderDescription(workOrder);
  const partsNeeded = getPartsNeeded(workOrder);
  const estimatedCost = getEstimatedCost(workOrder);
  const actualCost = getActualCost(workOrder);
  const overdue = isOverdue(workOrder);
  const status = workOrder.status || 'reported';
  const priority = workOrder.priority || 'medium';

  const [actualCostDraft, setActualCostDraft] = React.useState(
    actualCost ? String(actualCost) : '',
  );

  React.useEffect(() => {
    setActualCostDraft(actualCost ? String(actualCost) : '');
  }, [actualCost]);

  return (
    <article className={`card maintenance-work-card ${overdue || priority === 'urgent' ? 'urgent' : ''}`}>
      <div className="maintenance-work-top">
        <div>
          <p className="eyebrow">
            {overdue ? 'Overdue work order' : priority === 'urgent' ? 'Urgent issue' : 'Maintenance'}
          </p>
          <h3>{workOrder.title || 'Maintenance issue'}</h3>
          <p>{propertyName}</p>
        </div>

        <div className="maintenance-status-stack">
          <StatusBadge tone={priority === 'urgent' ? 'error' : statusTone(priority)}>
            {priority}
          </StatusBadge>
          <StatusBadge tone={overdue ? 'error' : statusTone(status)}>
            {overdue ? 'overdue' : status}
          </StatusBadge>
        </div>
      </div>

      <div className="maintenance-work-meta">
        <span>
          <Clock size={16} />
          <strong>{formatDate(getWorkOrderDueDate(workOrder), 'No due date')}</strong>
          <small>Due date</small>
        </span>

        <span>
          <DollarSign size={16} />
          <strong>{formatCurrency(estimatedCost, currency)}</strong>
          <small>Estimated</small>
        </span>

        <span>
          <CheckCircle2 size={16} />
          <strong>{formatCurrency(actualCost, currency)}</strong>
          <small>Actual</small>
        </span>
      </div>

      {description && (
        <div className="maintenance-work-section">
          <h4>Issue description</h4>
          <p>{description}</p>
        </div>
      )}

      {partsNeeded && (
        <div className="maintenance-work-section">
          <h4>Parts / materials needed</h4>
          <p>{partsNeeded}</p>
        </div>
      )}

      {workOrder.notes && (
        <div className="maintenance-work-section">
          <h4>Notes</h4>
          <p>{workOrder.notes}</p>
        </div>
      )}

      {canUpdate && (
        <div className="maintenance-update-panel">
          <label>
            Status
            <select
              value={status}
              disabled={updating}
              onChange={(event) => onStatusUpdate(workOrder, event.target.value)}
            >
              {statuses.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {formatLabel(statusOption)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Actual cost
            <input
              type="number"
              min="0"
              step="0.01"
              value={actualCostDraft}
              disabled={updating}
              onChange={(event) => setActualCostDraft(event.target.value)}
              onBlur={() => onActualCostUpdate(workOrder, actualCostDraft)}
            />
          </label>
        </div>
      )}

      <div className="maintenance-card-actions">
        {canUpdate && status !== 'in_progress' && !closedStatuses.has(status) && (
          <button
            type="button"
            onClick={() => onStatusUpdate(workOrder, 'in_progress')}
            disabled={updating}
            data-skip-create-action="true"
          >
            Start repair
          </button>
        )}

        {canUpdate && !isWaitingForParts(workOrder) && !closedStatuses.has(status) && (
          <button
            type="button"
            onClick={() => onStatusUpdate(workOrder, 'waiting_parts')}
            disabled={updating}
            data-skip-create-action="true"
          >
            Waiting for parts
          </button>
        )}

        {canUpdate && status !== 'completed' && (
          <button
            type="button"
            onClick={() => onStatusUpdate(workOrder, 'completed')}
            disabled={updating}
            data-skip-create-action="true"
          >
            Mark completed
          </button>
        )}

        {canUpdate && (
          <label className="upload-button">
            <Camera size={16} />
            {uploading ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                onUpload(workOrder, file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        )}
      </div>
    </article>
  );
}

export function MaintenancePage() {
  const {
    data,
    currentWorkspace,
    updateMaintenanceWorkOrder,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const [message, setMessage] = React.useState('');
  const [uploadingWorkOrderId, setUploadingWorkOrderId] = React.useState('');
  const [updatingWorkOrderId, setUpdatingWorkOrderId] = React.useState('');
  const [filters, setFilters] = React.useState({
    query: '',
    property: 'all',
    priority: 'all',
    status: 'open',
  });

  const properties = data.properties || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const workOrders = data.maintenanceWorkOrders || [];
  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const canCreate = canManageWorkOrders(currentUser);
  const canUpdate = canUpdateWorkOrders(currentUser);

  const urgent = workOrders.filter(
    (workOrder) => workOrder.priority === 'urgent' && !closedStatuses.has(workOrder.status),
  );

  const openWorkOrders = workOrders.filter((workOrder) => !closedStatuses.has(workOrder.status));
  const waitingParts = workOrders.filter(isWaitingForParts);
  const overdue = workOrders.filter(isOverdue);

  const totalEstimated = workOrders.reduce(
    (total, workOrder) => total + getEstimatedCost(workOrder),
    0,
  );

  const totalActual = workOrders.reduce(
    (total, workOrder) => total + getActualCost(workOrder),
    0,
  );

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const updateStatus = async (workOrder, status) => {
    if (!canUpdate) {
      setMessage('You do not have permission to update work orders.');
      return;
    }

    setUpdatingWorkOrderId(workOrder.id);
    setMessage('');

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : workOrder.completed_at,
      });

      setMessage(`Work order marked ${formatLabel(status)}.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not update work order status.');
    } finally {
      setUpdatingWorkOrderId('');
    }
  };

  const updateActualCost = async (workOrder, value) => {
    if (!canUpdate) return;

    const nextActualCost = cleanNumber(value);
    const currentActualCost = cleanNumber(workOrder.actualCost ?? workOrder.actual_cost);

    if (nextActualCost === currentActualCost) return;

    setUpdatingWorkOrderId(workOrder.id);

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        actual_cost: nextActualCost,
      });

      setMessage('Actual repair cost updated.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not update actual cost.');
    } finally {
      setUpdatingWorkOrderId('');
    }
  };

  const handleUpload = async (workOrder, file) => {
    if (!file) return;

    if (!canUpdate) {
      setMessage('You do not have permission to upload maintenance files.');
      return;
    }

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

      setMessage('Maintenance file uploaded to private workspace storage.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Maintenance file upload failed.');
    } finally {
      setUploadingWorkOrderId('');
    }
  };

  const filteredWorkOrders = workOrders
    .filter((workOrder) => filters.property === 'all' || getWorkOrderPropertyId(workOrder) === filters.property)
    .filter((workOrder) => filters.priority === 'all' || workOrder.priority === filters.priority)
    .filter((workOrder) => {
      if (filters.status === 'open') return !closedStatuses.has(workOrder.status);
      if (filters.status === 'overdue') return isOverdue(workOrder);
      if (filters.status === 'waiting_parts') return isWaitingForParts(workOrder);
      if (filters.status === 'all') return true;

      return workOrder.status === filters.status;
    })
    .filter((workOrder) => matchesSearch(workOrder, properties, filters.query));

  const clearFilters = () => {
    setFilters({
      query: '',
      property: 'all',
      priority: 'all',
      status: 'open',
    });
  };

  return (
    <AppLayout
      title="Maintenance"
      subtitle="Track repairs, urgent issues, work orders, parts, costs, private uploads, and completion status."
    >
      {message && (
        <section
          className={
            message.toLowerCase().includes('could not') || message.toLowerCase().includes('failed')
              ? 'helper error-helper'
              : 'helper'
          }
          role="status"
        >
          {message}
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Open work orders" value={openWorkOrders.length} icon={Wrench} />
        <StatCard label="Urgent issues" value={urgent.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Waiting for parts" value={waitingParts.length} icon={Package} />
        <StatCard label="Estimated cost" value={formatCurrency(totalEstimated, currency)} icon={DollarSign} />
      </section>

      <section className="card maintenance-toolbar">
        <div>
          <h3>Maintenance operations</h3>
          <p>
            Manage reported issues, repair priority, due dates, parts needed, actual cost, and
            completion proof.
          </p>
        </div>

        <div className="maintenance-toolbar-actions">
          {canCreate && (
            <button type="button" className="primary" data-create-action="maintenance">
              <Plus size={16} />
              Add Maintenance Work Order
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, status: 'overdue' }))}
            data-skip-create-action="true"
          >
            View Overdue
          </button>
        </div>
      </section>

      <section className={`card ${urgent.length ? 'urgent' : ''}`}>
        <div className="card-header">
          <div>
            <h3>Urgent issues</h3>
            <p>Urgent open work orders appear here for operational triage.</p>
          </div>

          <StatusBadge tone={urgent.length ? 'error' : 'success'}>
            {urgent.length ? `${urgent.length} urgent` : 'clear'}
          </StatusBadge>
        </div>

        {urgent.length ? (
          urgent.slice(0, 5).map((workOrder) => (
            <div className="list-row" key={workOrder.id}>
              <span>
                <strong>{workOrder.title || 'Maintenance issue'}</strong>
                <small>
                  {getWorkOrderPropertyName(workOrder, properties)} ·{' '}
                  {getWorkOrderDescription(workOrder) || workOrder.notes || 'No notes'}
                </small>
              </span>

              <StatusBadge tone="error">{workOrder.priority}</StatusBadge>
            </div>
          ))
        ) : (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="No urgent maintenance alerts"
            description="Urgent issues will appear here when reported."
          />
        )}
      </section>

      <section className="card">
        <div className="maintenance-filters">
          <label className="maintenance-search">
            <Search size={16} />
            <input
              placeholder="Search title, property, parts, notes, priority, or status..."
              value={filters.query}
              onChange={setFilter('query')}
              aria-label="Search maintenance work orders"
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
            Property
            <select value={filters.property} onChange={setFilter('property')}>
              <option value="all">All properties</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
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
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="open">Open work orders</option>
              <option value="overdue">Overdue</option>
              <option value="waiting_parts">Waiting for parts</option>
              <option value="all">All work orders</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!workOrders.length ? (
        <EmptyState
          eyebrow="Maintenance"
          icon={Wrench}
          title="No maintenance work orders yet"
          description="Create a work order to track property repairs, urgent issues, parts, cost, and completion proof."
          action={
            canCreate ? (
              <button type="button" className="primary" data-create-action="maintenance">
                <Plus size={16} />
                Add Maintenance Work Order
              </button>
            ) : null
          }
        />
      ) : filteredWorkOrders.length ? (
        <section className="maintenance-work-grid">
          {filteredWorkOrders.map((workOrder) => (
            <WorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              properties={properties}
              currency={currency}
              canUpdate={canUpdate}
              updating={updatingWorkOrderId === workOrder.id}
              uploading={uploadingWorkOrderId === workOrder.id}
              onStatusUpdate={updateStatus}
              onActualCostUpdate={updateActualCost}
              onUpload={handleUpload}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="Maintenance filters"
          icon={Wrench}
          title="No work orders match your filters"
          description="Adjust the search, property, priority, or status filter to find maintenance work orders."
          action={
            <button type="button" onClick={clearFilters} data-skip-create-action="true">
              Clear filters
            </button>
          }
        />
      )}

      <section className="panel-grid two">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Maintenance cost summary</h3>
              <p>Track estimated vs. actual repair spend for the workspace.</p>
            </div>
            <DollarSign size={20} className="muted" />
          </div>

          <div className="metadata-grid maintenance-cost-grid">
            <span>
              <DollarSign size={16} />
              <strong>{formatCurrency(totalEstimated, currency)}</strong>
              <small>Estimated</small>
            </span>

            <span>
              <DollarSign size={16} />
              <strong>{formatCurrency(totalActual, currency)}</strong>
              <small>Actual</small>
            </span>

            <span>
              <Clock size={16} />
              <strong>{overdue.length}</strong>
              <small>Overdue</small>
            </span>

            <span>
              <Package size={16} />
              <strong>{waitingParts.length}</strong>
              <small>Waiting parts</small>
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>Compact work order table</h3>
              <p>Fast overview for dispatch and follow-up.</p>
            </div>
          </div>

          <DataTable
            compact
            rows={filteredWorkOrders.slice(0, 6)}
            empty="No work orders available."
            columns={[
              {
                key: 'title',
                label: 'Issue',
                render: (workOrder) => (
                  <span>
                    <strong>{workOrder.title || 'Maintenance issue'}</strong>
                    <small>{getWorkOrderPropertyName(workOrder, properties)}</small>
                  </span>
                ),
              },
              {
                key: 'priority',
                label: 'Priority',
                render: (workOrder) => (
                  <StatusBadge tone={workOrder.priority === 'urgent' ? 'error' : statusTone(workOrder.priority)}>
                    {workOrder.priority || 'medium'}
                  </StatusBadge>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (workOrder) => (
                  <StatusBadge tone={isOverdue(workOrder) ? 'error' : statusTone(workOrder.status)}>
                    {isOverdue(workOrder) ? 'overdue' : workOrder.status || 'reported'}
                  </StatusBadge>
                ),
              },
              {
                key: 'due',
                label: 'Due',
                render: (workOrder) => formatDate(getWorkOrderDueDate(workOrder), '—'),
              },
              {
                key: 'actions',
                label: 'Action',
                render: (workOrder) => (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((current) => ({
                        ...current,
                        query: workOrder.title || '',
                        status: 'all',
                      }));
                    }}
                    data-skip-create-action="true"
                  >
                    <Eye size={16} />
                    View
                  </button>
                ),
              },
            ]}
          />
        </div>
      </section>
    </AppLayout>
  );
}
