import React from 'react';
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Mail,
  MessageCircle,
  Settings,
  Smartphone,
  Users,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const notificationTypes = [
  'booking',
  'cleaning',
  'maintenance',
  'owner_report',
  'billing',
  'team',
  'inventory_alert',
  'system',
];

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : 'Notification';
}

function formatDate(value) {
  if (!value) return 'Just now';

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

function getNotificationType(notification) {
  return notification.type || notification.category || 'system';
}

function getNotificationMessage(notification) {
  return notification.message || notification.title || 'Workspace notification';
}

function isUnread(notification) {
  return !notification.read_at && notification.status !== 'read';
}

function getTone(notification) {
  const type = getNotificationType(notification);
  const message = getNotificationMessage(notification).toLowerCase();

  if (notification.tone) return notification.tone;
  if (message.includes('failed') || message.includes('overdue') || message.includes('urgent')) return 'error';
  if (type === 'billing' || type === 'maintenance' || type === 'inventory_alert') return 'warning';
  if (type === 'cleaning' || type === 'owner_report') return 'success';

  return 'info';
}

function getIcon(type) {
  if (type === 'booking') return CalendarCheck;
  if (type === 'cleaning') return CalendarCheck;
  if (type === 'maintenance') return Wrench;
  if (type === 'billing') return CreditCard;
  if (type === 'team') return Users;
  return Bell;
}

export function NotificationsPage() {
  const { data } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    type: 'all',
    status: 'all',
  });

  const notifications = data.notifications || [];

  const unreadCount = notifications.filter(isUnread).length;
  const billingCount = notifications.filter((notification) => getNotificationType(notification) === 'billing').length;
  const maintenanceCount = notifications.filter((notification) => getNotificationType(notification) === 'maintenance').length;
  const teamCount = notifications.filter((notification) => getNotificationType(notification) === 'team').length;

  const filteredNotifications = notifications
    .filter((notification) => filters.type === 'all' || getNotificationType(notification) === filters.type)
    .filter((notification) => {
      if (filters.status === 'unread') return isUnread(notification);
      if (filters.status === 'read') return !isUnread(notification);
      return true;
    })
    .filter((notification) => {
      const searchText = [
        getNotificationType(notification),
        getNotificationMessage(notification),
        notification.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(filters.query.toLowerCase());
    });

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  return (
    <AppLayout title="Notifications" subtitle="In-app alerts for bookings, cleaning, maintenance, billing, reports, and team activity">
      <div className="stat-grid dense">
        <StatCard label="Total notifications" value={notifications.length} icon={Bell} />
        <StatCard label="Unread" value={unreadCount} icon={Bell} tone={unreadCount ? 'warning' : 'accent'} />
        <StatCard label="Maintenance alerts" value={maintenanceCount} icon={Wrench} />
        <StatCard label="Billing alerts" value={billingCount} icon={CreditCard} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Notification center</h3>
            <p>
              Workspace alerts for bookings, cleaning tasks, maintenance work orders, owner reports,
              billing, inventory, and team activity.
            </p>
          </div>

          <button type="button" onClick={() => navigate('/notification-settings')}>
            <Settings size={16} />
            Notification settings
          </button>
        </div>

        <div className="filter-bar booking-filter">
          <input
            placeholder="Search notifications"
            value={filters.query}
            onChange={setFilter('query')}
          />

          <select value={filters.type} onChange={setFilter('type')}>
            <option value="all">All types</option>
            {notificationTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>

          <select value={filters.status} onChange={setFilter('status')}>
            <option value="all">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>In-app notifications</h3>
            <p>Real notification records from the current workspace.</p>
          </div>

          <StatusBadge tone="info">{filteredNotifications.length} shown</StatusBadge>
        </div>

        {filteredNotifications.length ? (
          <div className="notification-list">
            {filteredNotifications.map((notification) => {
              const type = getNotificationType(notification);
              const Icon = getIcon(type);

              return (
                <div className="notification" key={notification.id}>
                  <Icon size={18} />

                  <span>
                    {getNotificationMessage(notification)}
                    <small>
                      {formatLabel(type)} · {formatDate(notification.created_at || notification.time)}
                    </small>
                  </span>

                  <StatusBadge tone={getTone(notification)}>
                    {isUnread(notification) ? 'unread' : 'read'}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={notifications.length ? 'No notifications match the current filters.' : 'No notifications yet.'}
            description={
              notifications.length
                ? 'Adjust the filters to view more notification records.'
                : 'PropFlow will show real workspace alerts here when bookings, cleaning tasks, maintenance work orders, billing updates, owner reports, inventory alerts, or team activity create notification records.'
            }
          />
        )}
      </section>

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Provider status</h3>
              <p>Email, SMS, and WhatsApp providers planned for the MVP notification system.</p>
            </div>
          </div>

          <div className="list-row">
            <Mail size={18} />
            <span>
              Email via Resend
              <small>Transactional email provider should be configured server-side.</small>
            </span>
            <StatusBadge>pending</StatusBadge>
          </div>

          <div className="list-row">
            <Smartphone size={18} />
            <span>
              SMS via Twilio
              <small>SMS notifications should use secure backend credentials.</small>
            </span>
            <StatusBadge>pending</StatusBadge>
          </div>

          <div className="list-row">
            <MessageCircle size={18} />
            <span>
              WhatsApp via Twilio
              <small>WhatsApp alerts should use secure backend credentials.</small>
            </span>
            <StatusBadge>pending</StatusBadge>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Notification categories</h3>
              <p>Core alert types PropFlow should support at launch.</p>
            </div>
          </div>

          <div className="metadata-grid">
            <span>
              <CalendarCheck size={16} />
              Bookings
            </span>
            <span>
              <CalendarCheck size={16} />
              Cleaning
            </span>
            <span>
              <Wrench size={16} />
              Maintenance
            </span>
            <span>
              <CreditCard size={16} />
              Billing
            </span>
            <span>
              <Users size={16} />
              Team activity
            </span>
            <span>
              <Bell size={16} />
              Owner reports
            </span>
          </div>

          <div className="helper">
            Provider delivery logic should be added after the in-app notification records are stable.
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
