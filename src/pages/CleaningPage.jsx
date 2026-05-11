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
  ShieldCheck,
  Sparkles,
  X,
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
  'cancelled',
];

const closedStatuses = new Set(['completed', 'guest_ready', 'cancelled']);

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

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

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
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

function getAssignedCleanerId(task) {
  return task.assignedCleanerId || task.assigned_cleaner_id || task.cleanerId || task.cleaner_id || '';
}

function isCleanerRole(currentUser) {
  return Boolean(currentUser?.roles?.includes(roles.CLEANER));
}

function isAssignedToCurrentCleaner(task, currentUser) {
  if (!isCleanerRole(currentUser)) return true;

  const assignedCleanerId = getAssignedCleanerId(task);
  if (!assignedCleanerId) return false;

  return assignedCleanerId === currentUser?.id;
}

function getVisibleCleaningTasks(tasks = [], currentUser) {
  if (!isCleanerRole(currentUser)) return tasks;
  return tasks.filter((task) => isAssignedToCurrentCleaner(task, currentUser));
}

function canUpdateSpecificCleaningTask(currentUser, task) {
  if (closedStatuses.has(task.status)) return false;
  if (hasAnyRole(currentUser, taskManagerRoles)) return true;
  if (!isCleanerRole(currentUser)) return false;
  return isAssignedToCurrentCleaner(task, currentUser);
}

function getTaskPropertyName(task, properties = []) {
  const propertyId = getTaskPropertyId(task);
  const property = properties.find((item) => item.id === propertyId);

  return task.property || property?.name || 'Unassigned property';
}

function getTaskChecklist(task) {
  if (Array.isArray(task.checklist)) return task.checklist;
  if (Array.isArray(task.checklist_items)) return task.checklist_items;

  return [];
}

function getTaskNotes(task) {
  return task.cleanerNotes || task.cleaner_notes || '';
}

function getTaskSuppliesUsed(task) {
  return task.suppliesUsed || task.supplies_used || '';
}

function getMemberName(members = [], userId) {
  if (!userId) return 'Unassigned';
  const member = members.find((item) => (item.user_id || item.userId || item.id) === userId);
  const profile = member?.profile || member?.profiles || {};
  return profile.full_name || profile.name || profile.email || member?.email || member?.user_email || 'Assigned cleaner';
}

function getLinkedBooking(task, bookings = []) {
  const bookingId = task.booking_id || task.bookingId;
  if (!bookingId) return null;
  return bookings.find((booking) => booking.id === bookingId) || null;
}

function canUpdateCleaningTask(currentUser) {
  return hasAnyRole(currentUser, [...taskManagerRoles, roles.CLEANER]);
}

function statusTone(status) {
  if (['missed', 'overdue', 'cancelled'].includes(status)) return 'error';
  if (['scheduled', 'needs_inspection'].includes(status)) return 'warning';
  if (['completed', 'guest_ready'].includes(status)) return 'success';
  return 'info';
}

function matchesSearch(task, properties, query, members = []) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchText = [
    getTaskPropertyName(task, properties),
    getMemberName(members, getAssignedCleanerId(task)),
    getTaskNotes(task),
    getTaskSuppliesUsed(task),
    task.status,
    getTaskChecklist(task).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchText.includes(normalizedQuery);
}

function TaskActionButton({ task, status, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onClick(task, status)}
      disabled={disabled}
      data-skip-create-action="true"
    >
      {label}
    </button>
  );
}

function CleaningTaskCard({
  task,
  properties,
  canUpdate,
  uploading,
  onStatusChange,
  onIssueChange,
  members,
  bookings,
  onNotesSave,
  onSuppliesSave,
  onUpload,
}) {
  const propertyName = getTaskPropertyName(task, properties);
  const checklist = getTaskChecklist(task);
  const notes = getTaskNotes(task);
  const suppliesUsed = getTaskSuppliesUsed(task);
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const status = task.status || 'scheduled';
  const closed = closedStatuses.has(status);
  const cleanerName = getMemberName(members, getAssignedCleanerId(task));
  const linkedBooking = getLinkedBooking(task, bookings);

  return (
    <article className={`card cleaning-task-card ${overdue ? 'urgent' : ''}`}>
      <div className="cleaning-task-top">
        <div>
          <p className="eyebrow">{closed ? 'Closed cleaning' : overdue ? 'Overdue cleaning' : dueToday ? 'Due today' : 'Cleaning task'}</p>
          <h3>{propertyName}</h3>
          <p>{formatDateTime(task.scheduledFor || task.scheduled_for)}</p>
          <small>Cleaner: {cleanerName}</small>
        </div>

        <StatusBadge tone={overdue ? 'error' : statusTone(status)}>{overdue ? 'overdue' : status}</StatusBadge>
      </div>

      {closed && (
        <div className="helper">
          <ShieldCheck size={16} />
          This cleaning is closed. Status, notes, issue reporting, and upload controls are read-only here.
        </div>
      )}

      <div className="cleaning-task-meta">
        <span>
          <Clock size={16} />
          <strong>{formatDateTime(task.started_at) || '—'}</strong>
          <small>Started</small>
        </span>

        <span>
          <CheckCircle2 size={16} />
          <strong>{formatDateTime(task.completed_at) || '—'}</strong>
          <small>Completed</small>
        </span>

        <span>
          <AlertTriangle size={16} />
          <strong>{task.issue_reported ? 'Yes' : 'No'}</strong>
          <small>Issue reported</small>
        </span>
      </div>

      <div className="cleaning-task-section">
        <h4>Checklist</h4>

        {checklist.length ? (
          <ul className="checklist cleaning-checklist">
            {checklist.map((item) => (
              <li key={item}>
                <CheckCircle2 size={15} />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p>No checklist items saved.</p>
        )}
      </div>

      {linkedBooking && (
        <div className="cleaning-task-section">
          <h4>Related booking</h4>
          <p>{linkedBooking.guest_name || linkedBooking.guestName || 'Guest booking'} · checkout {linkedBooking.check_out || linkedBooking.checkOut || 'not set'}</p>
        </div>
      )}

      <label className="cleaning-notes-field">
        Supplies used / low supplies
        <textarea
          defaultValue={suppliesUsed}
          rows={2}
          disabled={!canUpdate || closed}
          onBlur={(event) => {
            if (event.target.value !== suppliesUsed) {
              onSuppliesSave(task, event.target.value);
            }
          }}
        />
      </label>

      <label className="cleaning-notes-field">
        Cleaner notes
        <textarea
          defaultValue={notes}
          rows={3}
          disabled={!canUpdate || closed}
          onBlur={(event) => {
            if (event.target.value !== notes) {
              onNotesSave(task, event.target.value);
            }
          }}
        />
      </label>

      <div className="cleaning-card-actions">
        {canUpdate && !closed && (
          <>
            {status !== 'in_progress' && (
              <TaskActionButton
                task={task}
                status="in_progress"
                label="Start cleaning"
                onClick={onStatusChange}
              />
            )}

            <TaskActionButton
              task={task}
              status="needs_inspection"
              label="Needs inspection"
              onClick={onStatusChange}
            />

            {status !== 'guest_ready' && (
              <TaskActionButton
                task={task}
                status="guest_ready"
                label="Mark guest-ready"
                onClick={onStatusChange}
              />
            )}

            <button
              type="button"
              onClick={() => onIssueChange(task, !task.issue_reported)}
              data-skip-create-action="true"
            >
              {task.issue_reported ? 'Clear issue' : 'Report issue'}
            </button>

            <label className="upload-button">
              <Camera size={16} />
              {uploading ? 'Uploading…' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  onUpload(task, file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </>
        )}
      </div>
    </article>
  );
}

export function CleaningPage() {
  const {
    data,
    updateCleaningTask,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const [message, setMessage] = React.useState('');
  const [uploadingTaskId, setUploadingTaskId] = React.useState('');
  const [updatingTaskId, setUpdatingTaskId] = React.useState('');
  const [filters, setFilters] = React.useState({
    query: '',
    property: 'all',
    status: 'all',
    view: 'open',
  });

  const properties = data.properties || [];
  const members = data.members || [];
  const bookings = data.bookings || [];
  const allTasks = data.cleaningTasks || [];
  const tasks = getVisibleCleaningTasks(allTasks, currentUser);
  const cleanerView = isCleanerRole(currentUser);
  const visiblePropertyIds = new Set(tasks.map((task) => getTaskPropertyId(task)).filter(Boolean));
  const activeProperties = properties.filter(
    (property) => property.status !== 'archived' && (!cleanerView || visiblePropertyIds.has(property.id)),
  );

  const canCreate = hasAnyRole(currentUser, taskManagerRoles);

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const changeStatus = async (task, status) => {
    if (!canUpdateSpecificCleaningTask(currentUser, task)) {
      setMessage('You do not have permission to update this cleaning task, or this cleaning is already closed.');
      return;
    }

    setUpdatingTaskId(task.id);
    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        status,
        started_at: status === 'in_progress' ? new Date().toISOString() : task.started_at,
        completed_at: closedStatuses.has(status) ? new Date().toISOString() : task.completed_at,
      });

      setMessage(`Cleaning task marked ${formatLabel(status)}.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not update cleaning task.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const updateNotes = async (task, notes) => {
    if (!canUpdateSpecificCleaningTask(currentUser, task)) {
      setMessage('You do not have permission to update notes for this cleaning task, or this cleaning is already closed.');
      return;
    }

    setUpdatingTaskId(task.id);

    try {
      await updateCleaningTask(task.id, {
        cleaner_notes: notes.trim() || null,
      });

      setMessage('Cleaner notes saved.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not save cleaner notes.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const updateSupplies = async (task, suppliesUsed) => {
    if (!canUpdateSpecificCleaningTask(currentUser, task)) {
      setMessage('You do not have permission to update supplies for this cleaning task, or this cleaning is already closed.');
      return;
    }

    setUpdatingTaskId(task.id);

    try {
      await updateCleaningTask(task.id, {
        supplies_used: suppliesUsed.trim() || null,
        low_supplies_reported: Boolean(suppliesUsed.trim()),
      });

      setMessage('Supplies used saved.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not save supplies used.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const updateIssueReported = async (task, issueReported) => {
    if (!canUpdateSpecificCleaningTask(currentUser, task)) {
      setMessage('You do not have permission to update issue status for this cleaning task, or this cleaning is already closed.');
      return;
    }

    setUpdatingTaskId(task.id);
    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        issue_reported: issueReported,
      });

      setMessage(issueReported ? 'Issue reported on cleaning task.' : 'Issue report cleared.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Could not update issue status.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const handleUpload = async (task, file) => {
    if (!file) return;

    if (!canUpdateSpecificCleaningTask(currentUser, task)) {
      setMessage('You do not have permission to upload cleaning photos for this task, or this cleaning is already closed.');
      return;
    }

    setUploadingTaskId(task.id);
    setMessage('');

    try {
      await uploadWorkspaceFile({
        file,
        category: 'cleaning_before_photo',
        relatedTable: 'cleaning_tasks',
        relatedId: task.id,
        propertyId: getTaskPropertyId(task),
      });

      setMessage('Cleaning photo uploaded to private workspace storage.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Cleaning photo upload failed.');
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
      if (filters.view === 'issues') return Boolean(task.issue_reported);
      return true;
    })
    .filter((task) => matchesSearch(task, properties, filters.query, members));

  const openTasks = tasks.filter((task) => !closedStatuses.has(task.status));
  const todayTasks = tasks.filter(isDueToday);
  const overdueTasks = tasks.filter(isOverdue);
  const issueTasks = tasks.filter((task) => task.issue_reported);
  const guestReadyTasks = tasks.filter((task) => task.status === 'guest_ready');

  return (
    <AppLayout
      title="Cleaning"
      subtitle={cleanerView
        ? 'Assigned cleanings, checklist progress, issue reports, private photo uploads, and guest-ready confirmations.'
        : 'Schedule, track, inspect, and confirm guest-ready cleanings across assigned properties.'}
    >
      {message && (
        <section
          className={message.toLowerCase().includes('could not') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('permission') ? 'helper error-helper' : 'helper'}
          role="status"
        >
          {message}
        </section>
      )}

      {cleanerView && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Cleaner visibility</p>
              <h3>Only assigned cleaning tasks are shown</h3>
              <p>
                Cleaner users only see cleaning tasks explicitly assigned to their user account. Unassigned cleaning tasks stay hidden until a workspace owner or property manager assigns them.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Open cleanings" value={openTasks.length} icon={ClipboardCheck} />
        <StatCard label="Due today" value={todayTasks.length} icon={Clock} />
        <StatCard label="Overdue" value={overdueTasks.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Guest-ready" value={guestReadyTasks.length} icon={CheckCircle2} />
      </section>

      <section className="card cleaning-toolbar">
        <div>
          <h3>{cleanerView ? 'Assigned cleaning work' : 'Cleaning operations'}</h3>
          <p>
            Track turnover tasks, checklist progress, issue reports, private photo uploads, and
            guest-ready confirmations. Completed and guest-ready cleaning records stay read-only.
          </p>
        </div>

        <div className="cleaning-toolbar-actions">
          {canCreate && (
            <button type="button" className="primary" data-create-action="cleaning">
              <Plus size={16} />
              Add Cleaning Task
            </button>
          )}

          <button type="button" onClick={() => setFilters((current) => ({ ...current, view: 'today' }))} data-skip-create-action="true">
            Today’s Cleanings
          </button>
        </div>
      </section>

      <section className="card">
        <div className="cleaning-filters">
          <label className="cleaning-search">
            <Search size={16} />
            <input
              placeholder="Search property, notes, checklist, supplies, or status..."
              value={filters.query}
              onChange={setFilter('query')}
              aria-label="Search cleaning tasks"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear cleaning search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Property
            <select value={filters.property} onChange={setFilter('property')}>
              <option value="all">All visible properties</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            View
            <select value={filters.view} onChange={setFilter('view')}>
              <option value="open">Open tasks</option>
              <option value="today">Due today</option>
              <option value="overdue">Overdue</option>
              <option value="issues">Issues reported</option>
              <option value="all">All visible tasks</option>
            </select>
          </label>
        </div>
      </section>

      {!tasks.length ? (
        <EmptyState
          eyebrow="Cleaning"
          icon={Sparkles}
          title={cleanerView ? 'No assigned cleaning tasks right now' : 'No cleaning tasks yet'}
          description={cleanerView
            ? 'Assigned cleaning tasks will appear here after a workspace owner or property manager assigns work to your cleaner account.'
            : 'Create the first cleaning task after adding a property or booking. Cleaning tasks should be tied to real workspace properties.'}
          action={
            canCreate ? (
              <button type="button" className="primary" data-create-action="cleaning">
                <Plus size={16} />
                Add Cleaning Task
              </button>
            ) : null
          }
          secondaryAction={
            <button type="button" onClick={() => setFilters((current) => ({ ...current, view: 'all' }))} data-skip-create-action="true">
              View all visible
            </button>
          }
        />
      ) : filteredTasks.length ? (
        <section className="cleaning-task-grid">
          {filteredTasks.map((task) => (
            <CleaningTaskCard
              key={task.id}
              task={task}
              properties={properties}
              members={members}
              bookings={bookings}
              canUpdate={canUpdateSpecificCleaningTask(currentUser, task)}
              uploading={uploadingTaskId === task.id}
              updating={updatingTaskId === task.id}
              onStatusChange={changeStatus}
              onIssueChange={updateIssueReported}
              onNotesSave={updateNotes}
              onSuppliesSave={updateSupplies}
              onUpload={handleUpload}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="Cleaning filters"
          icon={ClipboardCheck}
          title="No cleaning tasks match your filters"
          description="Adjust the search, property, status, or view filter to find visible cleaning tasks."
          action={
            <button
              type="button"
              onClick={() =>
                setFilters({
                  query: '',
                  property: 'all',
                  status: 'all',
                  view: 'open',
                })
              }
              data-skip-create-action="true"
            >
              Clear filters
            </button>
          }
        />
      )}

      <section className="panel-grid two">
        <div className="card">
          <div className="card-header">
            <div>
              <h3>{cleanerView ? 'Assigned properties with active cleaning' : 'Properties with active cleaning'}</h3>
              <p>Quick view of properties that currently have open visible cleaning tasks.</p>
            </div>
            <Home size={20} className="muted" />
          </div>

          {openTasks.length ? (
            openTasks.slice(0, 6).map((task) => (
              <div className="list-row" key={`open-${task.id}`}>
                <span>
                  <strong>{getTaskPropertyName(task, properties)}</strong>
                  <small>{formatDateTime(task.scheduledFor || task.scheduled_for)}</small>
                </span>
                <StatusBadge tone={statusTone(task.status)}>{task.status || 'scheduled'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="No active cleaning"
              description="Open visible cleaning tasks will appear here."
            />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3>Issue reports</h3>
              <p>Visible cleaning tasks where the cleaner reported a property issue.</p>
            </div>
            <AlertTriangle size={20} className="muted" />
          </div>

          {issueTasks.length ? (
            issueTasks.slice(0, 6).map((task) => (
              <div className="list-row" key={`issue-${task.id}`}>
                <span>
                  <strong>{getTaskPropertyName(task, properties)}</strong>
                  <small>{getTaskNotes(task) || 'Issue reported during cleaning.'}</small>
                </span>
                <StatusBadge tone="warning">issue reported</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="No cleaning issues"
              description="Reported cleaning issues will appear here."
            />
          )}
        </div>
      </section>
    </AppLayout>
  );
}
