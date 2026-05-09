import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Home,
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
import { roles } from '../data/constants.js';

const statuses = ['scheduled', 'in_progress', 'needs_inspection', 'completed', 'guest_ready', 'missed'];
const closedStatuses = new Set(['completed', 'guest_ready']);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
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

function getTaskPropertyId(task) {
  return task.propertyId || task.property_id;
}

function getAssignedCleanerId(task) {
  return task.assignedCleanerId || task.assigned_cleaner_id || task.cleanerId || task.cleaner_id || '';
}

function isCleanerUser(currentUser) {
  return Boolean(currentUser?.roles?.includes(roles.CLEANER));
}

function isAssignedToCurrentCleaner(task, currentUser) {
  const assignedCleanerId = getAssignedCleanerId(task);
  if (!assignedCleanerId) return false;

  return assignedCleanerId === currentUser?.id;
}

function canUpdateCleanerTask(task, currentUser) {
  if (closedStatuses.has(task.status)) return false;
  if (!isCleanerUser(currentUser)) return true;
  return isAssignedToCurrentCleaner(task, currentUser);
}

function getPropertyName(task, properties = []) {
  const propertyId = getTaskPropertyId(task);
  const property = properties.find((item) => item.id === propertyId);

  return task.property || property?.name || 'Assigned property';
}

function getChecklist(task) {
  if (Array.isArray(task.checklist)) return task.checklist;
  if (Array.isArray(task.checklist_items)) return task.checklist_items;
  return [];
}

function getNotes(task) {
  return task.cleanerNotes || task.cleaner_notes || '';
}

function getSuppliesUsed(task) {
  return task.suppliesUsed || task.supplies_used || '';
}

function isDueToday(task) {
  return dateOnly(task.scheduledFor || task.scheduled_for) === today();
}

function isOverdue(task) {
  const scheduledDate = dateOnly(task.scheduledFor || task.scheduled_for);
  return Boolean(scheduledDate && scheduledDate < today() && !closedStatuses.has(task.status));
}

function statusTone(status) {
  if (['missed', 'overdue'].includes(status)) return 'error';
  if (['scheduled', 'needs_inspection'].includes(status)) return 'warning';
  if (['completed', 'guest_ready'].includes(status)) return 'success';
  return 'info';
}

function getVisibleCleanerTasks(tasks, currentUser) {
  if (!isCleanerUser(currentUser)) return tasks;
  return tasks.filter((task) => isAssignedToCurrentCleaner(task, currentUser));
}

function matchesSearch(task, properties, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  const searchText = [
    getPropertyName(task, properties),
    task.status,
    getNotes(task),
    getSuppliesUsed(task),
    getChecklist(task).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchText.includes(normalizedQuery);
}

function sortCleanerTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b)) return 1;
    if (isDueToday(a) && !isDueToday(b)) return -1;
    if (!isDueToday(a) && isDueToday(b)) return 1;

    return String(a.scheduledFor || a.scheduled_for || '').localeCompare(
      String(b.scheduledFor || b.scheduled_for || ''),
    );
  });
}

function CleanerTaskCard({
  task,
  properties,
  uploading,
  updating,
  onStatusChange,
  onNotesSave,
  onIssueChange,
  onUpload,
}) {
  const status = task.status || 'scheduled';
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const checklist = getChecklist(task);
  const notes = getNotes(task);
  const suppliesUsed = getSuppliesUsed(task);
  const closed = closedStatuses.has(status);

  return (
    <article className={`card cleaner-dashboard-task-card ${overdue ? 'urgent' : ''}`}>
      <div className="cleaner-dashboard-task-top">
        <div>
          <p className="eyebrow">
            {closed ? 'Closed cleaning' : overdue ? 'Overdue cleaning' : dueToday ? 'Due today' : 'Assigned cleaning'}
          </p>
          <h3>{getPropertyName(task, properties)}</h3>
          <p>Scheduled {formatDateTime(task.scheduledFor || task.scheduled_for)}</p>
        </div>

        <StatusBadge tone={overdue ? 'error' : statusTone(status)}>
          {overdue ? 'overdue' : status}
        </StatusBadge>
      </div>

      {overdue && (
        <div className="helper error-helper">
          <AlertTriangle size={16} />
          This cleaning is overdue. Complete or report the issue as soon as possible.
        </div>
      )}

      {closed && (
        <div className="helper">
          <ShieldCheck size={16} />
          This cleaning is closed. Status, notes, issue reporting, and upload controls are read-only here.
        </div>
      )}

      <div className="cleaner-dashboard-task-meta">
        <span>
          <Clock size={16} />
          <strong>{formatDateTime(task.started_at)}</strong>
          <small>Started</small>
        </span>

        <span>
          <CheckCircle2 size={16} />
          <strong>{formatDateTime(task.completed_at)}</strong>
          <small>Completed</small>
        </span>

        <span>
          <AlertTriangle size={16} />
          <strong>{task.issue_reported ? 'Yes' : 'No'}</strong>
          <small>Issue</small>
        </span>
      </div>

      <div className="cleaner-dashboard-section">
        <h4>Checklist</h4>

        <ul className="checklist cleaner-dashboard-checklist">
          {checklist.length ? (
            checklist.map((item) => (
              <li key={item}>
                <CheckCircle2 size={16} />
                {item}
              </li>
            ))
          ) : (
            <li>
              <CheckCircle2 size={16} />
              No checklist added
            </li>
          )}
        </ul>
      </div>

      {suppliesUsed && (
        <div className="cleaner-dashboard-section">
          <h4>Supplies used</h4>
          <p>{suppliesUsed}</p>
        </div>
      )}

      <label className="cleaner-dashboard-notes">
        Cleaner notes
        <textarea
          defaultValue={notes}
          disabled={closed}
          onBlur={(event) => {
            if (event.target.value !== notes) {
              onNotesSave(task, event.target.value);
            }
          }}
          placeholder="Add cleaning notes, missing supplies, access issues, or guest-ready comments."
          rows={3}
        />
      </label>

      {!closed && (
        <div className="cleaner-dashboard-actions">
          {status !== 'in_progress' && (
            <button
              type="button"
              onClick={() => onStatusChange(task, 'in_progress')}
              disabled={updating}
              data-skip-create-action="true"
            >
              Start cleaning
            </button>
          )}

          <button
            type="button"
            onClick={() => onStatusChange(task, 'needs_inspection')}
            disabled={updating || status === 'needs_inspection'}
            data-skip-create-action="true"
          >
            Ready for inspection
          </button>

          {status !== 'guest_ready' && (
            <button
              type="button"
              className="primary"
              onClick={() => onStatusChange(task, 'guest_ready')}
              disabled={updating}
              data-skip-create-action="true"
            >
              Mark guest-ready
            </button>
          )}
        </div>
      )}

      <div className="cleaner-dashboard-secondary-actions">
        <label className="upload-button">
          <Camera size={16} />
          {closed ? 'Upload disabled for closed cleaning' : uploading ? 'Uploading…' : 'Upload before/after photo'}
          <input
            type="file"
            accept="image/*"
            disabled={uploading || closed}
            onChange={(event) => {
              const file = event.target.files?.[0];
              onUpload(task, file);
              event.currentTarget.value = '';
            }}
          />
        </label>

        <label className={closed ? 'inline-check disabled' : 'inline-check'}>
          <input
            type="checkbox"
            checked={Boolean(task.issue_reported)}
            disabled={closed}
            onChange={(event) => onIssueChange(task, event.target.checked)}
          />
          Report issue at property
        </label>
      </div>
    </article>
  );
}

export function CleanerDashboardPage() {
  const {
    data,
    currentUser,
    updateCleaningTask,
    uploadWorkspaceFile,
  } = useApp();

  const [message, setMessage] = React.useState('');
  const [uploadingTaskId, setUploadingTaskId] = React.useState('');
  const [updatingTaskId, setUpdatingTaskId] = React.useState('');
  const [filters, setFilters] = React.useState({
    query: '',
    status: 'open',
    view: 'priority',
  });

  const properties = data.properties || [];
  const allTasks = data.cleaningTasks || [];
  const visibleTasks = getVisibleCleanerTasks(allTasks, currentUser);

  const openTasks = visibleTasks.filter((task) => !closedStatuses.has(task.status));
  const dueTodayTasks = visibleTasks.filter(isDueToday);
  const overdueTasks = visibleTasks.filter(isOverdue);
  const guestReadyTasks = visibleTasks.filter((task) => task.status === 'guest_ready');
  const issueTasks = visibleTasks.filter((task) => task.issue_reported);
  const isCleaner = isCleanerUser(currentUser);

  const filteredTasks = sortCleanerTasks(
    visibleTasks
      .filter((task) => {
        if (filters.status === 'open') return !closedStatuses.has(task.status);
        if (filters.status === 'all') return true;
        return task.status === filters.status;
      })
      .filter((task) => {
        if (filters.view === 'priority') return true;
        if (filters.view === 'today') return isDueToday(task);
        if (filters.view === 'overdue') return isOverdue(task);
        if (filters.view === 'issues') return Boolean(task.issue_reported);
        return true;
      })
      .filter((task) => matchesSearch(task, properties, filters.query)),
  );

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const changeStatus = async (task, status) => {
    if (!canUpdateCleanerTask(task, currentUser)) {
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

      setMessage(`Task marked ${formatLabel(status)}.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Could not update cleaning task.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const updateNotes = async (task, notes) => {
    if (!canUpdateCleanerTask(task, currentUser)) {
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
      setMessage(error.message || 'Could not save cleaner notes.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const reportIssue = async (task, issueReported) => {
    if (!canUpdateCleanerTask(task, currentUser)) {
      setMessage('You do not have permission to report an issue for this cleaning task, or this cleaning is already closed.');
      return;
    }

    setUpdatingTaskId(task.id);
    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        issue_reported: issueReported,
      });

      setMessage(issueReported ? 'Issue reported.' : 'Issue report cleared.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Could not update issue status.');
    } finally {
      setUpdatingTaskId('');
    }
  };

  const handleUpload = async (task, file) => {
    if (!file) return;

    if (!canUpdateCleanerTask(task, currentUser)) {
      setMessage('You do not have permission to upload photos for this cleaning task, or this cleaning is already closed.');
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
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Cleaning photo upload failed.');
    } finally {
      setUploadingTaskId('');
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
      view: 'priority',
    });
  };

  return (
    <AppLayout
      title="Cleaner dashboard"
      subtitle="Assigned cleanings, checklist progress, before/after photos, issue reports, and guest-ready updates."
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

      {isCleaner && (
        <section className="card cleaner-dashboard-hero">
          <div className="card-header">
            <div>
              <p className="eyebrow">Assignment visibility</p>
              <h3>Only assigned cleaning tasks are shown</h3>
              <p>
                Cleaner users only see tasks explicitly assigned to their user account. Unassigned cleaning tasks stay hidden until a workspace owner or property manager assigns them.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Open cleanings" value={openTasks.length} icon={ClipboardCheck} />
        <StatCard label="Due today" value={dueTodayTasks.length} icon={Clock} />
        <StatCard label="Overdue" value={overdueTasks.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Guest-ready" value={guestReadyTasks.length} icon={CheckCircle2} />
      </section>

      <section className="card cleaner-dashboard-hero">
        <div>
          <p className="eyebrow">Cleaner workflow</p>
          <h3>Today’s cleaning work</h3>
          <p>
            Start assigned cleanings, follow the checklist, upload before/after photos, report
            issues, and mark the property guest-ready when complete. Closed cleaning records stay read-only.
          </p>
        </div>

        <Sparkles size={24} className="muted" />
      </section>

      <section className="card">
        <div className="cleaner-dashboard-filters">
          <label className="cleaner-dashboard-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search property, checklist, notes, supplies, or status..."
              aria-label="Search assigned cleaning tasks"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear cleaner search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="open">Open tasks</option>
              <option value="all">All visible tasks</option>
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
              <option value="priority">Priority order</option>
              <option value="today">Due today</option>
              <option value="overdue">Overdue</option>
              <option value="issues">Issues reported</option>
              <option value="all">All views</option>
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {filteredTasks.length ? (
        <section className="cleaner-dashboard-task-grid">
          {filteredTasks.map((task) => (
            <CleanerTaskCard
              key={task.id}
              task={task}
              properties={properties}
              uploading={uploadingTaskId === task.id}
              updating={updatingTaskId === task.id}
              onStatusChange={changeStatus}
              onNotesSave={updateNotes}
              onIssueChange={reportIssue}
              onUpload={handleUpload}
            />
          ))}
        </section>
      ) : visibleTasks.length ? (
        <EmptyState
          eyebrow="Cleaner filters"
          icon={ClipboardCheck}
          title="No cleaning tasks match your filters"
          description="Adjust the search, status, or view filter to find assigned cleaning tasks."
          action={
            <button type="button" onClick={clearFilters} data-skip-create-action="true">
              Clear filters
            </button>
          }
        />
      ) : (
        <EmptyState
          eyebrow="Cleaner dashboard"
          icon={ClipboardCheck}
          title="No assigned cleaning tasks right now"
          description="Assigned cleaning tasks, checklists, photo uploads, and guest-ready updates will appear here after a workspace owner or property manager assigns tasks to your account."
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Issue reports</h3>
              <p>Assigned cleaning tasks where an issue has been reported.</p>
            </div>
            <AlertTriangle size={20} className="muted" />
          </div>

          {issueTasks.length ? (
            issueTasks.slice(0, 6).map((task) => (
              <div className="list-row" key={task.id}>
                <span>
                  <strong>{getPropertyName(task, properties)}</strong>
                  <small>{getNotes(task) || 'Issue reported during cleaning.'}</small>
                </span>

                <StatusBadge tone="warning">issue reported</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="No reported cleaning issues"
              description="Issue reports from assigned cleaning tasks will appear here."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Cleaner workflow</h3>
              <p>Use this order for each assigned open cleaning.</p>
            </div>
            <Home size={20} className="muted" />
          </div>

          <ul className="checklist">
            <li>
              <CheckCircle2 size={16} />
              Open the assigned property cleaning task.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Mark the task as in progress when you start.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Complete the checklist and add cleaner notes.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Upload before/after photos.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Report issues or low supplies.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Mark the property guest-ready when complete.
            </li>
          </ul>
        </section>
      </section>
    </AppLayout>
  );
}
