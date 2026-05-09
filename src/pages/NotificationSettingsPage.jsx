import React from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Mail,
  MessageSquare,
  Package,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';

const preferenceGroups = [
  {
    key: 'booking_reminders',
    title: 'Booking reminders',
    description: 'Upcoming check-ins, check-outs, booking confirmations, and direct booking requests.',
    icon: CalendarCheck,
  },
  {
    key: 'cleaning_assignments',
    title: 'Cleaning assignments',
    description: 'Cleaner assignments, due-soon cleanings, missed cleanings, and guest-ready updates.',
    icon: CheckCircle2,
  },
  {
    key: 'maintenance_assignments',
    title: 'Maintenance assignments',
    description: 'New work orders, urgent repairs, waiting-for-parts updates, and completed repairs.',
    icon: Wrench,
  },
  {
    key: 'payment_alerts',
    title: 'Payment alerts',
    description: 'Payment failures, subscription renewals, trial ending, and billing grace-period warnings.',
    icon: CreditCard,
  },
  {
    key: 'owner_reports',
    title: 'Owner reports',
    description: 'Owner report ready, monthly statement generated, and report delivery updates.',
    icon: Bell,
  },
  {
    key: 'team_invites',
    title: 'Team invites',
    description: 'Invite created, invite accepted, new team member joined, and role changes.',
    icon: Users,
  },
  {
    key: 'inventory_alerts',
    title: 'Inventory alerts',
    description: 'Low-stock supplies, out-of-stock items, and reorder reminders.',
    icon: Package,
  },
  {
    key: 'workspace_activity',
    title: 'Workspace activity',
    description: 'Important account, workspace, property, and audit-log activity.',
    icon: ShieldCheck,
  },
];

const channelDefinitions = [
  {
    key: 'inApp',
    title: 'In-app notifications',
    description: 'Show notifications inside PropFlow.',
    icon: Bell,
    provider: 'PropFlow app',
    configured: true,
  },
  {
    key: 'email',
    title: 'Email notifications',
    description: 'Send transactional emails through Resend.',
    icon: Mail,
    provider: 'Resend',
    configured: false,
  },
  {
    key: 'sms',
    title: 'SMS notifications',
    description: 'Send SMS alerts through Twilio.',
    icon: Smartphone,
    provider: 'Twilio SMS',
    configured: false,
  },
  {
    key: 'whatsapp',
    title: 'WhatsApp notifications',
    description: 'Send WhatsApp messages through Twilio WhatsApp.',
    icon: MessageSquare,
    provider: 'Twilio WhatsApp',
    configured: false,
  },
];

const launchEvents = [
  {
    title: 'Booking reminders',
    description: 'Check-in, check-out, confirmation, and payment reminder notifications.',
    icon: CalendarCheck,
  },
  {
    title: 'Cleaning assignments',
    description: 'Cleaner assigned, cleaning due soon, missed cleaning, and guest-ready status.',
    icon: CheckCircle2,
  },
  {
    title: 'Maintenance assignments',
    description: 'Work order assigned, urgent repair, waiting for parts, and repair completed.',
    icon: Wrench,
  },
  {
    title: 'Payment alerts',
    description: 'Subscription payment failed, trial ending, renewal, and billing grace period.',
    icon: CreditCard,
  },
  {
    title: 'Owner reports',
    description: 'Owner report generated, ready for review, sent, or failed delivery.',
    icon: Bell,
  },
  {
    title: 'Team invites',
    description: 'Invite sent, invite accepted, new member joined, and role updated.',
    icon: Users,
  },
];

function getWorkspaceName(workspace) {
  return workspace?.name || workspace?.business_name || workspace?.businessName || 'Current workspace';
}

function getUserName(user) {
  return user?.name || user?.full_name || user?.email || 'current user';
}

function providerTone(configured) {
  return configured ? 'success' : 'warning';
}

function providerStatus(configured) {
  return configured ? 'preview only' : 'not configured';
}

function countEnabledPreferences(preferences) {
  return Object.values(preferences).filter(Boolean).length;
}

function countConfiguredEnabledChannels(channels) {
  return channelDefinitions.filter((channel) => channel.configured && channels[channel.key]).length;
}

function ChannelCard({ channel, enabled, onToggle }) {
  const Icon = channel.icon;
  const disabled = !channel.configured;

  return (
    <article className="card notification-channel-card">
      <div className="notification-channel-top">
        <div className="notification-channel-icon">
          <Icon size={20} />
        </div>

        <StatusBadge tone={providerTone(channel.configured)}>
          {providerStatus(channel.configured)}
        </StatusBadge>
      </div>

      <div>
        <h3>{channel.title}</h3>
        <p>{channel.description}</p>
      </div>

      <div className="notification-channel-meta">
        <span>
          <strong>{channel.provider}</strong>
          <small>Provider</small>
        </span>

        <span>
          <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
          <small>{disabled ? 'Locked until backend setup' : 'UI preview only'}</small>
        </span>
      </div>

      <label className={disabled ? 'notification-toggle-row disabled' : 'notification-toggle-row'}>
        <input type="checkbox" checked={enabled} onChange={onToggle} disabled={disabled} />
        <span>
          <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
          <small>
            {channel.configured
              ? 'This is a local UI preview only. Saved preferences and delivery behavior will be connected in a later backend phase.'
              : 'Disabled until backend provider credentials and secure delivery functions are connected.'}
          </small>
        </span>
      </label>
    </article>
  );
}

function PreferenceCard({ preference, enabled }) {
  const Icon = preference.icon;

  return (
    <article className="notification-preference-row">
      <div className="notification-preference-icon">
        <Icon size={18} />
      </div>

      <span>
        <strong>{preference.title}</strong>
        <small>{preference.description}</small>
      </span>

      <label className="switch-control disabled" title="Preference saving is not active yet.">
        <input type="checkbox" checked={enabled} disabled readOnly />
        <span>Preview only</span>
      </label>
    </article>
  );
}

export function NotificationSettingsPage() {
  const { currentWorkspace, currentUser } = useApp();

  const [channels, setChannels] = React.useState({
    inApp: true,
    email: false,
    sms: false,
    whatsapp: false,
  });

  const preferences = React.useMemo(
    () => preferenceGroups.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}),
    [],
  );

  if (!currentWorkspace) {
    return (
      <AppLayout title="Notification Settings" subtitle="Workspace notification settings preview.">
        <EmptyState
          eyebrow="Workspace required"
          icon={Bell}
          title="Workspace required"
          description="Create or join a workspace before previewing notification preferences."
        />
      </AppLayout>
    );
  }

  const enabledChannels = countConfiguredEnabledChannels(channels);
  const enabledPreferences = countEnabledPreferences(preferences);

  const toggleChannel = (key) => {
    const channel = channelDefinitions.find((item) => item.key === key);

    if (!channel?.configured) return;

    setChannels((value) => ({
      ...value,
      [key]: !value[key],
    }));
  };

  return (
    <AppLayout
      title="Notification Settings"
      subtitle="Preview in-app, email, SMS, and WhatsApp notification settings. Preference saving and external delivery are not active yet."
    >
      <section className="stat-grid dense">
        <StatCard
          label="Enabled previews"
          value={`${enabledChannels}/4`}
          subtitle="Only local UI previews can be toggled"
          icon={Bell}
        />

        <StatCard
          label="Event preferences"
          value={`${enabledPreferences}/${preferenceGroups.length}`}
          subtitle="Preview only until persistence is connected"
          icon={ShieldCheck}
        />

        <StatCard
          label="Email provider"
          value="Not configured"
          subtitle="Resend backend setup required"
          icon={Mail}
          tone="warning"
        />

        <StatCard
          label="SMS / WhatsApp"
          value="Not configured"
          subtitle="Twilio backend setup required"
          icon={MessageSquare}
          tone="warning"
        />
      </section>

      <section className="card notification-warning-card urgent">
        <div className="card-header">
          <div>
            <h3>Provider setup required</h3>
            <p>
              Configure notification providers securely on the backend before enabling production
              email, SMS, or WhatsApp delivery.
            </p>
          </div>

          <AlertTriangle size={22} className="muted" />
        </div>

        <div className="helper">
          Email, SMS, WhatsApp, and saved preference controls stay disabled until backend provider setup and Supabase preference persistence are complete. Resend, Twilio SMS, and Twilio WhatsApp credentials must stay server-side. Do not expose API keys, auth tokens, or provider secrets in frontend code.
        </div>
      </section>

      <section className="notification-channel-grid">
        {channelDefinitions.map((channel) => (
          <ChannelCard
            key={channel.key}
            channel={channel}
            enabled={Boolean(channels[channel.key])}
            onToggle={() => toggleChannel(channel.key)}
          />
        ))}
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Event preferences</h3>
              <p>
                Notification categories for {getUserName(currentUser)} in {getWorkspaceName(currentWorkspace)}.
              </p>
            </div>

            <Bell size={20} className="muted" />
          </div>

          <div className="notification-preference-list">
            {preferenceGroups.map((preference) => (
              <PreferenceCard
                key={preference.key}
                preference={preference}
                enabled={Boolean(preferences[preference.key])}
              />
            ))}
          </div>

          <div className="helper">
            Event preference toggles are preview-only and cannot be changed yet. Persist notification preferences to a Supabase notification preferences table in the backend notification phase.
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Provider setup status</h3>
              <p>Backend delivery provider readiness.</p>
            </div>

            <ShieldCheck size={20} className="muted" />
          </div>

          <div className="notification-provider-list">
            <span>
              <Mail size={16} />
              <strong>Resend Email</strong>
              <StatusBadge tone="warning">not configured</StatusBadge>
            </span>

            <span>
              <Smartphone size={16} />
              <strong>Twilio SMS</strong>
              <StatusBadge tone="warning">not configured</StatusBadge>
            </span>

            <span>
              <MessageSquare size={16} />
              <strong>Twilio WhatsApp</strong>
              <StatusBadge tone="warning">not configured</StatusBadge>
            </span>

            <span>
              <Bell size={16} />
              <strong>In-app notifications</strong>
              <StatusBadge tone="info">preview only</StatusBadge>
            </span>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Launch notification events</h3>
            <p>Core notification events PropFlow should support in the MVP.</p>
          </div>

          <CalendarCheck size={20} className="muted" />
        </div>

        <div className="notification-event-grid">
          {launchEvents.map((event) => {
            const Icon = event.icon;

            return (
              <article className="notification-event-card" key={event.title}>
                <Icon size={18} />
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.description}</small>
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Delivery logs</h3>
            <p>Provider delivery history foundation.</p>
          </div>

          <ShieldCheck size={20} className="muted" />
        </div>

        <EmptyState
          compact
          icon={Bell}
          title="No delivery logs yet"
          description="Notification delivery records will appear here after backend provider integrations are configured."
        />
      </section>
    </AppLayout>
  );
}
