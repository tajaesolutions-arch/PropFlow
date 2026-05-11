import React from 'react';
import { Archive, Bell, CalendarDays, Check, Menu } from 'lucide-react';

import { SearchBox } from '../SearchBox.jsx';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher.jsx';
import { AccountMenu } from '../AccountMenu.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { navigate } from '../../routes/AppRouter.jsx';

const dateRangeStorageKey = 'propflow.dashboardDateRange';

function getInitialDateRange() {
  if (typeof window === 'undefined') return 'last_30_days';

  return window.localStorage.getItem(dateRangeStorageKey) || 'last_30_days';
}

function isUnreadNotification(notification) {
  return notification?.status === 'unread' && !notification?.read_at && !notification?.readAt && !notification?.archived_at && !notification?.archivedAt;
}

function isArchivedNotification(notification) {
  return notification?.status === 'archived' || Boolean(notification?.archived_at || notification?.archivedAt);
}

export function TopBar({
  title = 'Dashboard',
  subtitle = 'Workspace-scoped operational command center',
  setMobileOpen,
}) {
  const { data, currentUser, markNotificationRead, archiveNotification } = useApp();
  const [dateRange, setDateRange] = React.useState(getInitialDateRange);
  const notifications = React.useMemo(() => (Array.isArray(data?.notifications) ? data.notifications.filter((item) => !isArchivedNotification(item) && (item.recipient_user_id || item.recipientUserId) === currentUser?.id) : []), [data?.notifications, currentUser?.id]);
  const recentNotifications = React.useMemo(() => notifications.slice(0, 5), [notifications]);
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const unreadNotifications = Number.isFinite(data?.unreadNotificationCount)
    ? data.unreadNotificationCount
    : notifications.filter(isUnreadNotification).length;
  const notificationLabel = unreadNotifications
    ? `Open notifications. ${unreadNotifications} unread alert${unreadNotifications === 1 ? '' : 's'}.`
    : 'Open notifications. No unread alerts.';

  React.useEffect(() => {
    window.localStorage.setItem(dateRangeStorageKey, dateRange);
  }, [dateRange]);

  const openMobileMenu = () => {
    if (typeof setMobileOpen === 'function') {
      setMobileOpen(true);
    }
  };

  const handleDateRangeChange = (event) => {
    setDateRange(event.target.value);
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

  const openNotificationAction = (notification) => {
    const url = notification.actionUrl || notification.action_url;
    if (url && String(url).startsWith('/')) {
      setNotificationOpen(false);
      navigate(url);
    }
  };

  return (
    <header className="topbar">
      <div className="title-wrap">
        <button
          type="button"
          className="mobile-menu"
          onClick={openMobileMenu}
          aria-label="Open navigation menu"
          data-skip-create-action="true"
        >
          <Menu size={20} />
        </button>

        <div className="topbar-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <SearchBox />

      <label className="topbar-filter topbar-date-filter">
        <span className="sr-only">Date range</span>
        <CalendarDays size={16} aria-hidden="true" />
        <select
          className="date-filter"
          value={dateRange}
          onChange={handleDateRangeChange}
          aria-label="Dashboard date range"
        >
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="this_month">This month</option>
          <option value="quarter_to_date">Quarter to date</option>
          <option value="year_to_date">Year to date</option>
        </select>
      </label>

      <WorkspaceSwitcher />

      <div className="topbar-notification-wrap">
        <button
          type="button"
          className={`icon-btn topbar-notification-btn ${unreadNotifications ? 'has-alerts' : ''}`}
          onClick={() => setNotificationOpen((value) => !value)}
          aria-label={notificationLabel}
          aria-expanded={notificationOpen}
          data-skip-create-action="true"
        >
          <Bell size={18} aria-hidden="true" />
          {unreadNotifications ? (
            <span className="notification-count" aria-hidden="true">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          ) : null}
        </button>

        {notificationOpen && (
          <div className="notification-dropdown" role="dialog" aria-label="Recent notifications">
            <div className="notification-dropdown-header">
              <span>
                <strong>Notifications</strong>
                <small>{unreadNotifications} unread</small>
              </span>
              <button type="button" onClick={() => { setNotificationOpen(false); navigate('/notifications'); }} data-skip-create-action="true">View all</button>
            </div>

            {recentNotifications.length ? (
              <div className="notification-dropdown-list">
                {recentNotifications.map((notification) => {
                  const unread = isUnreadNotification(notification);
                  const eventType = notification.eventType || notification.event_type || notification.type || 'workspace_activity';
                  return (
                    <article className={`notification-dropdown-item ${unread ? 'unread' : ''}`} key={notification.id}>
                      <button type="button" className="notification-dropdown-copy" onClick={() => openNotificationAction(notification)} data-skip-create-action="true">
                        <strong>{notification.title || 'Workspace notification'}</strong>
                        <span>{notification.body || notification.message || 'Open notification details.'}</span>
                        <small>{eventType.replaceAll('_', ' ')} · {new Date(notification.createdAt || notification.created_at || Date.now()).toLocaleString()}</small>
                      </button>
                      <div className="notification-dropdown-actions">
                        <button type="button" onClick={() => handleMarkRead(notification, unread)} title={unread ? 'Mark read' : 'Mark unread'} aria-label={unread ? 'Mark notification as read' : 'Mark notification as unread'} data-skip-create-action="true">
                          <Check size={14} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => handleArchive(notification)} title="Archive" aria-label="Archive notification" data-skip-create-action="true">
                          <Archive size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="notification-dropdown-empty">No in-app notifications yet.</div>
            )}
          </div>
        )}
      </div>

      <AccountMenu />
    </header>
  );
}
