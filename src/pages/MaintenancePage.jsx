import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { hasAnyRole } from '../lib/auth.js';
import { roles, taskManagerRoles } from '../data/constants.js';

const priorities = ['low', 'medium', 'high', 'urgent'];
const statuses = ['reported', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];
const closedStatuses = new Set(['completed', 'cancelled']);

const initialForm = {
  property_id: '',
  title: '',
  description: '',
  priority: 'medium',
  status: 'reported',
  estimated_cost: '',
  actual_cost: '',
  parts_needed: '',
  due_date: '',
  notes: '',
};

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatLabel(value) {
  return value ? value.replaceAll('_', ' ') : '—';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getWorkOrderPropertyId(workOrder) {
  return workOrder.propertyId || workOrder.property_id;
}

function getWorkOrderDueDate(workOrder) {
  return workOrder.due || workOrder.due_date || '';
}

function isOverdue(workOrder) {
  const dueDate = getWorkOrderDueDate(workOrder);
  return Boolean(dueDate && dueDate < today() && !closedStatuses.has(workOrder.status));
}

function canManageWorkOrders(currentUser) {
  return hasAnyRole(currentUser, taskManagerRoles);
}

function canUpdateWorkOrders(currentUser) {
  return hasAnyRole(currentUser, [...taskManagerRoles, roles.MAINTENANCE]);
}

export function MaintenancePage() {
  const {
    data,
    currentWorkspace,
    createMaintenanceWorkOrder,
    updateMaintenanceWorkOrder,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const [showForm, setShowForm] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploadingWorkOrderId, setUploadingWorkOrderId] = React.useState('');
  const [form, setForm] = React.useState(initialForm);
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
  const waitingParts = workOrders.filter((workOrder) => workOrder.status === 'waiting_parts');
  const overdue = workOrders.filter(isOverdue);

  const totalEstimated = workOrders.reduce(
    (total, workOrder) => total + Number(workOrder.estimatedCost || workOrder.estimated_cost || 0),
    0,
  );

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.property_id) {
      setMessage('Select a property before creating a work order.');
      return;
    }

    if (!form.title.trim()) {
      setMessage('Enter a work order title.');
      return;
    }

    if (!form.description.trim()) {
      setMessage('Enter a work order description.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await createMaintenanceWorkOrder({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        estimated_cost: cleanNumber(form.estimated_cost),
        actual_cost: cleanNumber(form.actual_cost),
        parts_needed: form.parts_needed.trim() || null,
        notes: form.notes.trim() || null,
        due_date: form.due_date || null,
      });

      setForm(initialForm);
      setShowForm(false);
      setMessage('Maintenance work order created.');
    } catch (error) {
      setMessage(error.message || 'Could not create maintenance work order.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (workOrder, status) => {
    if (!canUpdate) {
      setMessage('You do not have permission to update work orders.');
      return;
    }

    setMessage('');

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : workOrder.completed_at,
      });

      setMessage(`Work order marked ${formatLabel(status)}.`);
    } catch (error) {
      setMessage(error.message || 'Could not update work order status.');
    }
  };

  const updateActualCost = async (workOrder, value) => {
    if (!canUpdate) return;

    try {
      await updateMaintenanceWorkOrder(workOrder.id, {
        actual_cost: cleanNumber(value),
      });
    } catch (error) {
      setMessage(error.message || 'Could not update actual cost.');
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
    } catch (error) {
      setMessage(error.message || 'Maintenance file upload failed.');
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
      if (filters.status === 'all') return true;
      return workOrder.status === filters.status;
    })
    .filter((workOrder) => {
      const searchText = [
        workOrder.title,
        workOrder.description,
        workOrder.property,
        workOrder.priority,
        workOrder.status,
        workOrder.partsNeeded,
        workOrder.parts_needed,
        workOrder.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(filters.query.toLowerCase());
    });

  return (
    <AppLayout title="Maintenance work orders" subtitle="Track repairs, urgent issues, parts, costs, and completion">
      <div className="stat-grid dense">
        <StatCard label="Open work orders" value={openWorkOrders.length} icon={Wrench} />
        <StatCard label="Urgent issues" value={urgent.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Waiting for parts" value={waitingParts.length} icon={Package} />
        <StatCard label="Estimated cost" value={formatCurrency(totalEstimated, currency)} icon={DollarSign} />
      </div>

      <section className={`card ${urgent.length ? 'urgent' : ''}`}>
        <div className="card-header">
          <div>
            <h3>Urgent issues</h3>
            <p>Urgent open work orders appear here for operational triage.</p>
          </div>

          {canCreate && (
            <button className="primary" type="button" onClick={() => setShowForm((value) => !value)}>
              <Plus size={16} />
              {showForm ? 'Close form' : 'Create work order'}
            </button>
          )}
        </div>

        {message && (
          <p className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}>
            {message}
          </p>
        )}

        {urgent.length ? (
          urgent.slice(0, 5).map((workOrder) => (
            <div className="list-row" key={workOrder.id}>
              <AlertTriangle size={18} />
              <span>
                {workOrder.title}
                <small>
                  {workOrder.property || 'Unassigned property'} · {workOrder.notes || workOrder.description || 'No notes'}
                </small>
              </span>
              <StatusBadge>{workOrder.priority}</StatusBadge>
            </div>
          ))
        ) : (
          <p>No urgent maintenance alerts.</p>
        )}
      </section>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="card-header">
            <div>
              <h3>Create work order</h3>
              <p>Record a maintenance issue, assign urgency, track parts, and estimate repair costs.</p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Property
              <select value={form.property_id} onChange={set('property_id')} required>
                <option value="">Select property</option>
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Title
              <input value={form.title} onChange={set('title')} required />
            </label>

            <label className="full">
              Description
              <textarea value={form.description} onChange={set('description')} required />
            </label>

            <label>
              Priority
              <select value={form.priority} onChange={set('priority')}>
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select value={form.status} onChange={set('status')}>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Estimated cost
              <input value={form.estimated_cost} onChange={set('estimated_cost')} type="number" min="0" />
            </label>

            <label>
              Actual cost
              <input value={form.actual_cost} onChange={set('actual_cost')} type="number" min="0" />
            </label>

            <label>
              Parts needed
              <input value={form.parts_needed} onChange={set('parts_needed')} />
            </label>

            <label>
              Due date
              <input value={form.due_date} onChange={set('due_date')} type="date" />
            </label>

            <label className="full">
              Notes
              <textarea value={form.notes} onChange={set('notes')} />
            </label>
          </div>

          <div className="action-row">
            <button className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save work order'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Work order list</h3>
            <p>Filter maintenance issues by property, priority, status, due date, and repair state.</p>
          </div>
        </div>

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search work orders</span>
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search issue, property, parts, notes, or status"
                value={filters.query}
                onChange={setFilter('query')}
              />
            </div>
          </label>

          <select value={filters.property} onChange={setFilter('property')}>
            <option value="all">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>

          <select value={filters.priority} onChange={setFilter('priority')}>
            <option value="all">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>

          <select value={filters.status} onChange={setFilter('status')}>
            <option value="open">Open work orders</option>
            <option value="overdue">Overdue</option>
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
      </section>

      {filteredWorkOrders.length ? (
        <section className="card">
          <DataTable
            rows={filteredWorkOrders}
            columns={[
              {
                key: 'title',
                label: 'Issue',
                render: (row) => (
                  <span>
                    {row.title}
                    <br />
                    <small>{row.description || 'No description'}</small>
                  </span>
                ),
              },
              {
                key: 'property',
                label: 'Property',
                render: (row) => row.property || 'Unassigned property',
              },
              {
                key: 'priority',
                label: 'Priority',
                render: (row) => <StatusBadge>{row.priority}</StatusBadge>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <select
                    value={row.status}
                    disabled={!canUpdate}
                    onChange={(event) => updateStatus(row, event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                ),
              },
              {
                key: 'partsNeeded',
                label: 'Parts needed',
                render: (row) => (
                  <span>
                    <Package size={14} /> {row.partsNeeded || row.parts_needed || '—'}
                  </span>
                ),
              },
              {
                key: 'estimatedCost',
                label: 'Estimated',
                render: (row) =>
                  row.estimatedCost || row.estimated_cost
                    ? formatCurrency(row.estimatedCost || row.estimated_cost, currency)
                    : '—',
              },
              {
                key: 'actualCost',
                label: 'Actual',
                render: (row) => (
                  <input
                    type="number"
                    min="0"
                    defaultValue={row.actualCost || row.actual_cost || ''}
                    disabled={!canUpdate}
                    onBlur={(event) => updateActualCost(row, event.target.value)}
                    aria-label="Actual repair cost"
                  />
                ),
              },
              {
                key: 'due',
                label: 'Due',
                render: (row) => (
                  <span>
                    {getWorkOrderDueDate(row) || '—'}
                    {isOverdue(row) && (
                      <>
                        <br />
                        <small className="trend-warning">Overdue</small>
                      </>
                    )}
                  </span>
                ),
              },
              {
                key: 'upload',
                label: 'Files',
                render: (row) => (
                  <label className="upload-button small">
                    <Camera size={14} />
                    {uploadingWorkOrderId === row.id ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      disabled={!canUpdate || uploadingWorkOrderId === row.id}
                      onChange={(event) => handleUpload(row, event.target.files?.[0])}
                    />
                  </label>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title="No maintenance work orders found."
          description={
            workOrders.length
              ? 'No work orders match the current filters.'
              : 'Create a work order when a repair or issue needs attention.'
          }
          action={
            canCreate ? (
              <button className="primary" type="button" onClick={() => setShowForm(true)}>
                Create work order
              </button>
            ) : null
          }
        />
      )}

      {overdue.length > 0 && (
        <section className="card urgent">
          <div className="card-header">
            <div>
              <h3>Overdue repairs</h3>
              <p>These work orders are past the due date and still open.</p>
            </div>
            <Clock size={20} />
          </div>

          {overdue.slice(0, 5).map((workOrder) => (
            <div className="list-row" key={workOrder.id}>
              <span>
                {workOrder.title}
                <small>{workOrder.property || 'Unassigned property'} · due {getWorkOrderDueDate(workOrder)}</small>
              </span>
              <StatusBadge>{workOrder.status}</StatusBadge>
            </div>
          ))}
        </section>
      )}

      {openWorkOrders.length === 0 && workOrders.length > 0 && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Maintenance is clear</h3>
              <p>All current work orders are completed or cancelled.</p>
            </div>
            <CheckCircle2 size={20} />
          </div>
        </section>
      )}
    </AppLayout>
  );
}
