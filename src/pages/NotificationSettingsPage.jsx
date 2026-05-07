import React from 'react';
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Mail,
  MessageSquare,
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
  'booking_reminders',
  'cleaning_assignments',
  'maintenance_assignments',
  'payment_alerts',
  'owner_reports',
  'team_invites',
  'inventory_alerts',
  'workspace_activity',
];

function labelize(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function NotificationSettingsPage() {
  const { currentWorkspace, currentUser } = useApp();

  const [channels, setChannels] = React.useState({
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
  });

  const [preferences, setPreferences] = React.useState(
    preferenceGroups.reduce((acc, item) => ({ ...acc, [item]: true }), {}),
  );

  if (!currentWorkspace) {
    return (
      <AppLayout title="Notification Settings">
        <EmptyState
          title="Workspace required"
          description="Create or join a workspace before configuring notification preferences."
        />
      </AppLayout>
    );
  }

  const providerConfigured = {
    resend: false,
    sms: false,
    whatsapp: false,
  };

  const toggleChannel = (key) => {
    setChannels((value) => ({
      ...value,
      [key]: !value[key],
    }));
  };

  const togglePreference = (key) => {
    setPreferences((value) => ({
      ...value,
      [key]: !value[key],
    }));
  };

  return (
    <AppLayout
      title="Notification Settings"
      subtitle="Configure in-app, email, SMS, and WhatsApp notification preferences"
    >
      <div className="stat-grid dense">
        <StatCard
          label="In-app"
          value={channels.inApp ? 'Enabled' : 'Disabled'}
          icon={Bell}
        />

        <StatCard
          label="Email"
          value={providerConfigured.resend ? 'Configured' : 'Not configured'}
          icon={Mail}
          tone="warning"
        />

        <StatCard
          label="SMS"
          value={providerConfigured.sms ? 'Configured' : 'Not configured'}
          icon={Smartphone}
          tone="warning"
        />

        <StatCard
          label="WhatsApp"
          value={providerConfigured.whatsapp ? 'Configured' : 'Not configured'}
          icon={MessageSquare}
          tone="warning"
        />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Provider setup status</h3>
            <p>
              Configure notification providers securely on the backend before enabling production
              messaging.
            </p>
          </div>
          <ShieldCheck size={20} />
        </div>

        <div className="metadata-grid">
          <span>
            <Mail size={16} />
            Resend Email
          </span>
          <span>
            <StatusBadge tone="warning">not configured</StatusBadge>
          </span>
          <span>
            <Smartphone size={16} />
            Twilio SMS
          </span>
          <span>
            <StatusBadge tone="warning">not configured</StatusBadge>
          </span>
          <span>
            <MessageSquare size={16} />
            Twilio WhatsApp
          </span>
          <span>
            <StatusBadge tone="warning">not configured</StatusBadge>
          </span>
        </div>

        <div className="helper">
          Resend, Twilio SMS, and Twilio WhatsApp should be configured server-side only. Do not
          expose provider secrets in frontend code.
        </div>
      </section>

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Notification channels</h3>
              <p>Workspace and user delivery preferences.</p>
            </div>
          </div>

          <div className="settings-grid">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={channels.inApp}
                onChange={() => toggleChannel('inApp')}
              />
              In-app notifications
            </label>

            <label className="inline-check">
              <input
                type="checkbox"
                checked={channels.email}
                onChange={() => toggleChannel('email')}
              />
              Email notifications
            </label>

            <label className="inline-check">
              <input
                type="checkbox"
                checked={channels.sms}
                onChange={() => toggleChannel('sms')}
              />
              SMS notifications
            </label>

            <label className="inline-check">
              <input
                type="checkbox"
                checked={channels.whatsapp}
                onChange={() => toggleChannel('whatsapp')}
              />
              WhatsApp notifications
            </label>
          </div>

          <div className="helper">
            Channel preferences are local UI state for now. Persist these to a Supabase notification
            preferences table in the backend notification phase.
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Event preferences</h3>
              <p>Notification categories for {currentUser?.name || 'current user'}.</p>
            </div>
          </div>

          <div className="settings-grid">
            {preferenceGroups.map((item) => (
              <label className="inline-check" key={item}>
                <input
                  type="checkbox"
                  checked={Boolean(preferences[item])}
                  onChange={() => togglePreference(item)}
                />
                {labelize(item)}
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Launch notification events</h3>
            <p>These are the core notification events PropFlow should support in the MVP.</p>
          </div>
        </div>

        <div className="metadata-grid">
          <span>
            <CalendarCheck size={16} />
            Booking reminders
          </span>
          <span>
            <CalendarCheck size={16} />
            Cleaning assignments
          </span>
          <span>
            <Wrench size={16} />
            Maintenance assignments
          </span>
          <span>
            <CreditCard size={16} />
            Payment alerts
          </span>
          <span>
            <Bell size={16} />
            Owner reports
          </span>
          <span>
            <Users size={16} />
            Team invites
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Delivery logs</h3>
            <p>Provider delivery history foundation.</p>
          </div>
        </div>

        <EmptyState
          title="No delivery logs yet"
          description="Notification delivery records will appear here after backend provider integrations are configured."
        />
      </section>
    </AppLayout>
  );
}
