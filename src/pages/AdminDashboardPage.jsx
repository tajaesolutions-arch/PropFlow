import React from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  Lock,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getWorkspaceStatus(workspace) {
  return workspace.status || workspace.account_status || 'active';
}

function getWorkspacePlan(workspace) {
  return workspace.plan || workspace.subscription_plan || workspace.subscription?.plan || 'starter';
}

function getWorkspaceCurrency(workspace) {
  return workspace.defaultCurrency || workspace.default_currency || 'USD';
}

function getWorkspaceName(workspace) {
  return workspace.name || workspace.business_name || workspace.businessName || 'Unnamed workspace';
}

function getWorkspaceCode(workspace) {
  return workspace.code || workspace.company_code || '—';
}

function getMemberName(member) {
  return (
    member.profile?.full_name ||
    member.profiles?.full_name ||
    member.full_name ||
    member.email ||
    member.profile?.email ||
    member.profiles?.email ||
    member.user_id ||
    'Workspace member'
  );
}

function getMemberEmail(member) {
  return member.profile?.email || member.profiles?.email || member.email || '—';
}

function getMemberRoles(member) {
  if (Array.isArray(member.roles) && member.roles.length) {
    return member.roles.join(', ');
  }

  return '—';
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();

  if (['active', 'ready', 'approved', 'complete', 'connected'].includes(status)) return 'success';
  if (['pending', 'review', 'setup_required', 'warning'].includes(status)) return 'warning';
  if (['suspended', 'restricted', 'blocked', 'failed', 'error'].includes(status)) return 'error';

  return 'info';
}

function platformMetricStatus(value) {
  return value ? 'ready' : 'empty';
}

function getVisibleMemberRows(visibleMembers) {
  return visibleMembers.map((member, index) => ({
    id: member.id || `${member.workspace_id || 'member'}-${member.user_id || index}`,
    ...member,
  }));
}

function AdminNotice() {
  return (
    <section className="card admin-notice-card urgent">
      <div className="card-header">
        <div>
          <h3>Founder admin scope</h3>
          <p>
            This dashboard is for the PropFlow founder/team only. Customers should never receive the
            SaaS-level PropFlow Admin role from customer invite forms.
          </p>
        </div>

        <Shield size={22} className="muted" />
      </div>

      <div className="helper">
        Current MVP note: some tables may only show records visible to the signed-in admin session.
        The next backend task should create secure platform-wide admin metrics using Supabase RLS and
        admin-only RPCs.
      </div>
    </section>
  );
}

export function AdminDashboardPage() {
  const { workspaces, memberships, data, currentUser, isSupabaseConfigured } = useApp();

  const isAdmin = currentUser?.roles?.includes(roles.ADMIN) || currentUser?.isPropFlowAdmin;

  const visibleWorkspaces = workspaces || [];
  const visibleMembers = data.members?.length ? data.members : memberships || [];
  const visibleProperties = data.properties || [];
  const visibleInvites = data.invites || [];
  const visibleBookings = data.bookings || [];
  const visibleCleaning = data.cleaningTasks || [];
  const visibleMaintenance = data.maintenanceWorkOrders || [];
  const visibleReports = data.ownerReports || [];

  const activeWorkspaces = visibleWorkspaces.filter(
    (workspace) => getWorkspaceStatus(workspace) === 'active',
  );

  const suspendedWorkspaces = visibleWorkspaces.filter((workspace) =>
    ['suspended', 'restricted', 'blocked'].includes(getWorkspaceStatus(workspace)),
  );

  const pendingInvites = visibleInvites.filter((invite) => invite.status === 'pending');
  const activeProperties = visibleProperties.filter((property) => property.status !== 'archived');
  const openMaintenance = visibleMaintenance.filter(
    (workOrder) => !['completed', 'cancelled'].includes(workOrder.status),
  );

  const platformHealthItems = [
    {
      id: 'auth',
      title: 'Supabase Auth',
      description: 'Real login, signup, workspace membership, and role routing are enabled.',
      status: isSupabaseConfigured ? 'connected' : 'setup_required',
    },
    {
      id: 'rls',
      title: 'Workspace RLS / data scoping',
      description: 'Customer records should stay protected by workspace_id and role-aware policies.',
      status: 'review',
    },
    {
      id: 'billing',
      title: 'Stripe billing',
      description: 'Billing placeholders exist. Stripe subscription enforcement is still a backend TODO.',
      status: 'pending',
    },
    {
      id: 'notifications',
      title: 'Email / SMS / WhatsApp',
      description: 'Notification pages exist. Resend and Twilio provider wiring is still a production TODO.',
      status: 'pending',
    },
    {
      id: 'uploads',
      title: 'Private file uploads',
      description: 'Private Supabase Storage upload flow is prepared for property, cleaning, and maintenance files.',
      status: 'ready',
    },
    {
      id: 'reports',
      title: 'Reports and exports',
      description: 'CSV preview exists. Backend PDF generation should be wired later.',
      status: visibleReports.length ? 'ready' : 'pending',
    },
  ];

  const approvalQueue = [
    {
      id: 'workspace-review',
      title: 'Workspace signup review',
      description: 'Review new workspaces after signup and suspend suspicious accounts if needed.',
      status: platformMetricStatus(visibleWorkspaces.length),
    },
    {
      id: 'subscription-review',
      title: 'Subscription activation review',
      description: 'Stripe subscription status and grace-period enforcement should be connected next.',
      status: 'pending',
    },
    {
      id: 'property-review',
      title: 'Customer-added property review',
      description: 'Review customer-added property records after platform-wide admin queries are connected.',
      status: platformMetricStatus(visibleProperties.length),
    },
    {
      id: 'team-review',
      title: 'Team invite activity',
      description: 'Review pending invites, accepted users, revoked users, and suspended team members.',
      status: pendingInvites.length ? 'review' : 'empty',
    },
  ];

  if (!isAdmin) {
    return (
      <AppLayout title="PropFlow Admin" subtitle="Founder-only SaaS control center.">
        <EmptyState
          eyebrow="Access restricted"
          icon={Lock}
          title="PropFlow Admin access restricted"
          description="Only the PropFlow founder/admin account should access this platform dashboard."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="PropFlow Admin"
      subtitle="Founder-only SaaS control center for platform metrics, approvals, billing, and account safety."
    >
      <AdminNotice />

      <section className="stat-grid dense">
        <StatCard
          label="Visible workspaces"
          value={visibleWorkspaces.length}
          icon={Building2}
          trend="Admin-scoped records"
        />

        <StatCard
          label="Active workspaces"
          value={activeWorkspaces.length}
          icon={CheckCircle2}
        />

        <StatCard
          label="Suspended / restricted"
          value={suspendedWorkspaces.length}
          icon={AlertTriangle}
          tone={suspendedWorkspaces.length ? 'warning' : 'accent'}
        />

        <StatCard
          label="Visible properties"
          value={activeProperties.length}
          icon={ClipboardList}
        />
      </section>

      <section className="stat-grid dense">
        <StatCard
          label="Visible users / members"
          value={visibleMembers.length}
          icon={Users}
        />

        <StatCard
          label="Pending invites"
          value={pendingInvites.length}
          icon={Users}
          tone={pendingInvites.length ? 'warning' : 'accent'}
        />

        <StatCard
          label="Billing status"
          value="Pending"
          icon={CreditCard}
          trend="Stripe enforcement TODO"
          tone="warning"
        />

        <StatCard
          label="Revenue tracking"
          value="Pending"
          icon={Banknote}
          trend="Connect Stripe metrics next"
          tone="warning"
        />
      </section>

      <section className="admin-metric-grid">
        <article className="card admin-metric-card">
          <div className="admin-metric-icon">
            <Database size={20} />
          </div>
          <span>
            <strong>{visibleBookings.length}</strong>
            <small>Visible bookings</small>
          </span>
        </article>

        <article className="card admin-metric-card">
          <div className="admin-metric-icon">
            <CheckCircle2 size={20} />
          </div>
          <span>
            <strong>{visibleCleaning.length}</strong>
            <small>Visible cleaning tasks</small>
          </span>
        </article>

        <article className="card admin-metric-card">
          <div className="admin-metric-icon">
            <AlertTriangle size={20} />
          </div>
          <span>
            <strong>{openMaintenance.length}</strong>
            <small>Open maintenance jobs</small>
          </span>
        </article>

        <article className="card admin-metric-card">
          <div className="admin-metric-icon">
            <ShieldCheck size={20} />
          </div>
          <span>
            <strong>{isSupabaseConfigured ? 'Ready' : 'Missing'}</strong>
            <small>Supabase environment</small>
          </span>
        </article>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Approval and review queue</h3>
              <p>High-level platform checks for new workspaces, billing, properties, and team access.</p>
            </div>
          </div>

          {approvalQueue.map((item) => (
            <div className="list-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Platform health</h3>
              <p>Launch-readiness status for major PropFlow systems.</p>
            </div>
          </div>

          {platformHealthItems.map((item) => (
            <div className="list-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
            </div>
          ))}
        </section>
      </section>

      {visibleWorkspaces.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace management</h3>
              <p>
                Visible customer workspaces. Approvals, suspension, billing enforcement, and admin notes
                should be wired through secure backend admin functions.
              </p>
            </div>
          </div>

          <DataTable
            rows={visibleWorkspaces}
            columns={[
              {
                key: 'name',
                label: 'Workspace',
                render: (row) => (
                  <span>
                    <strong>{getWorkspaceName(row)}</strong>
                    <small>{getWorkspaceCode(row)}</small>
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={statusTone(getWorkspaceStatus(row))}>{getWorkspaceStatus(row)}</StatusBadge>,
              },
              {
                key: 'plan',
                label: 'Plan',
                render: (row) => getWorkspacePlan(row),
              },
              {
                key: 'currency',
                label: 'Currency',
                render: (row) => getWorkspaceCurrency(row),
              },
              {
                key: 'country',
                label: 'Country',
                render: (row) => row.country || '—',
              },
              {
                key: 'created_at',
                label: 'Created',
                render: (row) => formatDate(row.created_at),
              },
              {
                key: 'actions',
                label: 'Controls',
                render: () => (
                  <div className="action-row">
                    <button type="button" disabled data-skip-create-action="true">
                      Review
                    </button>
                    <button type="button" disabled data-skip-create-action="true">
                      Suspend
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          eyebrow="Admin data"
          icon={Building2}
          title="No platform-wide workspace records visible yet"
          description="Connect a secure founder-admin RPC so this page can show all PropFlow customer workspaces."
        />
      )}

      {visibleMembers.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>User and team management</h3>
              <p>Visible members, roles, and account statuses.</p>
            </div>
          </div>

          <DataTable
            rows={getVisibleMemberRows(visibleMembers)}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (row) => (
                  <span>
                    <strong>{getMemberName(row)}</strong>
                    <small>{getMemberEmail(row)}</small>
                  </span>
                ),
              },
              {
                key: 'roles',
                label: 'Roles',
                render: (row) => getMemberRoles(row),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={statusTone(row.status || 'active')}>{row.status || 'active'}</StatusBadge>,
              },
              {
                key: 'created_at',
                label: 'Joined',
                render: (row) => formatDate(row.created_at),
              },
              {
                key: 'controls',
                label: 'Controls',
                render: () => (
                  <div className="action-row">
                    <button type="button" disabled data-skip-create-action="true">
                      Review
                    </button>
                    <button type="button" disabled data-skip-create-action="true">
                      Suspend
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>User management</h3>
              <p>No visible workspace members yet.</p>
            </div>
          </div>

          <div className="helper">
            Founder admin user management should be connected to a secure admin-only query in the next backend phase.
          </div>
        </section>
      )}

      <section className="card admin-danger-zone">
        <div className="card-header">
          <div>
            <h3>Admin controls planned next</h3>
            <p>
              These controls should not be made active until the backend admin policy layer is ready.
            </p>
          </div>
          <AlertTriangle size={22} className="muted" />
        </div>

        <div className="admin-control-grid">
          <button type="button" disabled data-skip-create-action="true">
            Approve workspace
          </button>
          <button type="button" disabled data-skip-create-action="true">
            Deny workspace
          </button>
          <button type="button" disabled data-skip-create-action="true">
            Suspend user
          </button>
          <button type="button" disabled data-skip-create-action="true">
            Review billing
          </button>
        </div>

        <div className="helper error-helper">
          Keep destructive admin controls disabled until secure Supabase admin RPCs, audit logs, and RLS checks are implemented.
        </div>
      </section>
    </AppLayout>
  );
}
