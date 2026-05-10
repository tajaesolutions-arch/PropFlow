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
  ShieldCheck,
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
import { notificationEventTypes, roles } from '../data/constants.js';
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
const workspaceNotificationRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const ownerNotificationTypes = new Set(['booking', 'maintenance', 'owner_report', 'system']);
const cleanerNotificationTypes = new Set(['cleaning', 'inventory_alert', 'system']);
const maintenanceNotificationTypes = new Set(['maintenance', 'system']);

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
  const eventType = notification.eventType || notification.event_type || notification.type || notification.category || 'workspace_activity';
  if (String(eventType).startsWith('booking_')) return 'booking';
  if (String(eventType).startsWith('cleaning_')) return 'cleaning';
  if (String(eventType).startsWith('maintenance_')) return 'maintenance';
  if (String(eventType).startsWith('owner_report_')) return 'owner_report';
  if (String(eventType).startsWith('billing_')) return 'billing';
  if (String(eventType).startsWith('team_') || String(eventType).startsWith('member_')) return 'team';
  if (eventType === 'low_stock_alert') return 'inventory_alert';
  return 'system';
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

function getRecipientId(notification) {
  return notification.recipientUserId || notification.recipient_user_id || notification.user_id || notification.userId || notification.recipient_id || notification.recipientId || notification.assigned_to || notification.assignedTo || '';
}

function getEventTypeLabel(notification) {
  const eventType = notification.eventType || notification.event_type || notification.type || 'workspace_activity';
  return notificationEventTypes.find(([value]) => value === eventType)?.[1] || formatLabel(eventType);
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

function matchesRoleType(type, currentUser) {
  if (hasAnyRole(currentUser, workspaceNotificationRoles)) return true;
  if (hasAnyRole(currentUser, [roles.OWNER])) return ownerNotificationTypes.has(type);
  if (hasAnyRole(currentUser, [roles.CLEANER])) return cleanerNotificationTypes.has(type);
  if (hasAnyRole(currentUser, [roles.MAINTENANCE])) return maintenanceNotificationTypes.has(type);

  return false;
}

function getVisibleNotificationTypes(currentUser) {
  if (hasAnyRole(currentUser, workspaceNotificationRoles)) return notificationTypes;
  if (hasAnyRole(currentUser, [roles.OWNER])) return notificationTypes.filter((type) => ownerNotificationTypes.has(type));
  if (hasAnyRole(currentUser, [roles.CLEANER])) return notificationTypes.filter((type) => cleanerNotificationTypes.has(type));
  if (hasAnyRole(currentUser, [roles.MAINTENANCE])) return notificationTypes.filter((type) => maintenanceNotificationTypes.has(type));

  return ['system'];
}

function isLimitedPortalRole(currentUser) {
  return hasAnyRole(currentUser, [roles.OWNER, roles.CLEANER, roles.MAINTENANCE]);
}

function isVisibleNotification(notification, currentUser) {
  const recipientId = getRecipientId(notification);
  const type = getNotificationType(notification);

  if (recipientId && currentUser?.id) {
    return recipientId === currentUser.id && matchesRoleType(type, currentUser);
  }

  if (isLimitedPortalRole(currentUser)) {
    return type === 'system';
  }

  return matchesRoleType(type, currentUser);
}

function getVisibilityCopy(currentUser) {
  if (hasAnyRole(currentUser, workspaceNotificationRoles)) {
    return 'Workspace notification records are visible for this role.';
  }

  if (hasAnyRole(currentUser, [roles.OWNER])) {
    return 'Owner users see direct owner notifications and general system alerts only.';
  }

  if (hasAnyRole(currentUser, [roles.CLEANER])) {
    return 'Cleaner users see direct cleaning notifications and general system alerts only.';
  }

  if (hasAnyRole(currentUser, [roles.MAINTENANCE])) {
    return 'Maintenance users see direct maintenance notifications and general system alerts only.';
  }

  return 'Notification visibility is limited for this role.';
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

function NotificationRow({ notification, onMarkRead, onArchive }) {
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
          {getEventTypeLabel(notification)} · {formatDate(getNotificationDate(notification))}
        </small>
      </div>

      <div className="notification-row-status">
        <StatusBadge tone={unread ? 'warning' : 'success'}>{unread ? 'unread' : 'read'}</StatusBadge>
        <StatusBadge tone={getTone(notification)}>{notification.priority || notification.status || type}</StatusBadge>
        <button type="button" onClick={() => onMarkRead(notification, unread)} data-skip-create-action="true">
          {unread ? 'Mark read' : 'Mark unread'}
        </button>
        <button type="button" onClick={() => onArchive(notification)} data-skip-create-action="true">
          Archive
        </button>
      </div>
    </article>
  );
}

export function NotificationsPage() {
  const { data, currentUser, markNotificationRead, archiveNotification } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    type: 'all',
    status: 'all',
  });

  const canOpenSettings = hasAnyRole(currentUser, settingsAccessRoles);
  const canSeeProviderDetails = hasAnyRole(currentUser, settingsAccessRoles);
  const visibleTypes = getVisibleNotificationTypes(currentUser);
  const notifications = sortNotifications((data.notifications || []).filter((notification) => isVisibleNotification(notification, currentUser)));

  React.useEffect(() => {
    if (filters.type !== 'all' && !visibleTypes.includes(filters.type)) {
      setFilters((current) => ({ ...current, type: 'all' }));
    }
  }, [filters.type, visibleTypes]);

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

  const handleMarkRead = async (notification, read = true) => {
    try {
      await markNotificationRead(notification.id, read);
    } catch (notificationError) {
      console.warn('[PropFlow] Could not update notification read state', notificationError);
    }
  };

  const handleArchive = async (notification) => {
    try {
      await archiveNotification(notification.id, true);
    } catch (notificationError) {
      console.warn('[PropFlow] Could not archive notification', notificationError);
    }
  };

  return (
    <AppLayout
      title="Notifications"
      subtitle="Role-safe in-app alerts for visible bookings, cleaning, maintenance, reports, inventory, and team activity."
    >
      <section className="card notification-warning-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Notification visibility</p>
            <h3>Notifications are filtered for this role</h3>
            <p>{getVisibilityCopy(currentUser)}</p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>
      </section>

      <section className="stat-grid dense">
        <StatCard label="Visible notifications" value={notifications.length} icon={Bell} />
        <StatCard label="Unread" value={unreadCount} icon={AlertTriangle} tone={unreadCount ? 'warning' : 'accent'} />
        <StatCard label="Maintenance alerts" value={maintenanceCount} icon={Wrench} />
        <StatCard label="Billing alerts" value={canSeeProviderDetails ? billingCount : 'Hidden'} icon={CreditCard} />
      </section>

      <section className="card notifications-toolbar">
        <div>
          <h3>Notification center</h3>
          <p>
            In-app alerts for visible records only. Email, SMS, and WhatsApp delivery are not active yet.
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

      <section className="card notification-warning-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Delivery status</p>
            <h3>External notification delivery is pending backend setup</h3>
            <p>
              This page displays in-app notification records only. External delivery, provider retries, and sent-message status should be connected in a later backend notification phase.
            </p>
          </div>
          <AlertTriangle size={22} className="muted" />
        </div>
      </section>

      <section className="card">
        <div className="notifications-filters">
          <label className="notifications-search">
            <Search size={16} />
            <input
              placeholder="Search visible in-app notifications by title, message, type, channel, or status..."
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
              <option value="all">All visible types</option>
              {visibleTypes.map((type) => (
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
            <p>Visible notification records shown inside PropFlow. External delivery is not connected yet.</p>
          </div>

          <StatusBadge tone="info">{filteredNotifications.length} shown</StatusBadge>
        </div>

        {filteredNotifications.length ? (
          <div className="notifications-list">
            {filteredNotifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onMarkRead={handleMarkRead} onArchive={handleArchive} />
            ))}
          </div>
        ) : (
          <EmptyState
            eyebrow="Notifications"
            icon={Bell}
            title={notifications.length ? 'No visible notifications match the current filters' : 'No visible notifications yet'}
            description={
              notifications.length
                ? 'Adjust the search, type, or status filters to view more visible in-app notification records.'
                : 'PropFlow will show role-safe in-app alerts here when visible records create notification entries. Email, SMS, and WhatsApp delivery are not active yet.'
            }
          />
        )}
      </section>

      <section className="panel-grid two">
        {canSeeProviderDetails ? (
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
        ) : (
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Delivery status</h3>
                <p>External delivery is not active yet. This role sees in-app notifications only.</p>
              </div>
            </div>

            <div className="helper">
              Email, SMS, and WhatsApp setup details are managed by authorized workspace administrators.
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Visible notification categories</h3>
              <p>Alert types available for this role.</p>
            </div>
          </div>

          <div className="notification-category-grid">
            {visibleTypes.includes('booking') && (
              <span>
                <CalendarCheck size={16} />
                Bookings
              </span>
            )}
            {visibleTypes.includes('cleaning') && (
              <span>
                <CheckCircle2 size={16} />
                Cleaning
              </span>
            )}
            {visibleTypes.includes('maintenance') && (
              <span>
                <Wrench size={16} />
                Maintenance
              </span>
            )}
            {visibleTypes.includes('billing') && (
              <span>
                <CreditCard size={16} />
                Billing
              </span>
            )}
            {visibleTypes.includes('team') && (
              <span>
                <Users size={16} />
                Team activity
              </span>
            )}
            {visibleTypes.includes('owner_report') && (
              <span>
                <Bell size={16} />
                Owner reports
              </span>
            )}
            {visibleTypes.includes('inventory_alert') && (
              <span>
                <Package size={16} />
                Inventory alerts
              </span>
            )}
            {visibleTypes.includes('system') && (
              <span>
                <ShieldCheck size={16} />
                System
              </span>
            )}
          </div>

          <div className="helper">
            Provider delivery logic should be added after the in-app notification records are stable.
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
