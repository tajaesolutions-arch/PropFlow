import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Home,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

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

function getTaskPropertyId(task) {
  return task.propertyId || task.property_id;
}

function getAssignedCleanerId(task) {
  return task.assignedCleanerId || task.assigned_cleaner_id;
}

function getChecklist(task) {
  if (Array.isArray(task.checklist)) return task.checklist;
  if (Array.isArray(task.checklist_items)) return task.checklist_items;
  return [];
}

function getNotes(task) {
  return task.cleanerNotes || task.cleaner_notes || '';
}

function isDueToday(task) {
  return dateOnly(task.scheduledFor || task.scheduled_for) === today();
}

function isOverdue(task) {
  const scheduledDate = dateOnly(task.scheduledFor || task.scheduled_for);
  return Boolean(scheduledDate && scheduledDate < today() && !closedStatuses.has(task.status));
}

function getVisibleCleanerTasks(tasks, currentUser) {
  const isCleaner = currentUser?.roles?.includes(roles.CLEANER);

  if (!isCleaner) {
    return tasks;
  }

  const hasAssignmentData = tasks.some((task) => Boolean(getAssignedCleanerId(task)));

  if (!hasAssignmentData) {
    return tasks;
  }

  return tasks.filter((task) => getAssignedCleanerId(task) === currentUser?.id);
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

  const allTasks = data.cleaningTasks || [];
  const visibleTasks = getVisibleCleanerTasks(allTasks, currentUser);

  const openTasks = visibleTasks.filter((task) => !closedStatuses.has(task.status));
  const dueTodayTasks = visibleTasks.filter(isDueToday);
  const overdueTasks = visibleTasks.filter(isOverdue);
  const guestReadyTasks = visibleTasks.filter((task) => task.status === 'guest_ready');

  const priorityTasks = [...openTasks].sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b)) return 1;
    if (isDueToday(a) && !isDueToday(b)) return -1;
    if (!isDueToday(a) && isDueToday(b)) return 1;
    return String(a.scheduledFor || a.scheduled_for || '').localeCompare(
      String(b.scheduledFor || b.scheduled_for || ''),
    );
  });

  const changeStatus = async (task, status) => {
    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        status,
        started_at: status === 'in_progress' ? new Date().toISOString() : task.started_at,
        completed_at: closedStatuses.has(status) ? new Date().toISOString() : task.completed_at,
      });

      setMessage(`Task marked ${status.replaceAll('_', ' ')}.`);
    } catch (error) {
      setMessage(error.message || 'Could not update cleaning task.');
    }
  };

  const updateNotes = async (task, notes) => {
    try {
      await updateCleaningTask(task.id, {
        cleaner_notes: notes,
      });
    } catch (error) {
      setMessage(error.message || 'Could not save cleaner notes.');
    }
  };

  const reportIssue = async (task, issueReported) => {
    setMessage('');

    try {
      await updateCleaningTask(task.id, {
        issue_reported: issueReported,
      });

      setMessage(issueReported ? 'Issue reported.' : 'Issue report cleared.');
    } catch (error) {
      setMessage(error.message || 'Could not update issue status.');
    }
  };

  const handleUpload = async (task, file) => {
    if (!file) return;

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

  return (
    <AppLayout title="Cleaner dashboard" subtitle="Assigned cleanings, checklist progress, photos, and guest-ready updates">
      <div className="stat-grid dense">
        <StatCard label="Open cleanings" value={openTasks.length} icon={ClipboardCheck} />
        <StatCard label="Due today" value={dueTodayTasks.length} icon={Clock} />
        <StatCard label="Overdue" value={overdueTasks.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Guest-ready" value={guestReadyTasks.length} icon={CheckCircle2} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Today’s cleaning work</h3>
            <p>
              Start assigned cleanings, complete checklist items, upload before/after photos, report
              issues, and confirm when the property is guest-ready.
            </p>
          </div>
        </div>

        {message && (
          <p className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}>
            {message}
          </p>
        )}
      </section>

      {priorityTasks.length ? (
        <div className="task-grid">
          {priorityTasks.map((task) => (
            <section className={`card task-card ${isOverdue(task) ? 'urgent' : ''}`} key={task.id}>
              <div className="card-header">
                <div>
                  <h3>{task.property || 'Assigned property'}</h3>
                  <p>Scheduled {formatDateTime(task.scheduledFor || task.scheduled_for)}</p>
                </div>
                <StatusBadge>{task.status || 'scheduled'}</StatusBadge>
              </div>

              {isOverdue(task) && (
                <div className="helper error-helper">
                  <AlertTriangle size={16} />
                  This cleaning is overdue.
                </div>
              )}

              <ul className="checklist">
                {getChecklist(task).length ? (
                  getChecklist(task).map((item) => (
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

              <label>
                Cleaner notes
                <textarea
                  defaultValue={getNotes(task)}
                  onBlur={(event) => updateNotes(task, event.target.value)}
                  placeholder="Add cleaning notes, missing supplies, access issues, or guest-ready comments."
                />
              </label>

              <div className="action-row">
                <button
                  type="button"
                  onClick={() => changeStatus(task, 'in_progress')}
                  disabled={task.status === 'in_progress'}
                >
                  Start cleaning
                </button>

                <button
                  type="button"
                  onClick={() => changeStatus(task, 'needs_inspection')}
                  disabled={task.status === 'needs_inspection'}
                >
                  Ready for inspection
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() => changeStatus(task, 'guest_ready')}
                  disabled={task.status === 'guest_ready'}
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
                  disabled={uploadingTaskId === task.id}
                  onChange={(event) => handleUpload(task, event.target.files?.[0])}
                />
              </label>

              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={Boolean(task.issue_reported)}
                  onChange={(event) => reportIssue(task, event.target.checked)}
                />
                Report issue at property
              </label>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No assigned cleaning tasks right now."
          description="Assigned cleaning tasks, checklists, photo uploads, and guest-ready updates will appear here."
        />
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Cleaner workflow</h3>
            <p>Use this order for each assigned cleaning.</p>
          </div>
          <Home size={20} />
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
    </AppLayout>
  );
}
