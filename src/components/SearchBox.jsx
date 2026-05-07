import React from 'react';
import { Search, X } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const quickLinks = [
  { id: 'dashboard', type: 'Page', title: 'Dashboard', subtitle: 'Main workspace dashboard', path: '/dashboard' },
  { id: 'properties', type: 'Page', title: 'Properties', subtitle: 'Property portfolio and profiles', path: '/properties' },
  { id: 'bookings', type: 'Page', title: 'Bookings', subtitle: 'Bookings, leases, and reservations', path: '/bookings' },
  { id: 'calendar', type: 'Page', title: 'Calendar', subtitle: 'Bookings, cleaning, maintenance, and leases', path: '/calendar' },
  { id: 'cleaning', type: 'Page', title: 'Cleaning', subtitle: 'Cleaning tasks and guest-ready updates', path: '/cleaning' },
  { id: 'maintenance', type: 'Page', title: 'Maintenance', subtitle: 'Work orders, repairs, and urgent issues', path: '/maintenance' },
  { id: 'owners', type: 'Page', title: 'Owners', subtitle: 'Owner records, payouts, and property health', path: '/owners' },
  { id: 'guests', type: 'Page', title: 'Guests / CRM', subtitle: 'Guest contacts and booking history', path: '/guests' },
  { id: 'reports', type: 'Page', title: 'Reports', subtitle: 'Owner reports, exports, and performance summaries', path: '/reports' },
  { id: 'inventory', type: 'Page', title: 'Supplies / Inventory', subtitle: 'Stock levels, vendors, and low-stock alerts', path: '/inventory' },
  { id: 'settings', type: 'Page', title: 'Settings', subtitle: 'Workspace settings and team invites', path: '/settings' },
  { id: 'billing', type: 'Page', title: 'Billing', subtitle: 'Subscription and Stripe readiness', path: '/billing' },
];

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function includesQuery(values, query) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  return text.includes(query);
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getGuestName(booking) {
  return booking.guestName || booking.guest_name || 'Guest booking';
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
          property.rental_type,
          property.status,
        ],
        q,
      )
    ) {
      results.push({
        id: `property-${property.id}`,
        type: 'Property',
        title: property.name || 'Property',
        subtitle: [property.address, property.city, property.country].filter(Boolean).join(', ') || 'Property profile',
        path: `/properties/${property.id}`,
      });
    }
  });

  (data.bookings || []).forEach((booking) => {
    if (
      includesQuery(
        [
          getGuestName(booking),
          booking.guest_email,
          booking.guestEmail,
          booking.property,
          booking.source,
          booking.status,
          booking.payment_status,
          booking.paymentStatus,
        ],
        q,
      )
    ) {
      results.push({
        id: `booking-${booking.id}`,
        type: 'Booking',
        title: getGuestName(booking),
        subtitle: `${booking.property || 'Unassigned property'} · ${booking.check_in || booking.checkIn || 'No check-in date'}`,
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
          lease.property,
          lease.lease_status,
          lease.leaseStatus,
          lease.rent_payment_status,
          lease.rentPaymentStatus,
        ],
        q,
      )
    ) {
      results.push({
        id: `lease-${lease.id}`,
        type: 'Lease',
        title: lease.tenant_name || lease.tenantName || 'Tenant lease',
        subtitle: `${lease.property || 'Unassigned property'} · ${lease.lease_start || lease.leaseStart || 'No start date'}`,
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
        subtitle: `${task.status || 'scheduled'} · ${task.scheduledFor || task.scheduled_for || 'Not scheduled'}`,
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
          workOrder.property,
          workOrder.priority,
          workOrder.status,
          workOrder.partsNeeded,
          workOrder.parts_needed,
          workOrder.notes,
        ],
        q,
      )
    ) {
      results.push({
        id: `maintenance-${workOrder.id}`,
        type: 'Maintenance',
        title: workOrder.title || 'Maintenance issue',
        subtitle: `${workOrder.property || 'Unassigned property'} · ${workOrder.priority || 'medium'}`,
        path: '/maintenance',
      });
    }
  });

  (data.contacts || []).forEach((contact) => {
    if (
      includesQuery(
        [
          contact.full_name,
          contact.fullName,
          contact.name,
          contact.email,
          contact.phone,
          contact.contact_type,
          contact.contactType,
        ],
        q,
      )
    ) {
      results.push({
        id: `contact-${contact.id}`,
        type: 'Contact',
        title: contact.full_name || contact.fullName || contact.name || 'Contact',
        subtitle: contact.email || contact.phone || contact.contact_type || 'Contact record',
        path: contact.contact_type === 'owner' || contact.contactType === 'owner' ? '/owners' : '/guests',
      });
    }
  });

  (data.supplies || []).forEach((supply) => {
    if (
      includesQuery(
        [
          supply.item_name,
          supply.itemName,
          supply.category,
          supply.supplier_name,
          supply.supplierName,
          supply.notes,
        ],
        q,
      )
    ) {
      results.push({
        id: `supply-${supply.id}`,
        type: 'Supply',
        title: supply.item_name || supply.itemName || 'Supply item',
        subtitle: supply.category || 'Inventory item',
        path: '/inventory',
      });
    }
  });

  (data.ownerReports || []).forEach((report) => {
    if (
      includesQuery(
        [
          report.title,
          report.report_type,
          report.status,
          report.period,
          report.created_at,
        ],
        q,
      )
    ) {
      results.push({
        id: `report-${report.id}`,
        type: 'Report',
        title: report.title || report.report_type || 'Owner report',
        subtitle: report.period || report.status || 'Report record',
        path: '/reports',
      });
    }
  });

  const uniqueResults = [];
  const seen = new Set();

  results.forEach((result) => {
    const key = `${result.type}-${result.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  });

  return uniqueResults.slice(0, 8);
}

export function SearchBox({
  placeholder = 'Search properties, bookings, guests, work orders, owners, reports...',
}) {
  const { data } = useApp();

  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const searchRef = React.useRef(null);

  const results = React.useMemo(() => buildResults(data || {}, query), [data, query]);

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
    setQuery('');
    setOpen(false);
    navigate(result.path);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'Enter' && results[0]) {
      event.preventDefault();
      goToResult(results[0]);
    }
  };

  return (
    <div className="global-search" ref={searchRef}>
      <label className="search-box">
        <Search size={16} />

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
        />

        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </label>

      {open && (
        <div className="global-search-results">
          {results.length ? (
            results.map((result) => (
              <button type="button" key={`${result.type}-${result.id}`} onClick={() => goToResult(result)}>
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
                <em>{result.type}</em>
              </button>
            ))
          ) : (
            <div className="global-search-empty">
              No matching records found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
