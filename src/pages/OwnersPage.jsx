import React from 'react';
import {
  Banknote,
  Building2,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { roles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { navigate } from '../routes/AppRouter.jsx';

const closedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);

const ownerManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const ownerInviteRoles = [roles.OWNER_ADMIN];
const ownerFinanceRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.ACCOUNTANT];

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function getPropertyOwnerId(property) {
  return (
    property.assignedOwnerId ||
    property.assigned_owner_id ||
    property.ownerId ||
    property.owner_id ||
    ''
  );
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getBookingAmount(booking) {
  return toNumber(booking.totalAmount || booking.total_amount || booking.amount);
}

function getOwnerPayout(booking) {
  return toNumber(booking.ownerPayout || booking.owner_payout);
}

function getMaintenanceCost(workOrder) {
  return toNumber(
    workOrder.actualCost ||
      workOrder.actual_cost ||
      workOrder.estimatedCost ||
      workOrder.estimated_cost,
  );
}

function getCleaningCost(task) {
  return toNumber(
    task.actualCost ||
      task.actual_cost ||
      task.estimatedCost ||
      task.estimated_cost ||
      task.cleaningFee ||
      task.cleaning_fee,
  );
}

function getMemberId(member) {
  return member.user_id || member.userId || member.id;
}

function getMemberName(member) {
  return (
    member.profile?.full_name ||
    member.profiles?.full_name ||
    member.full_name ||
    member.profile?.email ||
    member.profiles?.email ||
    member.email ||
    member.user_id ||
    'Property owner'
  );
}

function getMemberEmail(member) {
  return member.profile?.email || member.profiles?.email || member.email || '—';
}

function getContactName(contact) {
  return contact.full_name || contact.fullName || contact.name || 'Property owner';
}

function getContactEmail(contact) {
  return contact.email || '—';
}

function getContactPhone(contact) {
  return contact.phone || contact.phone_number || '—';
}

function isOwnerMember(member) {
  return Array.isArray(member.roles) && member.roles.includes(roles.OWNER);
}

function isOwnerContact(contact) {
  return ['owner', 'property_owner'].includes(contact.contact_type || contact.contactType);
}

function getOwnerInitials(owner) {
  return String(owner?.name || 'PO')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function buildOwnerMap({ properties, members, contacts }) {
  const ownerMap = new Map();

  members.filter(isOwnerMember).forEach((member) => {
    const id = getMemberId(member);

    if (!id) return;

    ownerMap.set(id, {
      id,
      name: getMemberName(member),
      email: getMemberEmail(member),
      phone: '—',
      source: 'workspace member',
      status: member.status || 'active',
      notes: '',
      properties: [],
      contactRecord: null,
      memberRecord: member,
    });
  });

  contacts.filter(isOwnerContact).forEach((contact) => {
    const id = contact.id || contact.email || getContactName(contact);

    if (!id) return;

    if (ownerMap.has(id)) {
      const existing = ownerMap.get(id);
      ownerMap.set(id, {
        ...existing,
        name: existing.name || getContactName(contact),
        email: existing.email || getContactEmail(contact),
        phone: getContactPhone(contact),
        notes: existing.notes || contact.notes || '',
        contactRecord: contact,
      });
      return;
    }

    ownerMap.set(id, {
      id,
      name: getContactName(contact),
      email: getContactEmail(contact),
      phone: getContactPhone(contact),
      source: 'contact',
      status: contact.status || 'active',
      notes: contact.notes || '',
      properties: [],
      contactRecord: contact,
      memberRecord: null,
    });
  });

  properties.forEach((property) => {
    const ownerId = getPropertyOwnerId(property);

    if (!ownerId) return;

    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, {
        id: ownerId,
        name: 'Assigned owner',
        email: '—',
        phone: '—',
        source: 'property assignment',
        status: 'active',
        properties: [],
        contactRecord: null,
        memberRecord: null,
      });
    }

    ownerMap.get(ownerId).properties.push(property);
  });

  return ownerMap;
}

function buildOwnerRows({
  properties,
  bookings,
  cleaningTasks,
  maintenanceWorkOrders,
  members,
  contacts,
  currency,
}) {
  const ownerMap = buildOwnerMap({ properties, members, contacts });

  return Array.from(ownerMap.values()).map((owner) => {
    const propertyIds = new Set(owner.properties.map((property) => property.id));

    const ownerBookings = bookings.filter(
      (booking) => propertyIds.has(getPropertyId(booking)) && !cancelledStatuses.has(booking.status),
    );

    const ownerCleaningTasks = cleaningTasks.filter((task) => propertyIds.has(getPropertyId(task)));

    const ownerMaintenance = maintenanceWorkOrders.filter((workOrder) =>
      propertyIds.has(getPropertyId(workOrder)),
    );

    const grossRevenue = ownerBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
    const ownerPayout = ownerBookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
    const maintenanceCosts = ownerMaintenance.reduce(
      (sum, workOrder) => sum + getMaintenanceCost(workOrder),
      0,
    );
    const cleaningCosts = ownerCleaningTasks.reduce((sum, task) => sum + getCleaningCost(task), 0);
    const expenses = maintenanceCosts + cleaningCosts;
    const netProfit = grossRevenue - expenses;
    const openMaintenance = ownerMaintenance.filter(
      (workOrder) => !closedStatuses.has(workOrder.status),
    ).length;

    return {
      ...owner,
      propertyCount: owner.properties.length,
      propertyNames: owner.properties.map((property) => property.name).join(', ') || 'No properties assigned',
      grossRevenue,
      expenses,
      netProfit,
      ownerPayout,
      openMaintenance,
      bookingCount: ownerBookings.length,
      reportCount: 0,
      currency,
    };
  });
}

function OwnerCard({ owner, canSeeOwnerFinance }) {
  return (
    <article className="card owner-card">
      <div className="owner-card-top">
        <div className="owner-avatar" aria-hidden="true">
          {getOwnerInitials(owner) || 'PO'}
        </div>

        <StatusBadge>{owner.status || 'active'}</StatusBadge>
      </div>

      <div>
        <h3>{owner.name}</h3>
        <p>{owner.email}</p>
      </div>

      <div className="owner-card-meta">
        <span>
          <strong>{owner.propertyCount}</strong>
          <small>Properties</small>
        </span>

        {canSeeOwnerFinance ? (
          <>
            <span>
              <strong>{formatCurrency(owner.grossRevenue, owner.currency)}</strong>
              <small>Revenue</small>
            </span>

            <span>
              <strong>{formatCurrency(owner.ownerPayout, owner.currency)}</strong>
              <small>Payout</small>
            </span>
          </>
        ) : (
          <span>
            <strong>Hidden</strong>
            <small>Owner finance</small>
          </span>
        )}

        <span>
          <strong>{owner.openMaintenance}</strong>
          <small>Open repairs</small>
        </span>
      </div>

      <div className="owner-card-properties">
        <strong>Assigned properties</strong>
        <p>{owner.propertyNames}</p>
      </div>

      <div className="owner-card-actions">
        <button type="button" onClick={() => navigate('/reports')} data-skip-create-action="true">
          <FileText size={16} />
          Reports
        </button>

        <button type="button" onClick={() => navigate('/properties')} data-skip-create-action="true">
          <Building2 size={16} />
          Properties
        </button>
      </div>
    </article>
  );
}

function getOwnerTableColumns(canSeeOwnerFinance) {
  const columns = [
    {
      key: 'name',
      label: 'Owner',
      render: (row) => (
        <span>
          <strong>{row.name}</strong>
          <small>{row.email}</small>
        </span>
      ),
    },
    {
      key: 'propertyCount',
      label: 'Properties',
    },
    {
      key: 'propertyNames',
      label: 'Assigned properties',
    },
  ];

  if (canSeeOwnerFinance) {
    columns.push(
      {
        key: 'grossRevenue',
        label: 'Revenue',
        render: (row) => formatCurrency(row.grossRevenue, row.currency),
      },
      {
        key: 'expenses',
        label: 'Expenses',
        render: (row) => formatCurrency(row.expenses, row.currency),
      },
      {
        key: 'netProfit',
        label: 'Net profit',
        render: (row) => formatCurrency(row.netProfit, row.currency),
      },
      {
        key: 'ownerPayout',
        label: 'Owner payout',
        render: (row) => formatCurrency(row.ownerPayout, row.currency),
      },
    );
  }

  columns.push(
    {
      key: 'openMaintenance',
      label: 'Open repairs',
      render: (row) =>
        row.openMaintenance ? (
          <StatusBadge tone="warning">{row.openMaintenance} open</StatusBadge>
        ) : (
          <StatusBadge tone="success">clear</StatusBadge>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge>{row.status}</StatusBadge>,
    },
  );

  return columns;
}

export function OwnersPage() {
  const { data, currentWorkspace, currentUser } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    source: 'all',
    status: 'all',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const canManageOwners = hasAnyRole(currentUser, ownerManagerRoles);
  const canInviteOwners = hasAnyRole(currentUser, ownerInviteRoles);
  const canSeeOwnerFinance = hasAnyRole(currentUser, ownerFinanceRoles);

  const properties = data.properties || [];
  const bookings = data.bookings || [];
  const cleaningTasks = data.cleaningTasks || [];
  const maintenanceWorkOrders = data.maintenanceWorkOrders || [];
  const members = data.members || [];
  const contacts = data.contacts || [];
  const reports = data.ownerReports || [];

  const ownerRows = buildOwnerRows({
    properties,
    bookings,
    cleaningTasks,
    maintenanceWorkOrders,
    members,
    contacts,
    currency,
  }).sort((a, b) => b.grossRevenue - a.grossRevenue);

  const ownerRowsWithReports = ownerRows.map((owner) => {
    const reportCount = reports.filter((report) => {
      const ownerId = report.owner_id || report.ownerId || report.contact_id || report.contactId;
      return ownerId === owner.id;
    }).length;

    return {
      ...owner,
      reportCount,
    };
  });

  const totalOwners = ownerRowsWithReports.length;
  const assignedProperties = properties.filter((property) => Boolean(getPropertyOwnerId(property))).length;
  const unassignedProperties = properties.filter((property) => !getPropertyOwnerId(property)).length;
  const totalOwnerPayouts = ownerRowsWithReports.reduce((sum, owner) => sum + owner.ownerPayout, 0);
  const openMaintenance = ownerRowsWithReports.reduce((sum, owner) => sum + owner.openMaintenance, 0);
  const totalRevenue = ownerRowsWithReports.reduce((sum, owner) => sum + owner.grossRevenue, 0);

  const sources = [...new Set(ownerRowsWithReports.map((owner) => owner.source).filter(Boolean))];
  const statuses = [...new Set(ownerRowsWithReports.map((owner) => owner.status).filter(Boolean))];

  const filteredOwners = ownerRowsWithReports
    .filter((owner) => filters.source === 'all' || owner.source === filters.source)
    .filter((owner) => filters.status === 'all' || owner.status === filters.status)
    .filter((owner) => {
      const searchText = [
        owner.name,
        owner.email,
        owner.phone,
        owner.source,
        owner.status,
        owner.propertyNames,
        owner.notes,
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

  const clearFilters = () => {
    setFilters({
      query: '',
      source: 'all',
      status: 'all',
    });
  };

  return (
    <AppLayout
      title="Owners"
      subtitle={canSeeOwnerFinance
        ? 'Owner records, assigned properties, payouts, reports, and property health.'
        : 'Owner records, assigned properties, reports, and property health. Owner finance values are hidden for this role.'}
    >
      {!canSeeOwnerFinance && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Owner finance visibility</p>
              <h3>Owner payout and profit details are hidden</h3>
              <p>
                Host users can review owner records, assigned properties, reports, and open maintenance context, but owner payout, revenue, expenses, and net profit values are reserved for workspace owners, property managers, and accountant roles.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Owner records" value={totalOwners} icon={Users} />
        <StatCard
          label="Assigned properties"
          value={assignedProperties}
          subtitle={`${unassignedProperties} unassigned`}
          icon={Building2}
        />
        {canSeeOwnerFinance ? (
          <StatCard
            label="Owner payouts"
            value={formatCurrency(totalOwnerPayouts, currency)}
            subtitle={`${formatCurrency(totalRevenue, currency)} gross revenue`}
            icon={Banknote}
          />
        ) : (
          <StatCard
            label="Owner finance"
            value="Hidden"
            subtitle="Reserved for finance-approved roles"
            icon={Banknote}
          />
        )}
        <StatCard
          label="Open maintenance"
          value={openMaintenance}
          icon={Wrench}
          tone={openMaintenance ? 'warning' : 'accent'}
        />
      </section>

      <section className="card owners-toolbar">
        <div>
          <h3>Owner management</h3>
          <p>
            Owner contacts are CRM records. Owner portal access is controlled through workspace
            member invites, and assigned_owner_id points to invited owner members rather than CRM contacts.
          </p>
        </div>

        <div className="owners-toolbar-actions">
          {canManageOwners && (
            <button type="button" className="primary" data-create-action="owner">
              <Plus size={16} />
              Add Owner
            </button>
          )}

          {canInviteOwners && (
            <button type="button" data-create-action="invite">
              Invite Owner
            </button>
          )}

          {!canManageOwners && !canInviteOwners && (
            <span className="helper">Owner management actions are restricted to workspace owners and property managers.</span>
          )}

          <button type="button" onClick={() => navigate('/reports')} data-skip-create-action="true">
            Owner Reports
          </button>
        </div>
      </section>

      <section className="card">
        <div className="owners-filters">
          <label className="owners-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search owner, email, phone, property, notes, source, or status..."
              aria-label="Search owners"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear owner search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Source
            <select value={filters.source} onChange={setFilter('source')}>
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {formatLabel(source)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {filteredOwners.length ? (
        <>
          <section className="owners-card-grid">
            {filteredOwners.slice(0, 6).map((owner) => (
              <OwnerCard key={owner.id} owner={owner} canSeeOwnerFinance={canSeeOwnerFinance} />
            ))}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Owner list</h3>
                <p>
                  {filteredOwners.length} owner record{filteredOwners.length === 1 ? '' : 's'} shown.
                </p>
              </div>
            </div>

            <DataTable
              rows={filteredOwners}
              columns={getOwnerTableColumns(canSeeOwnerFinance)}
            />
          </section>
        </>
      ) : (
        <EmptyState
          eyebrow="Owners"
          icon={UserRound}
          title={ownerRowsWithReports.length ? 'No owners match the current filters' : 'No owner records yet'}
          description={
            ownerRowsWithReports.length
              ? 'Adjust the search, source, or status filters.'
              : 'Owner records will appear when you invite users with the Property Owner role, create owner contacts, or assign owners to properties.'
          }
          action={
            canManageOwners ? (
              <button type="button" className="primary" data-create-action="owner">
                <Plus size={16} />
                Add Owner
              </button>
            ) : null
          }
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner reports</h3>
              <p>Manual and scheduled owner statement records.</p>
            </div>
            <FileText size={20} className="muted" />
          </div>

          {reports.length ? (
            reports.slice(0, 8).map((report) => (
              <div className="list-row" key={report.id}>
                <span>
                  <strong>{report.title || 'Owner report'}</strong>
                  <small>
                    {report.period || formatDate(report.created_at) || 'Report period not set'}
                  </small>
                </span>
                <StatusBadge>{report.status || 'draft'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={FileText}
              title="No owner reports yet"
              description="Owner reports will appear here after report generation is connected."
              action={
                <button type="button" onClick={() => navigate('/reports')} data-skip-create-action="true">
                  Go to Reports
                </button>
              }
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property assignment health</h3>
              <p>Keep owner assignments clean before generating reports and statements.</p>
            </div>
            <Building2 size={20} className="muted" />
          </div>

          <div className="metadata-grid owners-assignment-grid">
            <span>
              <Building2 size={16} />
              <strong>{assignedProperties}</strong>
              <small>Assigned</small>
            </span>

            <span>
              <Building2 size={16} />
              <strong>{unassignedProperties}</strong>
              <small>Unassigned</small>
            </span>

            <span>
              <Users size={16} />
              <strong>{totalOwners}</strong>
              <small>Owner records</small>
            </span>

            <span>
              <Wrench size={16} />
              <strong>{openMaintenance}</strong>
              <small>Open repairs</small>
            </span>
          </div>

          {unassignedProperties > 0 && (
            <div className="helper">
              {unassignedProperties} propert{unassignedProperties === 1 ? 'y is' : 'ies are'} missing
              an assigned owner. Assign owners from the property profile when ready.
            </div>
          )}
        </section>
      </section>
    </AppLayout>
  );
}
