import React from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  MessageSquare,
  Package,
  Receipt,
  Save,
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
import { hasAnyRole } from '../lib/auth.js';
import { notificationPreferenceGroups, roles } from '../data/constants.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

const groupMeta = {
  bookings: { title: 'Bookings', description: 'Booking created, updated, check-in due, and check-out due alerts.', icon: CalendarCheck },
  cleaning: { title: 'Cleaning', description: 'Cleaner assignment, due-soon, completed, and issue alerts.', icon: CheckCircle2 },
  maintenance: { title: 'Maintenance', description: 'Work order created, assigned, urgent, and completed alerts.', icon: Wrench },
  owner_reports: { title: 'Owner reports', description: 'Owner report ready and released notifications.', icon: Bell },
  finance: { title: 'Finance', description: 'Manual expense creation and finance review alerts.', icon: Receipt },
  inventory: { title: 'Inventory', description: 'Low-stock supply notifications.', icon: Package },
  files: { title: 'Files', description: 'Workspace file upload alerts.', icon: FileText },
  team: { title: 'Team', description: 'Invite, accepted invite, suspension, and reactivation alerts.', icon: Users },
  billing: { title: 'Billing', description: 'Payment failed and grace-period warning alerts.', icon: CreditCard },
  workspace_activity: { title: 'Workspace activity', description: 'Important workspace activity notifications.', icon: ShieldCheck },
};

const providerDefinitions = [
  { key: 'email', channel: 'email', provider: 'resend', title: 'Resend email', icon: Mail, description: 'Transactional email will require secure backend Resend functions.' },
  { key: 'sms', channel: 'sms', provider: 'twilio', title: 'Twilio SMS', icon: Smartphone, description: 'SMS delivery will require secure backend Twilio functions.' },
  { key: 'whatsapp', channel: 'whatsapp', provider: 'twilio', title: 'Twilio WhatsApp', icon: MessageSquare, description: 'WhatsApp delivery will require secure backend Twilio functions.' },
];

const supportedPreferenceGroups = new Set([
  'bookings',
  'cleaning',
  'maintenance',
  'owner_reports',
  'finance',
  'inventory',
  'files',
  'team',
  'billing',
  'workspace_activity',
]);

const channelLabels = [
  ['inAppEnabled', 'In-app'],
  ['emailEnabled', 'Email'],
  ['smsEnabled', 'SMS'],
  ['whatsappEnabled', 'WhatsApp'],
];

function getWorkspaceName(workspace) {
  return workspace?.name || workspace?.business_name || workspace?.businessName || 'Current workspace';
}

function getPreference(preferences, group) {
  return preferences.find((item) => (item.eventGroup || item.event_group) === group) || {
    eventGroup: group,
    inAppEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
    whatsappEnabled: false,
  };
}

function getProviderSetting(settings, provider, channel) {
  return settings.find((item) => item.provider === provider && item.channel === channel) || {
    provider,
    channel,
    enabled: false,
    configured: false,
  };
}

function providerTone(setting) {
  return setting?.enabled && setting?.configured ? 'success' : 'warning';
}

function providerStatus(setting) {
  if (setting?.enabled && setting?.configured) return 'backend status ready';
  if (setting?.enabled) return 'backend setup required';
  return 'not configured';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function PreferenceRow({ group, preference, savingKey, onToggle }) {
  const meta = groupMeta[group] || { title: group, description: '', icon: Bell };
  const Icon = meta.icon;

  return (
    <article className="notification-preference-row real">
      <div className="notification-preference-icon"><Icon size={18} /></div>
      <span>
        <strong>{meta.title}</strong>
        <small>{meta.description}</small>
      </span>
      <div className="notification-preference-channels">
        {channelLabels.map(([key, label]) => (
          <label className="switch-control" key={key}>
            <input
              type="checkbox"
              checked={Boolean(preference[key])}
              disabled={savingKey === `${group}:${key}`}
              onChange={() => onToggle(group, key, !preference[key])}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </article>
  );
}

export function NotificationSettingsPage() {
  const {
    currentWorkspace,
    currentUser,
    data,
    updateNotificationPreference,
    updateNotificationProviderSetting,
  } = useApp();
  const [savingKey, setSavingKey] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [providerDrafts, setProviderDrafts] = React.useState({});

  const preferences = data.notificationPreferences || [];
  const providerSettings = data.notificationProviderSettings || [];
  const deliveryLogs = data.notificationDeliveryLogs || [];
  const canManageProviders = hasAnyRole(currentUser, [roles.OWNER_ADMIN]);

  React.useEffect(() => {
    const nextDrafts = {};
    providerDefinitions.forEach((definition) => {
      const setting = getProviderSetting(providerSettings, definition.provider, definition.channel);
      nextDrafts[definition.key] = {
        enabled: Boolean(setting.enabled),
        configured: Boolean(setting.configured),
        fromName: setting.fromName || setting.from_name || '',
        fromEmail: setting.fromEmail || setting.from_email || '',
        replyTo: setting.replyTo || setting.reply_to || '',
        senderPhoneLabel: setting.senderPhoneLabel || setting.sender_phone_label || '',
        notes: setting.notes || '',
      };
    });
    setProviderDrafts(nextDrafts);
  }, [providerSettings]);

  if (!currentWorkspace) {
    return (
      <AppLayout title="Notification Settings" subtitle="Workspace notification preferences.">
        <EmptyState eyebrow="Workspace required" icon={Bell} title="Workspace required" description="Create or join a workspace before managing notification preferences." />
      </AppLayout>
    );
  }

  const preferenceRows = notificationPreferenceGroups
    .filter(([group]) => supportedPreferenceGroups.has(group))
    .map(([group]) => ({ group, preference: getPreference(preferences, group) }));
  const enabledInApp = preferenceRows.filter(({ preference }) => preference.inAppEnabled !== false).length;
  const configuredExternal = providerDefinitions.filter((definition) => {
    const setting = getProviderSetting(providerSettings, definition.provider, definition.channel);
    return setting.enabled && setting.configured;
  }).length;

  const handlePreferenceToggle = async (group, key, checked) => {
    const currentPreference = getPreference(preferences, group);
    const nextPreference = { ...currentPreference, [key]: checked };
    setSavingKey(`${group}:${key}`);
    setErrorMessage('');
    setStatusMessage('');
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured. Preferences are shown as safe defaults until the database connection is available.');
      }
      await updateNotificationPreference(group, nextPreference);
      setStatusMessage('Notification preference saved. External channel delivery remains provider-safe and will not send until backend providers are configured.');
    } catch (error) {
      setErrorMessage(error.message || 'Notification preference could not be saved.');
    } finally {
      setSavingKey('');
    }
  };

  const updateProviderDraft = (key, field, value) => {
    setProviderDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };

  const saveProviderSetting = async (definition) => {
    const draft = providerDrafts[definition.key] || {};
    setSavingKey(`provider:${definition.key}`);
    setErrorMessage('');
    setStatusMessage('');
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured. Provider readiness can be saved after the database connection is available.');
      }
      await updateNotificationProviderSetting({
        provider: definition.provider,
        channel: definition.channel,
        enabled: draft.enabled,
        configured: draft.configured,
        fromName: draft.fromName,
        fromEmail: draft.fromEmail,
        replyTo: draft.replyTo,
        senderPhoneLabel: draft.senderPhoneLabel,
        notes: draft.notes,
      });
      setStatusMessage('Non-secret provider status saved. No API keys, tokens, or provider secrets were collected.');
    } catch (error) {
      setErrorMessage(error.message || 'Provider setting could not be saved.');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <AppLayout
      title="Notification Settings"
      subtitle={`Workspace/user notification preferences for ${getWorkspaceName(currentWorkspace)}.`}
    >
      <section className="stat-grid dense">
        <StatCard label="Preference groups" value={preferenceRows.length} subtitle="Workspace/user scoped" icon={Bell} />
        <StatCard label="In-app enabled" value={`${enabledInApp}/${preferenceRows.length}`} subtitle="Real notification records" icon={ShieldCheck} />
        <StatCard label="External providers" value={`${configuredExternal}/3`} subtitle="Provider-safe setup states" icon={MessageSquare} tone={configuredExternal ? 'success' : 'warning'} />
        <StatCard label="Delivery logs" value={deliveryLogs.length} subtitle="Queued/skipped/provider status" icon={Save} />
      </section>

      <section className="card notification-warning-card urgent">
        <div className="card-header">
          <div>
            <h3>Provider setup required</h3>
            <p>Email, SMS, and WhatsApp preferences can be saved when Supabase is connected, but PropFlow will not send externally until secure backend provider functions and server-side secrets are connected.</p>
          </div>
          <AlertTriangle size={22} className="muted" />
        </div>
        <div className="helper">This page never asks for API keys, auth tokens, webhook signing secrets, or service-role values. Provider rows store only non-secret readiness/status labels.</div>
      </section>

      {(statusMessage || errorMessage) && (
        <section className={`workspace-load-warning ${errorMessage ? 'error' : ''}`} role="status">
          <strong>{errorMessage ? 'Notification settings error' : 'Notification settings saved'}</strong>
          <span>{errorMessage || statusMessage}</span>
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Event preferences</h3>
            <p>Saved per user and workspace when Supabase is connected. In-app defaults to enabled; external channels remain provider-safe setup states.</p>
          </div>
          <Bell size={20} className="muted" />
        </div>
        <div className="notification-preference-list">
          {preferenceRows.map(({ group, preference }) => (
            <PreferenceRow key={group} group={group} preference={preference} savingKey={savingKey} onToggle={handlePreferenceToggle} />
          ))}
        </div>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Provider setup status</h3>
              <p>Non-secret Resend/Twilio status rows only.</p>
            </div>
            <ShieldCheck size={20} className="muted" />
          </div>
          <div className="notification-provider-list real">
            {providerDefinitions.map((definition) => {
              const Icon = definition.icon;
              const setting = getProviderSetting(providerSettings, definition.provider, definition.channel);
              const draft = providerDrafts[definition.key] || {};
              return (
                <article className="notification-provider-row" key={definition.key}>
                  <div>
                    <Icon size={16} />
                    <span>
                      <strong>{definition.title}</strong>
                      <small>{definition.description}</small>
                    </span>
                  </div>
                  <StatusBadge tone={providerTone(setting)}>{providerStatus(setting)}</StatusBadge>
                  {canManageProviders && (
                    <div className="notification-provider-form">
                      <label><input type="checkbox" checked={Boolean(draft.enabled)} onChange={(event) => updateProviderDraft(definition.key, 'enabled', event.target.checked)} /> Enabled flag</label>
                      <label><input type="checkbox" checked={Boolean(draft.configured)} onChange={(event) => updateProviderDraft(definition.key, 'configured', event.target.checked)} /> Backend setup ready flag</label>
                      {definition.channel === 'email' ? (
                        <>
                          <input placeholder="From name" value={draft.fromName || ''} onChange={(event) => updateProviderDraft(definition.key, 'fromName', event.target.value)} />
                          <input placeholder="From email label" value={draft.fromEmail || ''} onChange={(event) => updateProviderDraft(definition.key, 'fromEmail', event.target.value)} />
                          <input placeholder="Reply-to label" value={draft.replyTo || ''} onChange={(event) => updateProviderDraft(definition.key, 'replyTo', event.target.value)} />
                        </>
                      ) : (
                        <input placeholder="Sender phone label" value={draft.senderPhoneLabel || ''} onChange={(event) => updateProviderDraft(definition.key, 'senderPhoneLabel', event.target.value)} />
                      )}
                      <textarea placeholder="Non-secret setup notes" value={draft.notes || ''} onChange={(event) => updateProviderDraft(definition.key, 'notes', event.target.value)} />
                      <button type="button" onClick={() => saveProviderSetting(definition)} disabled={savingKey === `provider:${definition.key}`}>
                        <Save size={16} /> Save status
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Delivery logs</h3>
              <p>Real delivery/outbox foundation records when notifications are created.</p>
            </div>
            <ShieldCheck size={20} className="muted" />
          </div>
          {deliveryLogs.length ? (
            <div className="notification-delivery-log-list">
              {deliveryLogs.slice(0, 12).map((log) => (
                <article className="notification-delivery-log-row" key={log.id}>
                  <span><strong>{log.channel}</strong><small>{log.provider || 'internal'}</small></span>
                  <StatusBadge tone={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'error' : 'warning'}>{String(log.status || '').replaceAll('_', ' ')}</StatusBadge>
                  <small>{formatDate(log.createdAt || log.created_at)}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Bell} title="No delivery logs yet" description="Delivery rows will appear when real in-app notifications are created. External channels will be skipped or marked provider not configured until providers are connected server-side." />
          )}
        </section>
      </section>
    </AppLayout>
  );
}
