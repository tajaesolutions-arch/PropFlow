import React from 'react';
import { Bell, CalendarDays, Menu } from 'lucide-react';

import { SearchBox } from '../SearchBox.jsx';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher.jsx';
import { AccountMenu } from '../AccountMenu.jsx';
import { navigate } from '../../routes/AppRouter.jsx';

const dateRangeStorageKey = 'propflow.dashboardDateRange';

function getInitialDateRange() {
  if (typeof window === 'undefined') return 'last_30_days';

  return window.localStorage.getItem(dateRangeStorageKey) || 'last_30_days';
}

export function TopBar({
  title = 'Dashboard',
  subtitle = 'Workspace-scoped operational command center',
  setMobileOpen,
}) {
  const [dateRange, setDateRange] = React.useState(getInitialDateRange);

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

      <button
        type="button"
        className="icon-btn topbar-notification-btn"
        onClick={() => navigate('/notifications')}
        aria-label="Open notifications"
        data-skip-create-action="true"
      >
        <Bell size={18} />
        <span className="notification-dot" aria-hidden="true" />
      </button>

      <AccountMenu />
    </header>
  );
}
