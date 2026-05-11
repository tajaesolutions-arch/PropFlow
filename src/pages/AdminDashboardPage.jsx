import React from 'react';
import {
  AlertTriangle,
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  Lock,
  MessageSquarePlus,
  RefreshCw,
  Shield,
  ShieldAlert,
  UserCog,
  Users,
  X,
} from 'lucide-react';

import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { roles } from '../data/constants.js';
import { canAccessPlatformAdmin } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { appEnvironment } from '../lib/supabase.js';

const sensitiveStatuses = new Set(['suspended', 'restricted', 'denied']);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function numberValue(value) {
  return Number(value || 0).toLocaleString();
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();
  if (['active', 'approved', 'ready', 'configured'].includes(status)) return 'success';
  if (['under_review', 'trialing', 'grace_period', 'warning', 'provider_not_configured'].includes(status)) return 'warning';
  if (['suspended', 'restricted', 'denied', 'past_due', 'unpaid', 'failed', 'critical'].includes(status)) return 'error';
  return 'info';
}

function workspaceName(row) {
  return row?.name || row?.business_name || 'Unnamed workspace';
}

function workspaceStatus(row) {
  return row?.account_status || row?.status || 'active';
}

function planLabel(row) {
  return row?.subscription_plan || row?.plan || '—';
}

function subscriptionStatus(row) {
  return row?.subscription_status || 'no_subscription';
}

function trialGrace(row) {
  const trial = row?.trial_ends_at ? `Trial ${formatDate(row.trial_ends_at)}` : '';
  const grace = row?.grace_period_ends_at ? `Grace ${formatDate(row.grace_period_ends_at)}` : '';
  return [trial, grace].filter(Boolean).join(' · ') || '—';
}

function getHealthValue(report, key) {
  return Number(report?.[key] || 0);
}

function requireReason(label, status) {
  if (!sensitiveStatuses.has(status)) return '';
  return window.prompt(`Enter a required founder/audit reason to ${label}:`)?.trim() || '';
}

function confirmAction(label, detail = '') {
  return window.confirm(`${label}${detail ? `\n\n${detail}` : ''}`);
}

function SetupWarning({ data, isSupabaseConfigured }) {
  if (isSupabaseConfigured && !data.platformAdminError && !data.platformAdminSetupRequired) return null;

  return (
    <section className="card admin-notice-card urgent">
      <div className="card-header">
        <div>
          <p className="eyebrow">Founder admin setup</p>
          <h3>{data.platformAdminSetupRequired ? 'Platform admin migration required' : 'Admin health warning'}</h3>
          <p>
            {data.platformAdminError || (!isSupabaseConfigured ? 'Supabase environment variables are not configured in this app runtime.' : 'Platform admin RPCs are being checked.')}
          </p>
        </div>
        <ShieldAlert size={22} className="muted" />
      </div>
      <div className="helper error-helper">
        Apply <code>supabase/migrations/202605100019_platform_admin_foundation.sql</code> and bootstrap the founder profile with <code>profiles.is_propflow_admin = true</code>. No demo metrics are shown here.
      </div>
    </section>
  );
}

function NoteModal({ target, onClose, onSubmit, busy }) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [severity, setSeverity] = React.useState('info');
  const [noteType, setNoteType] = React.useState(target?.type === 'subscription' ? 'billing' : 'general');

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      workspaceId: target?.workspaceId || null,
      userId: target?.userId || null,
      subscriptionId: target?.subscriptionId || null,
      noteType,
      severity,
      title,
      body,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card admin-modal-card" role="dialog" aria-modal="true" aria-label="Add platform admin note">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Platform admin note</p>
            <h3>Add founder note</h3>
            <p>Internal only. Customers are not notified when platform admin notes are created.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close platform admin note modal" title="Close" data-skip-create-action="true"><X size={18} /></button>
        </div>
        <form className="settings-invite-form" onSubmit={submit}>
          <label>
            Note type
            <input value={noteType} onChange={(event) => setNoteType(event.target.value)} />
          </label>
          <label>
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} />
          </label>
          <label>
            Body
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose} data-skip-create-action="true">Cancel</button>
            <button type="submit" className="primary" disabled={busy || !title.trim()} data-skip-create-action="true">
              {busy ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WorkspaceDetailDrawer({ detail, onClose, onStatus, onNote, busy }) {
  if (!detail) return null;
  const workspace = detail.workspace || {};
  const flags = detail.health_flags || {};
  const notes = detail.recent_admin_notes || [];
  const billingEvents = detail.recent_billing_events || [];

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card admin-detail-drawer" role="dialog" aria-modal="true" aria-label="Workspace platform detail">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Workspace detail</p>
            <h3>{workspace.name || 'Workspace'}</h3>
            <p>{workspace.company_code || 'No code'} · {workspace.country || '—'} · {workspace.default_currency || '—'}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close workspace detail drawer" title="Close" data-skip-create-action="true"><X size={18} /></button>
        </div>

        <div className="admin-detail-grid">
          <div><span>Status</span><StatusBadge tone={statusTone(workspace.account_status)}>{workspace.account_status || workspace.status}</StatusBadge></div>
          <div><span>Review</span><StatusBadge tone={statusTone(workspace.platform_review_status)}>{workspace.platform_review_status}</StatusBadge></div>
          <div><span>Subscription</span><StatusBadge tone={statusTone(detail.subscription?.status)}>{detail.subscription?.status || 'no_subscription'}</StatusBadge></div>
          <div><span>Plan</span><strong>{detail.subscription?.plan || '—'}</strong></div>
        </div>

        <div className="admin-control-grid compact-controls">
          <button type="button" disabled={busy} onClick={() => onStatus(workspace.id, 'under_review')} data-skip-create-action="true">Mark under review</button>
          <button type="button" disabled={busy} onClick={() => onStatus(workspace.id, 'active')} data-skip-create-action="true">Approve / reactivate</button>
          <button type="button" disabled={busy} onClick={() => onStatus(workspace.id, 'restricted')} data-skip-create-action="true">Restrict</button>
          <button type="button" disabled={busy} onClick={() => onStatus(workspace.id, 'suspended')} data-skip-create-action="true">Suspend</button>
          <button type="button" disabled={busy} onClick={() => onNote({ type: 'workspace', workspaceId: workspace.id })} data-skip-create-action="true">Add admin note</button>
        </div>

        <section className="admin-detail-section">
          <h4>Operational summary</h4>
          <div className="admin-detail-grid">
            <div><span>Members</span><strong>{numberValue(detail.member_summary?.total)}</strong></div>
            <div><span>Owner/admins</span><strong>{numberValue(detail.member_summary?.owner_admins)}</strong></div>
            <div><span>Properties</span><strong>{numberValue(detail.property_summary?.total)}</strong></div>
            <div><span>Bookings 30d</span><strong>{numberValue(detail.recent_activity_counts?.bookings_30d)}</strong></div>
            <div><span>Leases 30d</span><strong>{numberValue(detail.recent_activity_counts?.leases_30d)}</strong></div>
            <div><span>Direct requests 30d</span><strong>{numberValue(detail.recent_activity_counts?.direct_booking_requests_30d)}</strong></div>
            <div><span>Files 30d</span><strong>{numberValue(detail.recent_activity_counts?.files_30d)}</strong></div>
            <div><span>Open iCal conflicts</span><strong>{numberValue(detail.calendar_import_status?.open_conflicts)}</strong></div>
          </div>
        </section>

        <section className="admin-detail-section">
          <h4>Health flags</h4>
          <div className="admin-health-list compact-health-list">
            {Object.entries(flags).map(([key, value]) => (
              <div key={key} className="health-row">
                <span>{key.replaceAll('_', ' ')}</span>
                <StatusBadge tone={value ? 'warning' : 'success'}>{value ? 'flagged' : 'ok'}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-detail-section">
          <h4>Recent billing events</h4>
          <DataTable compact rows={billingEvents} empty="No recent billing events." columns={[
            { key: 'event_type', label: 'Event' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
            { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
          ]} />
        </section>

        <section className="admin-detail-section">
          <h4>Admin notes</h4>
          <DataTable compact rows={notes} empty="No admin notes yet." columns={[
            { key: 'title', label: 'Title', render: (row) => <span><strong>{row.title}</strong><small>{row.body || '—'}</small></span> },
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge tone={statusTone(row.severity)}>{row.severity}</StatusBadge> },
            { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
          ]} />
        </section>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const {
    currentUser,
    data,
    isSupabaseConfigured,
    loadPlatformAdminData,
    loadPlatformWorkspaceDetail,
    updatePlatformWorkspaceStatus,
    updatePlatformUserStatus,
    createPlatformAdminNote,
    refreshPlatformHealthReport,
  } = useApp();

  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [noteTarget, setNoteTarget] = React.useState(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const isAdmin = canAccessPlatformAdmin(currentUser) || currentUser?.roles?.includes(roles.ADMIN);
  const overview = data.platformOverview || {};
  const health = data.platformHealthReport || {};
  const workspaces = React.useMemo(() => data.platformWorkspaces || [], [data.platformWorkspaces]);
  const users = React.useMemo(() => data.platformUsers || [], [data.platformUsers]);
  const auditLogs = React.useMemo(() => data.platformAdminAuditLogs || [], [data.platformAdminAuditLogs]);
  const adminNotes = React.useMemo(() => data.platformAdminNotes || [], [data.platformAdminNotes]);
  const subscriptionCounts = overview.subscription_status_counts || {};
  const migrationWarning = data.platformAdminSetupRequired
    ? 'Platform admin RPC migration/setup required'
    : health.admin_rpc_status
      ? ''
      : 'Health RPC pending or unavailable until migrations are applied and schema cache refreshes.';

  React.useEffect(() => {
    if (!isAdmin) return;
    loadPlatformAdminData?.();
  // loadPlatformAdminData is provided by context and intentionally omitted to avoid
  // repeatedly calling admin RPCs after data state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const runAdminAction = async (action, successMessage) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (actionError) {
      setMessage(actionError?.message || 'Platform admin action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleWorkspaceStatus = (workspaceId, status) => {
    const label = `${status} workspace`;
    const reason = requireReason(label, status);
    if (sensitiveStatuses.has(status) && !reason) {
      setMessage('A reason is required for suspend, restrict, or deny actions.');
      return;
    }
    if (!confirmAction(`Confirm ${label}?`, reason ? `Reason: ${reason}` : 'This will be audit logged.')) return;
    runAdminAction(() => updatePlatformWorkspaceStatus(workspaceId, status, reason), `Workspace status updated to ${status}.`);
  };

  const handleUserStatus = (userId, status) => {
    const label = `${status} user`;
    const reason = requireReason(label, status);
    if (sensitiveStatuses.has(status) && !reason) {
      setMessage('A reason is required for user suspension or restriction.');
      return;
    }
    if (!confirmAction(`Confirm ${label}?`, reason ? `Reason: ${reason}` : 'This will be audit logged.')) return;
    runAdminAction(() => updatePlatformUserStatus(userId, status, reason), `User status updated to ${status}.`);
  };

  const viewWorkspace = (workspaceId) => {
    runAdminAction(async () => {
      await loadPlatformWorkspaceDetail(workspaceId);
      setDetailOpen(true);
    }, 'Workspace detail loaded.');
  };

  const submitNote = (payload) => {
    runAdminAction(async () => {
      await createPlatformAdminNote(payload);
      setNoteTarget(null);
    }, 'Admin note saved and audit logged.');
  };

  if (!isAdmin) {
    return (
      <AppLayout title="Platform Admin" subtitle="Founder-only operations center">
        <EmptyState
          eyebrow="Access denied"
          icon={Lock}
          title="PropFlow Admin access required"
          description="Customer workspace roles cannot access platform operations data."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Platform Admin" subtitle="Founder operations, health, customers, billing risk, and audit history">
      <SetupWarning data={data} isSupabaseConfigured={isSupabaseConfigured} />

      <section className="card admin-hero-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Founder control center</p>
            <h3>Platform-wide visibility through admin-only RPCs</h3>
            <p>PropFlow Admin remains platform-only. Workspace Owners, accountants, managers, hosts, cleaners, maintenance, and property owners cannot access this route or these RPCs.</p>
          </div>
          <div className="action-row">
            <button type="button" onClick={() => runAdminAction(loadPlatformAdminData, 'Platform admin data refreshed.')} disabled={busy} data-skip-create-action="true">
              <RefreshCw size={16} /> Refresh
            </button>
            <button type="button" onClick={() => runAdminAction(refreshPlatformHealthReport, 'Health report refreshed.')} disabled={busy} data-skip-create-action="true">
              <Activity size={16} /> Health check
            </button>
          </div>
        </div>
        {message && <div className="helper">{message}</div>}
      </section>

      <section className="stats-grid admin-stats-grid">
        <StatCard label="Total workspaces" value={numberValue(overview.total_workspaces)} icon={Building2} />
        <StatCard label="Active workspaces" value={numberValue(overview.active_workspaces)} icon={CheckCircle2} />
        <StatCard label="Suspended/restricted" value={numberValue(overview.suspended_workspaces)} icon={ShieldAlert} />
        <StatCard label="Total users" value={numberValue(overview.total_users || overview.total_profiles)} icon={Users} />
        <StatCard label="Active users" value={numberValue(overview.active_users)} icon={UserCog} />
        <StatCard label="Suspended users" value={numberValue(overview.suspended_users)} icon={ShieldAlert} />
        <StatCard label="Total properties" value={numberValue(overview.total_properties)} icon={Building2} />
        <StatCard label="Total bookings" value={numberValue(overview.total_bookings)} icon={CalendarClock} />
        <StatCard label="Trialing subscriptions" value={numberValue(overview.trialing_subscriptions)} icon={CreditCard} />
        <StatCard label="Past due/restricted" value={numberValue(Number(overview.past_due_subscriptions || 0) + Number(overview.restricted_subscriptions || 0))} icon={AlertTriangle} />
        <StatCard label="Direct requests" value={numberValue(overview.total_direct_booking_requests)} icon={FileText} />
        <StatCard label="iCal conflicts" value={numberValue(health.open_ical_conflicts)} icon={CalendarClock} />
      </section>

      <section className="admin-two-column">
        <section className="card">
          <div className="card-header"><div><h3>Growth snapshot</h3><p>Real records created in the last 7 and 30 days.</p></div></div>
          <div className="admin-growth-grid">
            {['workspaces', 'users', 'properties', 'bookings'].map((key) => (
              <div key={key} className="growth-row">
                <span>{key}</span>
                <strong>{numberValue(overview.created_last_7_days?.[key])}</strong>
                <small>7d</small>
                <strong>{numberValue(overview.created_last_30_days?.[key])}</strong>
                <small>30d</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><h3>Platform health</h3><p>Safe operational signals from admin RPCs and app-side config.</p></div><Database size={22} className="muted" /></div>
          <div className="admin-health-list">
            <div className="health-row"><span>App environment</span><StatusBadge tone={appEnvironment === 'production' ? 'success' : 'info'}>{appEnvironment}</StatusBadge></div>
            <div className="health-row"><span>Supabase configured</span><StatusBadge tone={isSupabaseConfigured ? 'success' : 'error'}>{isSupabaseConfigured ? 'yes' : 'setup_required'}</StatusBadge></div>
            <div className="health-row"><span>RLS / admin RPC status</span><StatusBadge tone={data.platformAdminSetupRequired ? 'warning' : 'success'}>{data.platformAdminSetupRequired ? 'migration_required' : health.admin_rpc_status || 'ready'}</StatusBadge></div>
            <div className="health-row"><span>Billing endpoints</span><StatusBadge tone="warning">provider_not_configured_stub</StatusBadge></div>
            <div className="health-row"><span>Notification external sends</span><StatusBadge tone="warning">not_live</StatusBadge></div>
            <div className="health-row"><span>Private storage bucket</span><strong>workspace-files</strong></div>
            <div className="health-row"><span>Latest failed iCal sync count</span><strong>{numberValue(getHealthValue(health, 'failed_ical_syncs'))}</strong></div>
            <div className="health-row"><span>Open iCal conflicts</span><strong>{numberValue(getHealthValue(health, 'open_ical_conflicts'))}</strong></div>
            <div className="health-row"><span>Billing restricted workspaces</span><strong>{numberValue(getHealthValue(health, 'billing_restricted_workspaces'))}</strong></div>
            <div className="health-row"><span>Provider_not_configured delivery logs</span><strong>{numberValue(getHealthValue(health, 'provider_not_configured_delivery_logs'))}</strong></div>
            <div className="health-row"><span>Migration/setup warnings</span><StatusBadge tone={migrationWarning ? 'warning' : 'success'}>{migrationWarning || 'none'}</StatusBadge></div>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="card-header"><div><h3>Workspace management</h3><p>Review customers, billing risk, workspace status, usage, and safe founder controls.</p></div></div>
        <DataTable rows={workspaces} empty={{ eyebrow: 'Platform workspaces', title: 'No workspace rows returned', description: 'Apply the admin RPC migration and bootstrap a PropFlow Admin profile to load platform workspaces.' }} columns={[
          { key: 'name', label: 'Workspace', render: (row) => <span><strong>{workspaceName(row)}</strong><small>{row.company_code || row.code || '—'}</small></span> },
          { key: 'country', label: 'Country' },
          { key: 'default_currency', label: 'Currency' },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(workspaceStatus(row))}>{workspaceStatus(row)}</StatusBadge> },
          { key: 'platform_review_status', label: 'Review', render: (row) => <StatusBadge tone={statusTone(row.platform_review_status)}>{row.platform_review_status || 'not_reviewed'}</StatusBadge> },
          { key: 'plan', label: 'Plan', render: planLabel },
          { key: 'subscription_status', label: 'Subscription', render: (row) => <StatusBadge tone={statusTone(subscriptionStatus(row))}>{subscriptionStatus(row)}</StatusBadge> },
          { key: 'trial', label: 'Trial/grace', render: trialGrace },
          { key: 'members', label: 'Members', render: (row) => numberValue(row.member_count) },
          { key: 'properties', label: 'Properties', render: (row) => numberValue(row.property_count) },
          { key: 'bookings', label: 'Bookings', render: (row) => numberValue(row.booking_count) },
          { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at) },
          { key: 'controls', label: 'Controls', render: (row) => <div className="action-row admin-table-actions"><button type="button" onClick={() => viewWorkspace(row.id)} disabled={busy} data-skip-create-action="true">View</button><button type="button" onClick={() => handleWorkspaceStatus(row.id, 'under_review')} disabled={busy} data-skip-create-action="true">Review</button><button type="button" onClick={() => handleWorkspaceStatus(row.id, 'active')} disabled={busy} data-skip-create-action="true">Approve</button><button type="button" onClick={() => handleWorkspaceStatus(row.id, 'restricted')} disabled={busy} data-skip-create-action="true">Restrict</button><button type="button" onClick={() => handleWorkspaceStatus(row.id, 'suspended')} disabled={busy} data-skip-create-action="true">Suspend</button><button type="button" onClick={() => setNoteTarget({ type: 'workspace', workspaceId: row.id })} disabled={busy} data-skip-create-action="true"><MessageSquarePlus size={14} /> Note</button></div> },
        ]} />
      </section>

      <section className="card">
        <div className="card-header"><div><h3>User/account management</h3><p>Safe account status review. Password resets and auth-secret views are intentionally not implemented here.</p></div></div>
        <DataTable rows={users} empty="No platform users returned." columns={[
          { key: 'name', label: 'Name', render: (row) => <span><strong>{row.full_name || row.email || 'PropFlow user'}</strong><small>{row.email || '—'}</small></span> },
          { key: 'account_status', label: 'Account', render: (row) => <StatusBadge tone={statusTone(row.account_status)}>{row.account_status || 'active'}</StatusBadge> },
          { key: 'platform_review_status', label: 'Review', render: (row) => <StatusBadge tone={statusTone(row.platform_review_status)}>{row.platform_review_status || 'not_reviewed'}</StatusBadge> },
          { key: 'is_propflow_admin', label: 'Platform admin', render: (row) => <StatusBadge tone={row.is_propflow_admin ? 'success' : 'info'}>{row.is_propflow_admin ? 'yes' : 'no'}</StatusBadge> },
          { key: 'workspace_count', label: 'Workspaces', render: (row) => numberValue(row.workspace_count) },
          { key: 'role_summary', label: 'Roles', render: (row) => row.role_summary || '—' },
          { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at) },
          { key: 'controls', label: 'Controls', render: (row) => <div className="action-row admin-table-actions"><button type="button" onClick={() => handleUserStatus(row.id, 'active')} disabled={busy} data-skip-create-action="true">Reactivate</button><button type="button" onClick={() => handleUserStatus(row.id, 'restricted')} disabled={busy} data-skip-create-action="true">Restrict</button><button type="button" onClick={() => handleUserStatus(row.id, 'suspended')} disabled={busy} data-skip-create-action="true">Suspend</button><button type="button" onClick={() => setNoteTarget({ type: 'user', userId: row.id })} disabled={busy} data-skip-create-action="true"><MessageSquarePlus size={14} /> Note</button></div> },
        ]} />
      </section>

      <section className="admin-two-column">
        <section className="card">
          <div className="card-header"><div><h3>Subscriptions / billing review</h3><p>Billing risk monitor only. No fake Stripe actions or secret keys are exposed.</p></div><CreditCard size={22} className="muted" /></div>
          <div className="admin-health-list">
            {Object.entries(subscriptionCounts).length ? Object.entries(subscriptionCounts).map(([status, count]) => (
              <div className="health-row" key={status}><span>{status.replaceAll('_', ' ')}</span><StatusBadge tone={statusTone(status)}>{numberValue(count)}</StatusBadge></div>
            )) : <div className="helper">No subscription status counts returned.</div>}
            <div className="health-row"><span>Trialing workspaces</span><strong>{numberValue(overview.trialing_subscriptions)}</strong></div>
            <div className="health-row"><span>Past due / unpaid</span><strong>{numberValue(overview.past_due_subscriptions)}</strong></div>
            <div className="health-row"><span>Restricted</span><strong>{numberValue(overview.restricted_subscriptions)}</strong></div>
            <div className="health-row"><span>Provider-not-configured checkout events</span><strong>{numberValue(health.provider_not_configured_billing_events)}</strong></div>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><h3>System health warnings</h3><p>Recent warning/critical platform audit events.</p></div><AlertTriangle size={22} className="muted" /></div>
          <DataTable compact rows={health.recent_system_warnings || []} empty="No recent platform health warnings." columns={[
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge tone={statusTone(row.severity)}>{row.severity}</StatusBadge> },
            { key: 'action', label: 'Action' },
            { key: 'message', label: 'Message' },
            { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
          ]} />
        </section>
      </section>

      <section className="admin-two-column">
        <section className="card">
          <div className="card-header"><div><h3>Admin audit history</h3><p>Recent founder actions returned by the admin-only overview RPC.</p></div><Shield size={22} className="muted" /></div>
          <DataTable compact rows={auditLogs} empty="No admin audit logs yet." columns={[
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge tone={statusTone(row.severity)}>{row.severity}</StatusBadge> },
            { key: 'action', label: 'Action' },
            { key: 'target_type', label: 'Target' },
            { key: 'message', label: 'Message' },
            { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
          ]} />
        </section>

        <section className="card">
          <div className="card-header"><div><h3>Platform admin notes</h3><p>Internal founder notes. Not visible to customer workspace roles.</p></div><MessageSquarePlus size={22} className="muted" /></div>
          <DataTable compact rows={adminNotes} empty="No platform admin notes yet." columns={[
            { key: 'title', label: 'Note', render: (row) => <span><strong>{row.title}</strong><small>{row.body || row.note_type || '—'}</small></span> },
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge tone={statusTone(row.severity)}>{row.severity}</StatusBadge> },
            { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
          ]} />
        </section>
      </section>

      {noteTarget && <NoteModal target={noteTarget} busy={busy} onClose={() => setNoteTarget(null)} onSubmit={submitNote} />}
      {detailOpen && <WorkspaceDetailDrawer detail={data.platformWorkspaceDetail} busy={busy} onClose={() => setDetailOpen(false)} onStatus={handleWorkspaceStatus} onNote={setNoteTarget} />}
    </AppLayout>
  );
}
