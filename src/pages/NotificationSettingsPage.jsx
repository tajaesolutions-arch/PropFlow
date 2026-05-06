import React from 'react';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
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
];

function labelize(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function NotificationSettingsPage() {
  const { currentWorkspace, currentUser } = useApp();

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

  return (
    <AppLayout title="Notification Settings">
      <div className="stats-grid compact">
        <StatCard label="Email" value={providerConfigured.resend ? 'Configured' : 'Not configured'} icon={Mail} />
        <StatCard label="SMS" value={providerConfigured.sms ? 'Configured' : 'Not configured'} icon={Smartphone} />
        <StatCard label="WhatsApp" value={providerConfigured.whatsapp ? 'Configured' : 'Not configured'} icon={MessageSquare} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Provider setup status</h3>
            <p>Configure providers securely on the backend before enabling production messaging.</p>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <strong>Resend Email</strong>
            <p><StatusBadge tone="warning">not configured</StatusBadge></p>
          </div>
          <div>
            <strong>Twilio SMS</strong>
            <p><StatusBadge tone="warning">not configured</StatusBadge></p>
          </div>
          <div>
            <strong>Twilio WhatsApp</strong>
            <p><StatusBadge tone="warning">not configured</StatusBadge></p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Notification channels</h3>
            <p>Workspace and user delivery preferences.</p>
          </div>
        </div>

        <div className="settings-grid">
          <label><input type="checkbox" defaultChecked /> In-app notifications</label>
          <label><input type="checkbox" defaultChecked /> Email notifications</label>
          <label><input type="checkbox" /> SMS notifications</label>
          <label><input type="checkbox" /> WhatsApp notifications</label>
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
            <label key={item}>
              <input type="checkbox" defaultChecked /> {labelize(item)}
            </label>
          ))}
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
