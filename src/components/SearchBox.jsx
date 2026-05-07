import React from 'react';
import { Search, X } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

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

function buildResults(data, query) {
  const q = normalize(query);

  if (!q) {
    return quickLinks.slice(0, 6);
  }

  const results = [];

  quickLinks.forEach((link) => {
    if (includesQuery([link.title, link.subtitle, link.type], q)) {
      results.push(link);
    }
  });

  (data.properties || []).forEach((property) => {
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
      results.push({
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

  (data.bookings || []).forEach((booking) => {
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
      results.push({
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

  (data.leases || []).forEach((lease) => {
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
      results.push({
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

  (data.cleaningTasks || []).forEach((task) => {
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
      results.push({
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

  (data.maintenanceWorkOrders || []).forEach((workOrder) => {
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
      results.push({
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
      results.push({
        id: `contact-${contact.id}`,
        type: contactType === 'owner' ? 'Owner' : 'Contact',
        title: contactName,
        subtitle: contact.email || contact.phone || contactType || 'Contact record',
        path: contactType === 'owner' ? '/owners' : '/guests',
      });
    }
  });

  (data.supplies || []).forEach((supply) => {
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
      results.push({
        id: `supply-${supply.id}`,
        type: 'Supply',
        title: supplyName,
        subtitle: supply.category || supply.status || 'Inventory item',
        path: '/inventory',
      });
    }
  });

  (data.ownerReports || []).forEach((report) => {
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
      results.push({
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
  placeholder = 'Search properties, bookings, guests, work orders, owners, reports...',
}) {
  const { data } = useApp();

  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef(null);

  const results = React.useMemo(() => buildResults(data || {}, query), [data, query]);

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
          aria-label="Search PropFlow"
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
            <div className="global-search-empty">No matching records found.</div>
          )}
        </div>
      )}
    </div>
  );
}
