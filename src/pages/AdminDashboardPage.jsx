import React from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Shield,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';

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
  return workspace.plan || workspace.subscription_plan || 'starter';
}

function getWorkspaceCurrency(workspace) {
  return workspace.defaultCurrency || workspace.default_currency || 'USD';
}

function getMemberName(member) {
  return (
    member.profile?.full_name ||
    member.profiles?.full_name ||
    member.full_name ||
    member.email ||
    member.profile?.email ||
    member.profiles?.email ||
    'Workspace member'
  );
}

function getMemberEmail(member) {
  return member.profile?.email || member.profiles?.email || member.email || '—';
}

function getMemberRoles(member) {
  if (Array.isArray(member.roles)) {
    return member.roles.join(', ');
  }

  return '—';
}

export function AdminDashboardPage() {
  const { workspaces, memberships, data, currentUser } = useApp();

  const visibleWorkspaces = workspaces || [];
  const visibleMembers = data.members?.length ? data.members : memberships || [];
  const visibleProperties = data.properties || [];
  const visibleInvites = data.invites || [];

  const activeWorkspaces = visibleWorkspaces.filter(
    (workspace) => getWorkspaceStatus(workspace) === 'active',
  );

  const suspendedWorkspaces = visibleWorkspaces.filter((workspace) =>
    ['suspended', 'restricted', 'blocked'].includes(getWorkspaceStatus(workspace)),
  );

  const pendingInvites = visibleInvites.filter((invite) => invite.status === 'pending');

  const platformHealthItems = [
    {
      id: 'auth',
      title: 'Supabase Auth',
      description: 'Real login, signup, workspace membership, and role routing are enabled.',
      status: 'active',
    },
    {
      id: 'billing',
      title: 'Stripe billing',
      description: 'Billing placeholders exist. Stripe subscription enforcement is still a production TODO.',
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
      status: 'active',
    },
    {
      id: 'reports',
      title: 'Reports and exports',
      description: 'Report pages exist. PDF and CSV generation need to be wired in the next phase.',
      status: 'pending',
    },
  ];

  const approvalQueue = [
    {
      id: 'workspace-review',
      title: 'Workspace signup review',
      description: 'Review new workspaces after signup and suspend suspicious accounts if needed.',
      status: visibleWorkspaces.length ? 'ready' : 'empty',
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
      description: 'Platform-wide property review needs a founder-admin RPC or admin table query.',
      status: visibleProperties.length ? 'ready' : 'empty',
    },
    {
      id: 'team-review',
      title: 'Team invite activity',
      description: 'Review pending invites, accepted users, and revoked/suspended team members.',
      status: pendingInvites.length ? 'ready' : 'empty',
    },
  ];

  return (
    <AppLayout
      title="PropFlow Admin"
      subtitle="Founder-only SaaS control center for platform metrics, approvals, billing, and account safety"
    >
      <p className="page-note">
        PropFlow Admin is a SaaS-level founder role. Customers should never receive this role from
        customer invite forms. Platform-wide metrics will need a secure admin-only Supabase RPC or
        admin API in the next backend phase.
      </p>

      <div className="stat-grid dense">
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
          value={visibleProperties.length}
          icon={ClipboardList}
        />
      </div>

      <div className="stat-grid dense">
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
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Founder admin scope</h3>
            <p>
              This dashboard is founder-only. It should eventually read all customer workspaces,
              subscriptions, users, properties, approvals, suspensions, billing states, and activity
              logs from secure admin-only database functions.
            </p>
          </div>
          <Shield size={22} />
        </div>

        <div className="helper">
          Current MVP note: some tables may only show records visible to the signed-in admin session.
          The next backend task should create secure platform-wide admin metrics using Supabase RLS
          and service-safe admin RPCs.
        </div>
      </section>

      <div className="panel-grid two">
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
                {item.title}
                <small>{item.description}</small>
              </span>
              <StatusBadge>{item.status}</StatusBadge>
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
                {item.title}
                <small>{item.description}</small>
              </span>
              <StatusBadge>{item.status}</StatusBadge>
            </div>
          ))}
        </section>
      </div>

      {visibleWorkspaces.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace management</h3>
              <p>
                Visible customer workspaces. Suspend, approve, billing enforcement, and admin notes
                should be wired in the next backend phase.
              </p>
            </div>
          </div>

          <DataTable
            rows={visibleWorkspaces}
            columns={[
              {
                key: 'name',
                label: 'Workspace',
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge>{getWorkspaceStatus(row)}</StatusBadge>,
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
                    <button type="button" disabled>
                      Review
                    </button>
                    <button type="button" disabled>
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
          title="No platform-wide workspace records visible yet."
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
            rows={visibleMembers.map((member, index) => ({
              id: member.id || `${member.workspace_id || 'member'}-${member.user_id || index}`,
              ...member,
            }))}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (row) => getMemberName(row),
              },
              {
                key: 'email',
                label: 'Email',
                render: (row) => getMemberEmail(row),
              },
              {
                key: 'roles',
                label: 'Roles',
                render: (row) => getMemberRoles(row),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge>,
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
                    <button type="button" disabled>
                      Review
                    </button>
                    <button type="button" disabled>
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
            Founder admin user management should be connected to a secure admin-only query in the
            next backend phase.
          </div>
        </section>
      )}

      <section className="card danger-zone">
        <div className="card-header">
          <div>
            <h3>Admin controls planned next</h3>
            <p>
              These controls should not be made active until the backend admin policy layer is ready.
            </p>
          </div>
          <AlertTriangle size={22} />
        </div>

        <div className="action-row">
          <button type="button" disabled>
            Approve workspace
          </button>
          <button type="button" disabled>
            Deny workspace
          </button>
          <button type="button" disabled>
            Suspend workspace
          </button>
          <button type="button" disabled>
            Restore workspace
          </button>
          <button type="button" disabled>
            Force billing review
          </button>
        </div>

        <div className="helper">
          Keep these disabled until Supabase RLS, admin RPCs, activity logs, and billing rules are
          implemented.
        </div>
      </section>
    </AppLayout>
  );
}
