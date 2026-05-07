import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Home,
  Plus,
  Search,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { hasAnyRole } from '../lib/auth.js';
import { roles, taskManagerRoles } from '../data/constants.js';

const statuses = [
  'scheduled',
  'in_progress',
  'completed',
  'missed',
  'needs_inspection',
  'guest_ready',
];

const defaultChecklist = [
  'Strip beds',
  'Clean bathrooms',
  'Restock supplies',
  'Wipe kitchen',
  'Take before/after photos',
  'Confirm guest-ready',
];

const initialForm = {
  property_id: '',
  scheduled_for: '',
  status: 'scheduled',
  checklist_items: defaultChecklist.join(', '),
  cleaner_notes: '',
  supplies_used: '',
};

const closedStatuses = new Set(['completed', 'guest_ready']);

function formatDateTime(value) {
  if (!value) return 'Not scheduled';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isDueToday(task) {
  return dateOnly(task.scheduledFor || task.scheduled_for) === today();
}

function isOverdue(task) {
  const scheduledDate = dateOnly(task.scheduledFor || task.scheduled_for);
  return Boolean(scheduledDate && scheduledDate < today() && !closedStatuses.has(task.status));
}

function getTaskPropertyId(task) {
  return task.propertyId || task.property_id;
}

function getTaskChecklist(task) {
  if (Array.isArray(task.checklist)) return task.checklist;
  if (Array.isArray(task.checklist_items)) return task.checklist_items;
  return [];
}

function getTaskNotes(task) {
  return task.cleanerNotes || task.cleaner_notes || '';
}

function canUpdateCleaningTask(currentUser) {
  return hasAnyRole(currentUser, [...taskManagerRoles, roles.CLEANER]);
}

export function CleaningPage() {
  const {
    data,
    createCleaningTask,
    updateCleaningTask,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const [showForm, setShowForm] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploadingTaskId, setUploadingTaskId] = React.useState('');
  const [filters, setFilters] = React.useState({
    query: '',
    property: 'all',
    status: 'all',
    view: 'open',
  });

  const [form, setForm] = React.useState(initialForm);

  const properties = data.properties || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const tasks = data.cleaningTasks || [];

  const canCreate = hasAnyRole(currentUser, taskManagerRoles);
  const canUpdate = canUpdateCleaningTask(currentUser);

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
      setMessage('Select a property before creating a cleaning task.');
      return;
    }

    if (!form.scheduled_for) {
      setMessage('Choose a scheduled date and time.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await createCleaningTask({
        ...form,
        checklist_items: form.checklist_items
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        cleaner_notes: form.cleaner_notes.trim() || null,
        supplies_used: form.supplies_used.trim() || null,
      });

      setForm(initialForm);
      setShowForm(false);
      setMessage('Cleaning task created.');
    } catch (error) {
      setMessage(error.message || 'Could not create cleaning task.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (task, status) => {
    if (!canUpdate) {
      setMessage('You do not have permission to update cleaning tasks.');
      return;
    }

    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        status,
        started_at: status === 'in_progress' ? new Date().toISOString() : task.started_at,
        completed_at: closedStatuses.has(status) ? new Date().toISOString() : task.completed_at,
      });

      setMessage(`Cleaning task marked ${status.replaceAll('_', ' ')}.`);
    } catch (error) {
      setMessage(error.message || 'Could not update cleaning task.');
    }
  };

  const updateNotes = async (task, notes) => {
    if (!canUpdate) return;

    try {
      await updateCleaningTask(task.id, {
        cleaner_notes: notes,
      });
    } catch (error) {
      setMessage(error.message || 'Could not save cleaner notes.');
    }
  };

  const updateIssueReported = async (task, issueReported) => {
    if (!canUpdate) return;

    try {
      await updateCleaningTask(task.id, {
        issue_reported: issueReported,
      });

      setMessage(issueReported ? 'Issue reported on cleaning task.' : 'Issue report cleared.');
    } catch (error) {
      setMessage(error.message || 'Could not update issue status.');
    }
  };

  const handleUpload = async (task, file) => {
    if (!file) return;

    if (!canUpdate) {
      setMessage('You do not have permission to upload cleaning photos.');
      return;
    }

    setUploadingTaskId(task.id);
    setMessage('');

    try {
      await uploadWorkspaceFile({
        file,
        category: 'cleaning_photo',
        relatedTable: 'cleaning_tasks',
        relatedId: task.id,
        propertyId: getTaskPropertyId(task),
      });

      setMessage('Cleaning photo uploaded to private workspace storage.');
    } catch (error) {
      setMessage(error.message || 'Cleaning photo upload failed.');
    } finally {
      setUploadingTaskId('');
    }
  };

  const filteredTasks = tasks
    .filter((task) => filters.property === 'all' || getTaskPropertyId(task) === filters.property)
    .filter((task) => filters.status === 'all' || task.status === filters.status)
    .filter((task) => {
      if (filters.view === 'open') return !closedStatuses.has(task.status);
      if (filters.view === 'today') return isDueToday(task);
      if (filters.view === 'overdue') return isOverdue(task);
      return true;
    })
    .filter((task) => {
      const searchText = [
        task.property,
        getTaskNotes(task),
        task.status,
        getTaskChecklist(task).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(filters.query.toLowerCase());
    });

  const openTasks = tasks.filter((task) => !closedStatuses.has(task.status));
  const todayTasks = tasks.filter(isDueToday);
  const overdueTasks = tasks.filter(isOverdue);
  const issueTasks = tasks.filter((task) => task.issue_reported);

  return (
    <AppLayout title="Cleaning tasks" subtitle="Schedule, track, and confirm guest-ready cleanings">
      <div className="stat-grid dense">
        <StatCard label="Open cleanings" value={openTasks.length} icon={ClipboardCheck} />
        <StatCard label="Due today" value={todayTasks.length} icon={Clock} />
        <StatCard label="Overdue" value={overdueTasks.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Issues reported" value={issueTasks.length} icon={AlertTriangle} tone="warning" />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Cleaning operations</h3>
            <p>
              Create cleaning tasks, update status, upload before/after photos, report issues, and
              confirm when a property is guest-ready.
            </p>
          </div>

          {canCreate && (
            <button className="primary" type="button" onClick={() => setShowForm((value) => !value)}>
              <Plus size={16} />
              {showForm ? 'Close form' : 'Create cleaning task'}
            </button>
          )}
        </div>

        {message && (
          <p className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}>
            {message}
          </p>
        )}

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search cleaning tasks</span>
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search property, notes, checklist, or status"
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

          <select value={filters.status} onChange={setFilter('status')}>
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <select value={filters.view} onChange={setFilter('view')}>
            <option value="open">Open tasks</option>
            <option value="today">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="all">All tasks</option>
          </select>
        </div>
      </section>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="card-header">
            <div>
              <h3>Create cleaning task</h3>
              <p>Assign a property, schedule the cleaning, and add checklist instructions.</p>
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
              Scheduled for
              <input
                type="datetime-local"
                value={form.scheduled_for}
                onChange={set('scheduled_for')}
                required
              />
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
              Supplies used
              <input value={form.supplies_used} onChange={set('supplies_used')} />
            </label>

            <label className="full">
              Checklist items comma-separated
              <textarea value={form.checklist_items} onChange={set('checklist_items')} />
            </label>

            <label className="full">
              Cleaner notes
              <textarea value={form.cleaner_notes} onChange={set('cleaner_notes')} />
            </label>
          </div>

          <div className="action-row">
            <button className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save task'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {filteredTasks.length ? (
        <div className="task-grid">
          {filteredTasks.map((task) => (
            <section className={`card task-card ${isOverdue(task) ? 'urgent' : ''}`} key={task.id}>
              <div className="card-header">
                <div>
                  <h3>{task.property || 'Unassigned property'}</h3>
                  <p>Scheduled {formatDateTime(task.scheduledFor || task.scheduled_for)}</p>
                </div>
                <StatusBadge>{task.status || 'scheduled'}</StatusBadge>
              </div>

              <ul className="checklist">
                {getTaskChecklist(task).length ? (
                  getTaskChecklist(task).map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} />
                      {item}
                    </li>
                  ))
                ) : (
                  <li>
                    <CheckCircle2 size={16} />
                    No checklist items added
                  </li>
                )}
              </ul>

              <label>
                Notes
                <textarea
                  defaultValue={getTaskNotes(task)}
                  onBlur={(event) => updateNotes(task, event.target.value)}
                  disabled={!canUpdate}
                />
              </label>

              <div className="action-row">
                <button
                  type="button"
                  onClick={() => changeStatus(task, 'in_progress')}
                  disabled={!canUpdate || task.status === 'in_progress'}
                >
                  Start / in progress
                </button>

                <button
                  type="button"
                  onClick={() => changeStatus(task, 'completed')}
                  disabled={!canUpdate || task.status === 'completed'}
                >
                  Mark completed
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() => changeStatus(task, 'guest_ready')}
                  disabled={!canUpdate || task.status === 'guest_ready'}
                >
                  Mark guest-ready
                </button>
              </div>

              <label className="upload-button">
                <Camera size={16} />
                {uploadingTaskId === task.id ? 'Uploading…' : 'Upload before/after photo'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={!canUpdate || uploadingTaskId === task.id}
                  onChange={(event) => handleUpload(task, event.target.files?.[0])}
                />
              </label>

              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={Boolean(task.issue_reported)}
                  disabled={!canUpdate}
                  onChange={(event) => updateIssueReported(task, event.target.checked)}
                />
                Issue reported
              </label>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No cleaning tasks found."
          description={
            tasks.length
              ? 'No cleaning tasks match the current filters.'
              : 'Create a cleaning task or add bookings to schedule cleanings after checkout.'
          }
          action={
            canCreate ? (
              <button className="primary" type="button" onClick={() => setShowForm(true)}>
                Create cleaning task
              </button>
            ) : null
          }
        />
      )}
    </AppLayout>
  );
}
