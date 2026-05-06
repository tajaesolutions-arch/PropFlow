import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';

export function NotificationsPage() {
  const { data } = useApp();
  const notifications = data.notifications || [];

  return (
    <AppLayout title="Notifications">
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Notification center</h3>
            <p>In-app alerts for bookings, cleaning, maintenance, owner reports, billing, and team activity.</p>
          </div>
        </div>

        {notifications.length ? (
          <div className="notification-list">
            {notifications.map((notification) => (
              <div className="notification" key={notification.id}>
                <StatusBadge tone={notification.tone}>{notification.type}</StatusBadge>
                <span>
                  {notification.message}
                  <small>{notification.time || notification.created_at || 'Just now'}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No notifications yet."
            description="PropFlow will show real workspace alerts here when bookings, cleaning tasks, maintenance work orders, billing updates, owner reports, or team activity create notification records. No fake notification data is shown."
          />
        )}
      </section>
    </AppLayout>
  );
}
