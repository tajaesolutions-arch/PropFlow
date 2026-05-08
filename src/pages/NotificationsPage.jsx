import React from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Mail,
  MessageCircle,
  Package,
  Search,
  Settings,
  Smartphone,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { hasAnyRole } from '../lib/auth.js';
import { roles } from '../data/constants.js';
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

const settingsAccessRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

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

function getNotificationTitle(notification) {
  return notification.title || formatLabel(getNotificationType(notification));
}

function getNotificationMessage(notification) {
  return notification.message || notification.body || notification.title || 'Workspace notification';
}

function getNotificationDate(notification) {
  return notification.created_at || notification.createdAt || notification.time || notification.sent_at || '';
}

function isUnread(notification) {
  return !notification.read_at && !notification.readAt && notification.status !== 'read';
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
  if (type === 'cleaning') return CheckCircle2;
  if (type === 'maintenance') return Wrench;
  if (type === 'billing') return CreditCard;
  if (type === 'team') return Users;
  if (type === 'inventory_alert') return Package;
  if (type === 'owner_report') return Bell;
  return Bell;
}

function statusTone(value) {
  const text = String(value || '').toLowerCase();

  if (['failed', 'urgent', 'overdue', 'error'].some((term) => text.includes(term))) return 'error';
  if (['pending', 'warning', 'scheduled'].some((term) => text.includes(term))) return 'warning';
  if (['read', 'sent', 'ready', 'completed'].some((term) => text.includes(term))) return 'success';

  return 'info';
}

function matchesSearch(notification, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [
    getNotificationType(notification),
    getNotificationTitle(notification),
    getNotificationMessage(notification),
    notification.status,
    notification.channel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

function sortNotifications(notifications) {
  return [...notifications].sort((a, b) => {
    const dateA = new Date(getNotificationDate(a)).getTime();
    const dateB = new Date(getNotificationDate(b)).getTime();

    if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
    if (Number.isNaN(dateA)) return 1;
    if (Number.isNaN(dateB)) return -1;

    return dateB - dateA;
  });
}

function NotificationRow({ notification }) {
  const type = getNotificationType(notification);
  const Icon = getIcon(type);
  const unread = isUnread(notification);

  return (
    <article className={`notification-row ${unread ? 'unread' : ''}`}>
      <div className={`notification-row-icon tone-${getTone(notification)}`}>
        <Icon size={18} />
      </div>

      <div className="notification-row-copy">
        <div>
          <h3>{getNotificationTitle(notification)}</h3>
          <p>{getNotificationMessage(notification)}</p>
        </div>

        <small>
          {formatLabel(type)} · {formatDate(getNotificationDate(notification))}
        </small>
      </div>

      <div className="notification-row-status">
        <StatusBadge tone={unread ? 'warning' : 'success'}>{unread ? 'unread' : 'read'}</StatusBadge>
        <StatusBadge tone={getTone(notification)}>{notification.status || type}</StatusBadge>
      </div>
    </article>
  );
}

export function NotificationsPage() {
  const { data, currentUser } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    type: 'all',
    status: 'all',
  });

  const notifications = sortNotifications(data.notifications || []);
  const canOpenSettings = hasAnyRole(currentUser, settingsAccessRoles);

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
    .filter((notification) => matchesSearch(notification, filters.query));

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      type: 'all',
      status: 'all',
    });
  };

  return (
    <AppLayout
      title="Notifications"
      subtitle="In-app alerts for bookings, cleaning, maintenance, billing, reports, inventory, and team activity."
    >
      <section className="stat-grid dense">
        <StatCard label="Total notifications" value={notifications.length} icon={Bell} />
        <StatCard label="Unread" value={unreadCount} icon={AlertTriangle} tone={unreadCount ? 'warning' : 'accent'} />
        <StatCard label="Maintenance alerts" value={maintenanceCount} icon={Wrench} />
        <StatCard label="Billing alerts" value={billingCount} icon={CreditCard} />
      </section>

      <section className="card notifications-toolbar">
        <div>
          <h3>Notification center</h3>
          <p>
            Workspace alerts for bookings, cleaning tasks, maintenance work orders, owner reports,
            billing, inventory, and team activity.
          </p>
        </div>

        <div className="notifications-toolbar-actions">
          {canOpenSettings && (
            <button type="button" onClick={() => navigate('/notification-settings')} data-skip-create-action="true">
              <Settings size={16} />
              Notification settings
            </button>
          )}

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      <section className="card">
        <div className="notifications-filters">
          <label className="notifications-search">
            <Search size={16} />
            <input
              placeholder="Search notifications by title, message, type, channel, or status..."
              value={filters.query}
              onChange={setFilter('query')}
              aria-label="Search notifications"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear notification search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Type
            <select value={filters.type} onChange={setFilter('type')}>
              <option value="all">All types</option>
              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="all">All statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
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
          <div className="notifications-list">
            {filteredNotifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </div>
        ) : (
          <EmptyState
            eyebrow="Notifications"
            icon={Bell}
            title={notifications.length ? 'No notifications match the current filters' : 'No notifications yet'}
            description={
              notifications.length
                ? 'Adjust the search, type, or status filters to view more notification records.'
                : 'PropFlow will show real workspace alerts here when bookings, cleaning tasks, maintenance work orders, billing updates, owner reports, inventory alerts, or team activity create notification records.'
            }
          />
        )}
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Provider status</h3>
              <p>Email, SMS, and WhatsApp providers planned for the MVP notification system.</p>
            </div>
          </div>

          <div className="notification-provider-summary">
            <span>
              <Mail size={18} />
              <strong>Email via Resend</strong>
              <small>Transactional email provider should be configured server-side.</small>
              <StatusBadge tone="warning">pending</StatusBadge>
            </span>

            <span>
              <Smartphone size={18} />
              <strong>SMS via Twilio</strong>
              <small>SMS notifications should use secure backend credentials.</small>
              <StatusBadge tone="warning">pending</StatusBadge>
            </span>

            <span>
              <MessageCircle size={18} />
              <strong>WhatsApp via Twilio</strong>
              <small>WhatsApp alerts should use secure backend credentials.</small>
              <StatusBadge tone="warning">pending</StatusBadge>
            </span>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Notification categories</h3>
              <p>Core alert types PropFlow should support at launch.</p>
            </div>
          </div>

          <div className="notification-category-grid">
            <span>
              <CalendarCheck size={16} />
              Bookings
            </span>
            <span>
              <CheckCircle2 size={16} />
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
            <span>
              <Package size={16} />
              Inventory alerts
            </span>
          </div>

          <div className="helper">
            Provider delivery logic should be added after the in-app notification records are stable.
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
