import React from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const managerRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const ownerViewRoles = [roles.OWNER];

const reportPlaceholders = [
  {
    title: 'Owner reports',
    description: 'Owner statements, assigned-property summaries, owner payout, maintenance, and cleaning history.',
    icon: FileText,
    roles: [...managerRoles, ...ownerViewRoles],
  },
  {
    title: 'Revenue reports',
    description: 'Booking revenue, payment status, direct-booking revenue, and property-level totals.',
    icon: BarChart3,
    roles: managerRoles,
  },
  {
    title: 'Expense reports',
    description: 'Cleaning costs, maintenance costs, supplies, taxes, platform fees, and tracked operating expenses.',
    icon: FileSpreadsheet,
    roles: managerRoles,
  },
  {
    title: 'Occupancy reports',
    description: 'Booked nights, available nights, occupancy rate, check-ins, and check-outs.',
    icon: BarChart3,
    roles: [...managerRoles, ...ownerViewRoles],
  },
];

function getVisiblePlaceholders(currentUser) {
  return reportPlaceholders.filter((item) => hasAnyRole(currentUser, item.roles));
}

export function ReportsExportNotice() {
  const { currentUser } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const visiblePlaceholders = getVisiblePlaceholders(currentUser);
  const canManageReports = hasAnyRole(currentUser, managerRoles);

  return (
    <section className="card reports-export-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Reports and exports</p>
          <h3>Safe export readiness status</h3>
          <p>
            Reports use current workspace data where available. CSV export and browser print-to-PDF are available from role-authorized workspace rows where data exists.
            Scheduled owner reports, email delivery, and stored generated PDFs remain intentionally out of scope.
          </p>
        </div>
        <Download size={22} className="muted" />
      </div>

      <div className="reports-export-grid">
        <div className="reports-export-status-card">
          <FileSpreadsheet size={18} />
          <span>
            <strong>CSV export</strong>
            <small>Client-side CSV export is available where the current role already has visible rows.</small>
          </span>
          <StatusBadge tone="success">available</StatusBadge>
        </div>

        <div className="reports-export-status-card">
          <FileText size={18} />
          <span>
            <strong>PDF export</strong>
            <small>Browser print-to-PDF opens a styled printable report view without storing public links.</small>
          </span>
          <StatusBadge tone="success">print ready</StatusBadge>
        </div>

        <div className="reports-export-status-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>
              {canManageReports
                ? 'This role can view operational/financial report placeholders.'
                : 'This role should only see assigned-property report information.'}
            </small>
          </span>
          <StatusBadge tone="info">{primaryRole || 'role checked'}</StatusBadge>
        </div>
      </div>

      <div className="reports-placeholder-grid" aria-label="Report placeholders by role">
        {visiblePlaceholders.map((item) => {
          const Icon = item.icon;

          return (
            <div className="reports-placeholder-card" key={item.title}>
              <Icon size={17} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <StatusBadge tone="info">safe MVP</StatusBadge>
            </div>
          );
        })}
      </div>

      <div className="helper reports-export-helper">
        <LockKeyhole size={16} />
        Exports remain workspace-scoped and role-safe; backend scheduled delivery and stored PDFs can be added later without public links.
      </div>
    </section>
  );
}
