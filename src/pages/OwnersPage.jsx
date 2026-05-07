import React from 'react';
import {
  Banknote,
  Building2,
  FileText,
  Search,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { roles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const closedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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

function isOwnerMember(member) {
  return Array.isArray(member.roles) && member.roles.includes(roles.OWNER);
}

function isOwnerContact(contact) {
  return ['owner', 'property_owner'].includes(contact.contact_type || contact.contactType);
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
      source: 'workspace member',
      status: member.status || 'active',
      properties: [],
    });
  });

  contacts.filter(isOwnerContact).forEach((contact) => {
    const id = contact.id || contact.email || getContactName(contact);

    if (!id || ownerMap.has(id)) return;

    ownerMap.set(id, {
      id,
      name: getContactName(contact),
      email: getContactEmail(contact),
      source: 'contact',
      status: contact.status || 'active',
      properties: [],
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
        source: 'property assignment',
        status: 'active',
        properties: [],
      });
    }

    ownerMap.get(ownerId).properties.push(property);
  });

  return ownerMap;
}

function buildOwnerRows({ properties, bookings, cleaningTasks, maintenanceWorkOrders, members, contacts, currency }) {
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
      currency,
    };
  });
}

export function OwnersPage() {
  const { data, currentWorkspace } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    source: 'all',
    status: 'all',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

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

  const totalOwners = ownerRows.length;
  const assignedProperties = properties.filter((property) => Boolean(getPropertyOwnerId(property))).length;
  const totalOwnerPayouts = ownerRows.reduce((sum, owner) => sum + owner.ownerPayout, 0);
  const openMaintenance = ownerRows.reduce((sum, owner) => sum + owner.openMaintenance, 0);

  const sources = [...new Set(ownerRows.map((owner) => owner.source).filter(Boolean))];
  const statuses = [...new Set(ownerRows.map((owner) => owner.status).filter(Boolean))];

  const filteredOwners = ownerRows
    .filter((owner) => filters.source === 'all' || owner.source === filters.source)
    .filter((owner) => filters.status === 'all' || owner.status === filters.status)
    .filter((owner) => {
      const searchText = [
        owner.name,
        owner.email,
        owner.source,
        owner.status,
        owner.propertyNames,
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
    <AppLayout title="Owners" subtitle="Owner records, assigned properties, payouts, reports, and property health">
      <div className="stat-grid dense">
        <StatCard label="Owner records" value={totalOwners} icon={Users} />
        <StatCard label="Assigned properties" value={assignedProperties} icon={Building2} />
        <StatCard label="Owner payouts" value={formatCurrency(totalOwnerPayouts, currency)} icon={Banknote} />
        <StatCard label="Open maintenance" value={openMaintenance} icon={Wrench} tone={openMaintenance ? 'warning' : 'accent'} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Owner management</h3>
            <p>
              Owner records are built from workspace owner-role members, owner contacts, and assigned
              property records. Full owner CRM, payout approvals, and owner statement automation can
              be added after the core data model is stable.
            </p>
          </div>
        </div>

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search owners</span>
            <div className="search-box">
              <Search size={16} />
              <input
                value={filters.query}
                onChange={setFilter('query')}
                placeholder="Search owner, email, property, source, or status"
              />
            </div>
          </label>

          <select value={filters.source} onChange={setFilter('source')}>
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>

          <select value={filters.status} onChange={setFilter('status')}>
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredOwners.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner list</h3>
              <p>{filteredOwners.length} owner record{filteredOwners.length === 1 ? '' : 's'} shown.</p>
            </div>
          </div>

          <DataTable
            rows={filteredOwners}
            columns={[
              {
                key: 'name',
                label: 'Owner',
                render: (row) => (
                  <span>
                    {row.name}
                    <br />
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
                key: 'ownerPayout',
                label: 'Owner payout',
                render: (row) => formatCurrency(row.ownerPayout, row.currency),
              },
              {
                key: 'openMaintenance',
                label: 'Open repairs',
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge>{row.status}</StatusBadge>,
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title={ownerRows.length ? 'No owners match the current filters.' : 'No owner records yet.'}
          description={
            ownerRows.length
              ? 'Adjust your search, source, or status filters.'
              : 'Owner records will appear when you invite users with the Property Owner role, create owner contacts, or assign owners to properties.'
          }
        />
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner reports</h3>
              <p>Manual and scheduled owner statement records.</p>
            </div>
            <FileText size={20} />
          </div>

          {reports.length ? (
            reports.slice(0, 8).map((report) => (
              <div className="list-row" key={report.id}>
                <span>
                  {report.title || 'Owner report'}
                  <small>{report.period || report.created_at || 'Report period not set'}</small>
                </span>
                <StatusBadge>{report.status || 'ready'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No owner reports yet."
              description="Manual owner reports should be generated first. Scheduled monthly reports can use the same report structure later."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner workflow next phase</h3>
              <p>Recommended features after owners, properties, bookings, and reports are stable.</p>
            </div>
            <UserRound size={20} />
          </div>

          <ul className="checklist">
            <li>
              <UserRound size={16} />
              Add dedicated owner profile form.
            </li>
            <li>
              <Building2 size={16} />
              Assign owners from the property profile.
            </li>
            <li>
              <Banknote size={16} />
              Generate owner payout statements.
            </li>
            <li>
              <FileText size={16} />
              Export owner reports to PDF and CSV.
            </li>
            <li>
              <Wrench size={16} />
              Include maintenance and cleaning updates in owner reports.
            </li>
          </ul>

          <div className="action-row">
            <button type="button" onClick={() => navigate('/reports')}>
              View reports
            </button>
            <button type="button" onClick={() => navigate('/properties')}>
              Manage properties
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
