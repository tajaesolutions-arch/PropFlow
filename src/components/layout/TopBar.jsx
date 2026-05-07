import React from 'react';
import { Bell, Menu } from 'lucide-react';

import { SearchBox } from '../SearchBox.jsx';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher.jsx';
import { AccountMenu } from '../AccountMenu.jsx';
import { navigate } from '../../routes/AppRouter.jsx';

export function TopBar({
  title = 'Dashboard',
  subtitle = 'Workspace-scoped operational command center',
  setMobileOpen,
}) {
  const [dateRange, setDateRange] = React.useState('last_30_days');

  const openMobileMenu = () => {
    if (typeof setMobileOpen === 'function') {
      setMobileOpen(true);
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
        >
          <Menu size={20} />
        </button>

        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <SearchBox />

      <label className="topbar-filter">
        <span className="sr-only">Date range</span>
        <select
          className="date-filter"
          value={dateRange}
          onChange={(event) => setDateRange(event.target.value)}
          aria-label="Dashboard date range"
        >
          <option value="last_30_days">Last 30 days</option>
          <option value="this_month">This month</option>
          <option value="quarter_to_date">Quarter to date</option>
          <option value="year_to_date">Year to date</option>
        </select>
      </label>

      <WorkspaceSwitcher />

      <button
        type="button"
        className="icon-btn"
        onClick={() => navigate('/notifications')}
        aria-label="Open notifications"
      >
        <Bell size={18} />
      </button>

      <AccountMenu />
    </header>
  );
}
