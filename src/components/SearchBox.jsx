import React from 'react';
import { Search, X } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { roles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const operationalRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const ownerVisibleRoles = [...operationalRoles, roles.OWNER, roles.ACCOUNTANT];
const staffOperationsRoles = [...operationalRoles, roles.CLEANER, roles.MAINTENANCE];
const financeRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const calendarManagerRoles = [...operationalRoles, roles.ACCOUNTANT];

const routeAccess = {
  '/dashboard': operationalRoles,
  '/properties': ownerVisibleRoles,
  '/bookings': [...operationalRoles, roles.OWNER, roles.ACCOUNTANT],
  '/calendar': calendarManagerRoles,
  '/cleaning': [...operationalRoles, roles.CLEANER],
  '/maintenance': staffOperationsRoles,
  '/owners': financeRoles,
  '/guests': operationalRoles,
  '/reports': [...operationalRoles, roles.OWNER, roles.ACCOUNTANT],
  '/inventory': [...operationalRoles, roles.ACCOUNTANT, roles.CLEANER],
  '/settings': operationalRoles,
  '/billing': [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT],
};

const quickLinks = [
  {
    id: 'dashboard',
    type: 'Page',
    title: 'Dashboard',
    subtitle: 'Main workspace dashboard',
    path: '/dashboard',
  },
  {
    id: 'properties',
    type: 'Page',
    title: 'Properties',
    subtitle: 'Property portfolio and profiles',
    path: '/properties',
  },
  {
    id: 'bookings',
    type: 'Page',
    title: 'Bookings',
    subtitle: 'Bookings, leases, and reservations',
    path: '/bookings',
  },
  {
    id: 'calendar',
    type: 'Page',
    title: 'Calendar',
    subtitle: 'Bookings, cleaning, maintenance, and leases',
    path: '/calendar',
  },
  {
    id: 'cleaning',
    type: 'Page',
    title: 'Cleaning',
    subtitle: 'Cleaning tasks and guest-ready updates',
    path: '/cleaning',
  },
  {
    id: 'maintenance',
    type: 'Page',
    title: 'Maintenance',
    subtitle: 'Work orders, repairs, and urgent issues',
    path: '/maintenance',
  },
  {
    id: 'owners',
    type: 'Page',
    title: 'Owners',
    subtitle: 'Owner records, payouts, and property health',
    path: '/owners',
  },
  {
    id: 'guests',
    type: 'Page',
    title: 'Guests / CRM',
    subtitle: 'Guest contacts and booking history',
    path: '/guests',
  },
  {
    id: 'reports',
    type: 'Page',
    title: 'Reports',
    subtitle: 'Owner reports, exports, and performance summaries',
    path: '/reports',
  },
  {
    id: 'inventory',
    type: 'Page',
    title: 'Supplies / Inventory',
    subtitle: 'Stock levels, vendors, and low-stock alerts',
    path: '/inventory',
  },
  {
    id: 'settings',
    type: 'Page',
    title: 'Settings',
    subtitle: 'Workspace settings and team invites',
    path: '/settings',
  },
  {
    id: 'billing',
    type: 'Page',
    title: 'Billing',
    subtitle: 'Subscription and Stripe readiness',
    path: '/billing',
  },
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function normalizePath(path) {
  const pathOnly = String(path || '').split(/[?#]/)[0] || '/';
  return pathOnly === '/' ? '/' : pathOnly.replace(/\/+$/, '') || '/';
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id || '';
}

function getAssignedOwnerId(property) {
  return property?.assignedOwnerId || property?.assigned_owner_id || property?.ownerId || property?.owner_id || '';
}

function getAssignedCleanerId(task) {
  return task?.assignedCleanerId || task?.assigned_cleaner_id || task?.cleanerId || task?.cleaner_id || '';
}

function getAssignedMaintenanceId(workOrder) {
  return (
    workOrder?.assignedMaintenanceId ||
    workOrder?.assigned_maintenance_id ||
    workOrder?.maintenanceId ||
    workOrder?.maintenance_id ||
    ''
  );
}

function hasAssignmentData(records, getter) {
  return Array.isArray(records) && records.some((record) => Boolean(getter(record)));
}

function isOwnerRole(user) {
  return Boolean(user?.roles?.includes(roles.OWNER));
}

function isCleanerRole(user) {
  return Boolean(user?.roles?.includes(roles.CLEANER));
}

function isMaintenanceRole(user) {
  return Boolean(user?.roles?.includes(roles.MAINTENANCE));
}

function getVisibleProperties(data, user) {
  const properties = data.properties || [];

  if (!isOwnerRole(user)) return properties;

  return properties.filter((property) => getAssignedOwnerId(property) === user?.id);
}

function getVisiblePropertyIds(data, user) {
  return new Set(getVisibleProperties(data, user).map((property) => property.id).filter(Boolean));
}

function getVisibleCleaningTasks(data, user) {
  const tasks = data.cleaningTasks || [];

  if (!isCleanerRole(user)) return tasks;

  if (!hasAssignmentData(tasks, getAssignedCleanerId)) return tasks;

  return tasks.filter((task) => getAssignedCleanerId(task) === user?.id);
}

function getVisibleMaintenanceWorkOrders(data, user) {
  const workOrders = data.maintenanceWorkOrders || [];

  if (!isMaintenanceRole(user)) return workOrders;

  if (!hasAssignmentData(workOrders, getAssignedMaintenanceId)) return workOrders;

  return workOrders.filter((workOrder) => getAssignedMaintenanceId(workOrder) === user?.id);
}

function getVisibleSupplies(data, user) {
  const supplies = data.supplies || [];

  if (!isCleanerRole(user)) return supplies;

  const visibleCleaningPropertyIds = new Set(getVisibleCleaningTasks(data, user).map(getPropertyId).filter(Boolean));

  return supplies.filter((supply) => {
    const propertyId = getPropertyId(supply);
    return !propertyId || visibleCleaningPropertyIds.has(propertyId);
  });
}

function getVisibleReports(data, user) {
  const reports = data.ownerReports || [];

  if (!isOwnerRole(user)) return reports;

  const visiblePropertyIds = getVisiblePropertyIds(data, user);

  return reports.filter((report) => {
    const propertyId = getPropertyId(report);
    const ownerId = report.ownerId || report.owner_id || report.contactId || report.contact_id || '';

    if (propertyId) return visiblePropertyIds.has(propertyId);
    if (ownerId) return ownerId === user?.id;

    return false;
  });
}

function getVisibleBookings(data, user) {
  const bookings = data.bookings || [];

  if (!isOwnerRole(user)) return bookings;

  const visiblePropertyIds = getVisiblePropertyIds(data, user);

  return bookings.filter((booking) => visiblePropertyIds.has(getPropertyId(booking)));
}

function getVisibleLeases(data, user) {
  const leases = data.leases || [];

  if (!isOwnerRole(user)) return leases;

  const visiblePropertyIds = getVisiblePropertyIds(data, user);

  return leases.filter((lease) => visiblePropertyIds.has(getPropertyId(lease)));
}

function canAccessPath(user, path) {
  const cleanPath = normalizePath(path);

  if (!cleanPath || cleanPath === '/account') return true;

  const allowedRoles = routeAccess[cleanPath];
  if (!allowedRoles) return true;

  return hasAnyRole(user, allowedRoles);
}

function getQuickLinksForUser(user) {
  return quickLinks
    .map((link) => {
      if (link.id !== 'dashboard') return link;

      const dashboardPath = getPostLoginPath(user);
      const safeDashboardPath = dashboardPath === '/workspace-setup' || dashboardPath === '/suspended'
        ? '/account'
        : dashboardPath;

      return {
        ...link,
        path: safeDashboardPath,
        subtitle: 'Your role-based dashboard',
      };
    })
    .filter((link) => canAccessPath(user, link.path));
}

function includesQuery(values, query) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  return text.includes(query);
}

function getGuestName(booking) {
  return booking.guestName || booking.guest_name || 'Guest booking';
}

function getContactName(contact) {
  return contact.full_name || contact.fullName || contact.name || 'Contact';
}

function getSupplyName(supply) {
  return supply.item_name || supply.itemName || 'Supply item';
}

function getReportTitle(report) {
  return report.title || report.report_type || 'Owner report';
}

function uniqueAndLimit(results, limit = 8) {
  const uniqueResults = [];
  const seen = new Set();

  results.forEach((result) => {
    const key = `${result.type}-${result.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  });

  return uniqueResults.slice(0, limit);
}

function pushIfAllowed(results, user, result) {
  if (canAccessPath(user, result.path)) {
    results.push(result);
  }
}

function buildResults(data, query, user) {
  const q = normalize(query);
  const roleSafeQuickLinks = getQuickLinksForUser(user);

  if (!q) {
    return roleSafeQuickLinks.slice(0, 6);
  }

  const results = [];
  const visibleProperties = getVisibleProperties(data, user);
  const visibleBookings = getVisibleBookings(data, user);
  const visibleLeases = getVisibleLeases(data, user);
  const visibleCleaningTasks = getVisibleCleaningTasks(data, user);
  const visibleMaintenanceWorkOrders = getVisibleMaintenanceWorkOrders(data, user);
  const visibleSupplies = getVisibleSupplies(data, user);
  const visibleReports = getVisibleReports(data, user);

  roleSafeQuickLinks.forEach((link) => {
    if (includesQuery([link.title, link.subtitle, link.type], q)) {
      results.push(link);
    }
  });

  visibleProperties.forEach((property) => {
    if (
      includesQuery(
        [
          property.name,
          property.address,
          property.city,
          property.state,
          property.country,
          property.property_type,
          property.propertyType,
          property.rental_type,
          property.rentalType,
          property.status,
          property.owner,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `property-${property.id}`,
        type: 'Property',
        title: property.name || 'Property',
        subtitle:
          [property.address, property.city, property.country].filter(Boolean).join(', ') ||
          'Property profile',
        path: `/properties/${property.id}`,
      });
    }
  });

  visibleBookings.forEach((booking) => {
    const guestName = getGuestName(booking);

    if (
      includesQuery(
        [
          guestName,
          booking.guest_email,
          booking.guestEmail,
          booking.guest_phone,
          booking.guestPhone,
          booking.property,
          booking.source,
          booking.status,
          booking.payment_status,
          booking.paymentStatus,
          booking.check_in,
          booking.checkIn,
          booking.check_out,
          booking.checkOut,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `booking-${booking.id}`,
        type: 'Booking',
        title: guestName,
        subtitle: `${booking.property || 'Unassigned property'} · ${
          booking.check_in || booking.checkIn || 'No check-in date'
        }`,
        path: '/bookings',
      });
    }
  });

  visibleLeases.forEach((lease) => {
    if (
      includesQuery(
        [
          lease.tenant_name,
          lease.tenantName,
          lease.tenant_email,
          lease.tenantEmail,
          lease.tenant_phone,
          lease.tenantPhone,
          lease.property,
          lease.lease_status,
          lease.leaseStatus,
          lease.rent_payment_status,
          lease.rentPaymentStatus,
          lease.lease_start,
          lease.leaseStart,
          lease.lease_end,
          lease.leaseEnd,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `lease-${lease.id}`,
        type: 'Lease',
        title: lease.tenant_name || lease.tenantName || 'Tenant lease',
        subtitle: `${lease.property || 'Unassigned property'} · ${
          lease.lease_start || lease.leaseStart || 'No start date'
        }`,
        path: '/bookings',
      });
    }
  });

  visibleCleaningTasks.forEach((task) => {
    if (
      includesQuery(
        [
          task.property,
          task.status,
          task.cleanerNotes,
          task.cleaner_notes,
          task.scheduledFor,
          task.scheduled_for,
          task.assigned,
          task.priority,
          Array.isArray(task.checklist) ? task.checklist.join(' ') : '',
          Array.isArray(task.checklist_items) ? task.checklist_items.join(' ') : '',
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `cleaning-${task.id}`,
        type: 'Cleaning',
        title: task.property || 'Cleaning task',
        subtitle: `${task.status || 'scheduled'} · ${
          task.scheduledFor || task.scheduled_for || 'Not scheduled'
        }`,
        path: '/cleaning',
      });
    }
  });

  visibleMaintenanceWorkOrders.forEach((workOrder) => {
    if (
      includesQuery(
        [
          workOrder.title,
          workOrder.description,
          workOrder.issue_description,
          workOrder.issueDescription,
          workOrder.property,
          workOrder.priority,
          workOrder.status,
          workOrder.partsNeeded,
          workOrder.parts_needed,
          workOrder.notes,
          workOrder.due,
          workOrder.due_date,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `maintenance-${workOrder.id}`,
        type: 'Maintenance',
        title: workOrder.title || 'Maintenance issue',
        subtitle: `${workOrder.property || 'Unassigned property'} · ${
          workOrder.priority || 'medium'
        }`,
        path: '/maintenance',
      });
    }
  });

  (data.contacts || []).forEach((contact) => {
    const contactName = getContactName(contact);
    const contactType = contact.contact_type || contact.contactType;

    if (
      includesQuery(
        [
          contactName,
          contact.email,
          contact.phone,
          contactType,
          contact.notes,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `contact-${contact.id}`,
        type: contactType === 'owner' ? 'Owner' : 'Contact',
        title: contactName,
        subtitle: contact.email || contact.phone || contactType || 'Contact record',
        path: contactType === 'owner' ? '/owners' : '/guests',
      });
    }
  });

  visibleSupplies.forEach((supply) => {
    const supplyName = getSupplyName(supply);

    if (
      includesQuery(
        [
          supplyName,
          supply.category,
          supply.status,
          supply.supplier_name,
          supply.supplierName,
          supply.notes,
          supply.property,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `supply-${supply.id}`,
        type: 'Supply',
        title: supplyName,
        subtitle: supply.category || supply.status || 'Inventory item',
        path: '/inventory',
      });
    }
  });

  visibleReports.forEach((report) => {
    const reportTitle = getReportTitle(report);

    if (
      includesQuery(
        [
          reportTitle,
          report.report_type,
          report.status,
          report.period,
          report.created_at,
          report.owner_name,
          report.ownerName,
        ],
        q,
      )
    ) {
      pushIfAllowed(results, user, {
        id: `report-${report.id}`,
        type: 'Report',
        title: reportTitle,
        subtitle: report.period || report.status || 'Report record',
        path: '/reports',
      });
    }
  });

  return uniqueAndLimit(results, 8);
}

export function SearchBox({
  placeholder = 'Search visible workspace records...',
}) {
  const { data, currentUser } = useApp();

  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef(null);

  const results = React.useMemo(() => buildResults(data || {}, query, currentUser), [data, query, currentUser]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  React.useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, []);

  const goToResult = (result) => {
    if (!result?.path) return;

    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    navigate(result.path);
  };

  const clearSearch = () => {
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      goToResult(results[activeIndex]);
    }
  };

  return (
    <div className="global-search" ref={searchRef}>
      <label className="search-box">
        <Search size={16} aria-hidden="true" />

        <input
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search visible PropFlow records"
          aria-expanded={open}
          aria-controls="propflow-global-search-results"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={clearSearch}
            aria-label="Clear search"
            data-skip-create-action="true"
          >
            <X size={14} />
          </button>
        )}
      </label>

      {open && (
        <div
          id="propflow-global-search-results"
          className="global-search-results"
          role="listbox"
          aria-label="Search results"
        >
          {results.length ? (
            results.map((result, index) => (
              <button
                type="button"
                key={`${result.type}-${result.id}`}
                className={index === activeIndex ? 'active' : ''}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => goToResult(result)}
                data-skip-create-action="true"
                role="option"
                aria-selected={index === activeIndex}
              >
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
                <em>{result.type}</em>
              </button>
            ))
          ) : (
            <div className="global-search-empty">No matching visible records found.</div>
          )}
        </div>
      )}
    </div>
  );
}
