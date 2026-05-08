import React from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

const expenseCategories = [
  'Cleaning',
  'Maintenance',
  'Supplies',
  'Utilities',
  'Owner payout',
  'Platform fee',
  'Other',
];

function hasRole(currentUser, role) {
  return Boolean(currentUser?.roles?.includes(role));
}

function canSeeWorkspaceExpensePage(currentUser) {
  return [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT].some((role) =>
    hasRole(currentUser, role),
  );
}

function SafeFinanceCard({ icon: Icon, title, description, badge = 'placeholder' }) {
  return (
    <article className="card finance-safety-card">
      <div className="finance-safety-card-icon">
        <Icon size={18} />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <StatusBadge tone="info">{badge}</StatusBadge>
    </article>
  );
}

export function ExpensesPage() {
  const { currentUser } = useApp();
  const canAccessFinance = canSeeWorkspaceExpensePage(currentUser);

  if (!canAccessFinance) {
    return (
      <AppLayout
        title="Expenses"
        subtitle="Role-safe expense visibility for permitted finance and operations users."
      >
        <EmptyState
          eyebrow="Access protected"
          icon={ShieldCheck}
          title="Expense details are not available for this role"
          description="Cleaners and maintenance users should not see workspace expenses, owner payouts, revenue, net profit, or broad finance reports."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Expenses"
      subtitle="Placeholder-safe expense tracking for cleaning costs, maintenance costs, supplies, owner payouts, and finance reporting."
    >
      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Finance safety</p>
            <h3>Expense tracking is placeholder-safe</h3>
            <p>
              This page does not create expense records, payment records, accounting entries, CSV files, or PDF files yet. Backend finance storage and export generation should be connected in a later PR.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>

        <div className="helper">
          No Supabase schema changes, RLS changes, fake expenses, payment writes, CSV export, or PDF export are active here.
        </div>
      </section>

      <section className="finance-safety-grid">
        <SafeFinanceCard
          icon={Receipt}
          title="Expense records"
          description="Expense records will appear after real finance tables and safe write logic are added."
        />
        <SafeFinanceCard
          icon={ClipboardList}
          title="Cleaning cost visibility"
          description="Cleaning costs will appear here once expense tracking is connected."
        />
        <SafeFinanceCard
          icon={Wrench}
          title="Maintenance cost visibility"
          description="Maintenance costs will appear here once expense tracking is connected."
        />
        <SafeFinanceCard
          icon={Building2}
          title="Owner payout visibility"
          description="Owner payout details will appear here once finance reporting is connected."
        />
      </section>

      <section className="card reports-toolbar finance-actions-toolbar">
        <div>
          <h3>Expense actions</h3>
          <p>Add Expense, CSV export, and PDF export are intentionally disabled until finance records are safely stored.</p>
        </div>

        <div className="reports-toolbar-actions">
          <button type="button" className="primary" disabled data-skip-create-action="true">
            <Plus size={16} />
            Add Expense disabled
          </button>
          <button type="button" disabled data-skip-create-action="true">
            <Download size={16} />
            CSV disabled
          </button>
          <button type="button" disabled data-skip-create-action="true">
            <FileText size={16} />
            PDF disabled
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Expense list</h3>
            <p>Safe empty state for workspace expense records.</p>
          </div>
          <StatusBadge tone="warning">not connected</StatusBadge>
        </div>

        <DataTable
          rows={[]}
          columns={[
            { key: 'title', label: 'Expense' },
            { key: 'category', label: 'Category' },
            { key: 'property', label: 'Property' },
            { key: 'amount', label: 'Amount' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status' },
          ]}
          empty={{
            eyebrow: 'Expenses',
            title: 'No expenses added yet',
            description:
              'Expense tracking is being prepared for this workspace. You’ll be able to track cleaning costs, maintenance costs, supplies, owner payouts, receipts, and reports here. This is a safe placeholder. No expense or payment records are created yet.',
          }}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Expense categories</h3>
            <p>Safe category placeholders only. Uncategorized records should display as “Uncategorized” once real records exist.</p>
          </div>
          <AlertTriangle size={20} className="muted" />
        </div>

        <div className="finance-category-grid">
          {expenseCategories.map((category) => (
            <span key={category} className="finance-category-pill">
              {category}
            </span>
          ))}
          <span className="finance-category-pill muted-pill">Uncategorized</span>
        </div>
      </section>

      <section className="card finance-mobile-note">
        <div className="card-header">
          <div>
            <h3>Mobile finance list safety</h3>
            <p>Finance tables are kept readable on small screens through horizontal table scrolling and compact card spacing.</p>
          </div>
          <CalendarDays size={20} className="muted" />
        </div>
      </section>
    </AppLayout>
  );
}
