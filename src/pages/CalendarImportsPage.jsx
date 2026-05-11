import React from 'react';
import { AlertTriangle, Archive, CalendarClock, CheckCircle2, DownloadCloud, PauseCircle, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import {
  calendarImportedEventTypes,
  calendarImportProviderTypes,
  calendarImportStatuses,
  roles,
} from '../data/constants.js';
import { formatDate } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';

const managerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const conflictStatusOptions = ['open', 'acknowledged', 'resolved', 'ignored'];

const emptyForm = {
  property_id: '',
  provider_type: 'manual_ical',
  name: '',
  feed_url: '',
  import_as: 'booking_block',
  status: 'active',
  timezone: '',
};

function optionLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || String(value || '—').replaceAll('_', ' ');
}

function statusTone(status) {
  if (['success', 'active', 'imported', 'resolved'].includes(status)) return 'success';
  if (['failed', 'error', 'conflict'].includes(status)) return 'error';
  if (['paused', 'partial_success', 'acknowledged', 'warning'].includes(status)) return 'warning';
  return 'info';
}

function hasManagerRole(memberships = [], currentWorkspace, currentUser) {
  const activeMembership = memberships.find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status === 'active',
  );
  const activeRoles = Array.isArray(activeMembership?.roles) ? activeMembership.roles : currentUser?.roles || [];
  return managerRoles.some((role) => activeRoles.includes(role));
}

function getPropertyName(properties, propertyId) {
  return properties.find((property) => property.id === propertyId)?.name || 'Unassigned property';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function AddFeedModal({ properties, form, setForm, onClose, onSubmit, saving, error }) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="calendar-import-form-title">
        <form onSubmit={onSubmit}>
          <header className="modal-header">
            <div>
              <p className="eyebrow">Calendar import</p>
              <h2 id="calendar-import-form-title">Add iCal feed</h2>
              <p>External iCal URLs are sensitive and are stored for workspace managers only.</p>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close feed form" data-skip-create-action="true">
              <X size={18} />
            </button>
          </header>

          {error && <div className="helper error-helper">{error}</div>}

          <div className="modal-body">
            <div className="form-grid two">
              <label>
                Property
                <select value={form.property_id} onChange={set('property_id')} required>
                  <option value="">Select property</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </label>

              <label>
                Provider type
                <select value={form.provider_type} onChange={set('provider_type')} required>
                  {calendarImportProviderTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <label>
                Feed name
                <input value={form.name} onChange={set('name')} placeholder="Airbnb availability" required />
              </label>

              <label>
                Status
                <select value={form.status} onChange={set('status')} required>
                  {calendarImportStatuses.filter(([value]) => value !== 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <label className="full">
                Feed URL
                <input value={form.feed_url} onChange={set('feed_url')} placeholder="https://example.com/calendar.ics" required />
              </label>

              <label>
                Import as
                <select value={form.import_as} onChange={set('import_as')} required>
                  {calendarImportedEventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <label>
                Timezone (optional)
                <input value={form.timezone} onChange={set('timezone')} placeholder="America/New_York" />
              </label>

              <label className="inline-check disabled full">
                <input type="checkbox" checked={false} disabled readOnly />
                Auto-create bookings is disabled by default until import accuracy is verified.
              </label>

              <label className="inline-check disabled full">
                <input type="checkbox" checked={false} disabled readOnly />
                Auto-created cleaning tasks from imported calendars will be added after import accuracy is verified.
              </label>
            </div>
          </div>

          <footer className="modal-actions">
            <button type="button" onClick={onClose} disabled={saving} data-skip-create-action="true">Cancel</button>
            <button className="primary" disabled={saving} data-skip-create-action="true">{saving ? 'Saving…' : 'Add feed'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function CalendarImportsPage() {
  const {
    currentUser,
    currentWorkspace,
    memberships,
    data,
    createCalendarImportFeed,
    updateCalendarImportFeed,
    archiveCalendarImportFeed,
    syncCalendarImportFeed,
    acknowledgeCalendarImportConflict,
    convertImportedEventToBooking,
  } = useApp();

  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [filters, setFilters] = React.useState({ query: '', property: 'all', provider: 'all', status: 'all', conflictStatus: 'all', start: '', end: '' });
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const properties = data.properties || [];
  const feeds = data.calendarImportFeeds || [];
  const importedEvents = data.calendarImportEvents || [];
  const syncRuns = data.calendarImportSyncRuns || [];
  const conflicts = data.calendarImportConflicts || [];
  const canManage = hasManagerRole(memberships, currentWorkspace, currentUser);
  const tablesReady = data.calendarImportTablesReady !== false;

  const filteredFeeds = feeds.filter((feed) => {
    if (filters.property !== 'all' && (feed.propertyId || feed.property_id) !== filters.property) return false;
    if (filters.provider !== 'all' && (feed.providerType || feed.provider_type) !== filters.provider) return false;
    if (filters.status !== 'all' && feed.status !== filters.status) return false;
    const query = filters.query.trim().toLowerCase();
    if (!query) return true;
    return [feed.name, feed.property, optionLabel(calendarImportProviderTypes, feed.providerType || feed.provider_type), feed.lastError || feed.last_error]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const filteredEvents = importedEvents.filter((event) => {
    if (['cancelled', 'archived'].includes(event.status)) return false;
    if (filters.property !== 'all' && (event.propertyId || event.property_id) !== filters.property) return false;
    if (filters.start && String(event.endsAt || event.ends_at || '') < filters.start) return false;
    if (filters.end && String(event.startsAt || event.starts_at || '') > filters.end) return false;
    const query = filters.query.trim().toLowerCase();
    if (!query) return true;
    return [event.title, event.property, event.status, event.sourcePlatform || event.source_platform].filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  const filteredConflicts = conflicts.filter((conflict) => {
    if (filters.property !== 'all' && (conflict.propertyId || conflict.property_id) !== filters.property) return false;
    if (filters.conflictStatus !== 'all' && conflict.status !== filters.conflictStatus) return false;
    const query = filters.query.trim().toLowerCase();
    if (!query) return true;
    return [conflict.property, conflict.feedName, conflict.importedEventTitle, conflict.conflictType || conflict.conflict_type, conflict.message]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const lastSuccessfulSync = feeds
    .map((feed) => feed.lastSuccessfulSyncAt || feed.last_successful_sync_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createCalendarImportFeed(form);
      setMessage('Calendar import feed added. Run Sync now to import blocks.');
      setShowAdd(false);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message || 'Feed could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const syncFeed = async (feed) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await syncCalendarImportFeed(feed.id);
      setMessage(`Sync complete: ${result.eventsFound || 0} found, ${result.eventsCreated || 0} created, ${result.eventsUpdated || 0} updated, ${result.conflictsFound || 0} conflicts.`);
    } catch (syncError) {
      setError(syncError.message || 'Feed sync failed.');
    } finally {
      setSaving(false);
    }
  };

  const pauseFeed = async (feed) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const nextStatus = feed.status === 'paused' ? 'active' : 'paused';
      await updateCalendarImportFeed(feed.id, { status: nextStatus });
      setMessage(nextStatus === 'paused' ? 'Feed paused.' : 'Feed reactivated.');
    } catch (pauseError) {
      setError(pauseError.message || 'Feed status could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const archiveFeed = async (feed) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await archiveCalendarImportFeed(feed.id, true);
      setMessage('Feed archived.');
    } catch (archiveError) {
      setError(archiveError.message || 'Feed could not be archived.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <AppLayout title="Calendar Imports" subtitle="iCal feed management is restricted to workspace operators.">
        <EmptyState eyebrow="Access restricted" icon={ShieldCheck} title="Calendar imports are manager-only" description="External feed URLs are sensitive. Workspace Owners, Property Managers, and Hosts can manage iCal imports." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Calendar Imports" subtitle="Import external iCal feeds as PropFlow calendar blocks without channel-manager, payment, or two-way sync automation.">
      {message && <section className="helper" role="status">{message}</section>}
      {error && <section className="helper error-helper" role="alert">{error}</section>}

      {!tablesReady && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Setup required</p>
              <h3>Calendar import tables are not available yet</h3>
              <p>Apply the iCal calendar import migration before adding feeds or syncing external calendars.</p>
            </div>
            <AlertTriangle size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Active feeds" value={feeds.filter((feed) => feed.status === 'active').length} icon={DownloadCloud} />
        <StatCard label="Last successful sync" value={lastSuccessfulSync ? formatDate(lastSuccessfulSync) : 'Not synced'} icon={RefreshCw} />
        <StatCard label="Open conflicts" value={conflicts.filter((conflict) => conflict.status === 'open').length} icon={AlertTriangle} tone={conflicts.some((conflict) => conflict.status === 'open') ? 'warning' : 'accent'} />
        <StatCard label="Imported events" value={importedEvents.filter((event) => !['cancelled', 'archived'].includes(event.status)).length} icon={CalendarClock} />
      </section>

      <section className="card calendar-toolbar">
        <div>
          <h3>iCal feeds</h3>
          <p>Feeds are scoped to one property and imported as calendar blocks by default.</p>
        </div>
        <button type="button" className="primary" onClick={() => setShowAdd(true)} disabled={!tablesReady} data-skip-create-action="true">
          <Plus size={16} /> Add feed
        </button>
      </section>

      <section className="card">
        <div className="calendar-filters">
          <label className="calendar-search">
            <Search size={16} />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search feed, property, imported event, or error..." />
          </label>
          <label>Property<select value={filters.property} onChange={(event) => setFilters((current) => ({ ...current, property: event.target.value }))}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Provider<select value={filters.provider} onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}><option value="all">All providers</option>{calendarImportProviderTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Feed status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option>{calendarImportStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Conflict status<select value={filters.conflictStatus} onChange={(event) => setFilters((current) => ({ ...current, conflictStatus: event.target.value }))}><option value="all">All conflicts</option>{conflictStatusOptions.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Start<input type="date" value={filters.start} onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input type="date" value={filters.end} onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))} /></label>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><div><h3>Feeds</h3><p>Feed URLs are never shown on public pages and are only visible to manager roles through RLS.</p></div><DownloadCloud size={20} className="muted" /></div>
        <DataTable rows={filteredFeeds} empty={{ title: 'No iCal feeds yet', description: 'Add a property-scoped iCal feed to import external availability blocks.' }} columns={[
          { key: 'name', label: 'Name' },
          { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(properties, row.propertyId || row.property_id) },
          { key: 'provider', label: 'Provider', render: (row) => optionLabel(calendarImportProviderTypes, row.providerType || row.provider_type) },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
          { key: 'lastSync', label: 'Last sync', render: (row) => formatDateTime(row.lastSyncAt || row.last_sync_at) },
          { key: 'lastStatus', label: 'Last status', render: (row) => row.lastSyncStatus || row.last_sync_status ? <StatusBadge tone={statusTone(row.lastSyncStatus || row.last_sync_status)}>{row.lastSyncStatus || row.last_sync_status}</StatusBadge> : '—' },
          { key: 'error', label: 'Error summary', render: (row) => row.lastError || row.last_error || '—' },
          { key: 'actions', label: 'Actions', render: (row) => <span className="table-actions"><button type="button" onClick={() => syncFeed(row)} disabled={saving || row.status !== 'active'} data-skip-create-action="true"><RefreshCw size={14} /> Sync now</button><button type="button" onClick={() => pauseFeed(row)} disabled={saving} data-skip-create-action="true"><PauseCircle size={14} /> {row.status === 'paused' ? 'Resume' : 'Pause'}</button><button type="button" onClick={() => archiveFeed(row)} disabled={saving} data-skip-create-action="true"><Archive size={14} /> Archive</button></span> },
        ]} />
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header"><div><h3>Recent sync runs</h3><p>Server-side CORS-safe sync attempts and import counts.</p></div><RefreshCw size={20} className="muted" /></div>
          <DataTable rows={syncRuns} compact empty="No sync runs recorded yet." columns={[
            { key: 'feed', label: 'Feed', render: (row) => feeds.find((feed) => feed.id === (row.feedId || row.feed_id))?.name || row.feedName || 'Calendar feed' },
            { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(properties, row.propertyId || row.property_id) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
            { key: 'times', label: 'Started / completed', render: (row) => `${formatDateTime(row.startedAt || row.started_at)} → ${formatDateTime(row.completedAt || row.completed_at)}` },
            { key: 'counts', label: 'Counts', render: (row) => `${row.eventsFound ?? row.events_found ?? 0} found · ${row.eventsCreated ?? row.events_created ?? 0} created · ${row.eventsUpdated ?? row.events_updated ?? 0} updated · ${row.eventsIgnored ?? row.events_ignored ?? 0} ignored · ${row.conflictsFound ?? row.conflicts_found ?? 0} conflicts` },
            { key: 'error', label: 'Error', render: (row) => row.errorMessage || row.error_message || '—' },
          ]} />
        </section>

        <section className="card">
          <div className="card-header"><div><h3>Conflicts</h3><p>Overlaps with bookings, direct booking requests, leases, or invalid imported data.</p></div><AlertTriangle size={20} className="muted" /></div>
          <DataTable rows={filteredConflicts} compact empty="No open import conflicts." columns={[
            { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(properties, row.propertyId || row.property_id) },
            { key: 'feed', label: 'Feed', render: (row) => feeds.find((feed) => feed.id === (row.feedId || row.feed_id))?.name || row.feedName || 'Calendar feed' },
            { key: 'event', label: 'Imported event', render: (row) => row.importedEventTitle || 'Imported block' },
            { key: 'type', label: 'Conflict type', render: (row) => String(row.conflictType || row.conflict_type || '').replaceAll('_', ' ') },
            { key: 'message', label: 'Message' },
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge tone={statusTone(row.severity)}>{row.severity}</StatusBadge> },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
            { key: 'actions', label: 'Actions', render: (row) => <span className="table-actions"><button type="button" onClick={() => acknowledgeCalendarImportConflict(row.id, 'acknowledged')} data-skip-create-action="true">Acknowledge</button><button type="button" onClick={() => acknowledgeCalendarImportConflict(row.id, 'resolved')} data-skip-create-action="true"><CheckCircle2 size={14} /> Resolve</button><button type="button" onClick={() => acknowledgeCalendarImportConflict(row.id, 'ignored')} data-skip-create-action="true">Ignore</button></span> },
          ]} />
        </section>
      </section>

      <section className="card">
        <div className="card-header"><div><h3>Imported events</h3><p>Imported iCal events are calendar blocks unless a manager explicitly converts one to an unpaid internal booking.</p></div><CalendarClock size={20} className="muted" /></div>
        <DataTable rows={filteredEvents} empty="No imported calendar events yet." columns={[
          { key: 'title', label: 'Title', render: (row) => row.title || 'Imported calendar block' },
          { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(properties, row.propertyId || row.property_id) },
          { key: 'starts', label: 'Starts', render: (row) => formatDateTime(row.startsAt || row.starts_at) },
          { key: 'ends', label: 'Ends', render: (row) => formatDateTime(row.endsAt || row.ends_at) },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
          { key: 'source', label: 'Source platform', render: (row) => optionLabel(calendarImportProviderTypes, row.sourcePlatform || row.source_platform) },
          { key: 'booking', label: 'Imported booking', render: (row) => row.importedBookingId || row.imported_booking_id ? <button type="button" onClick={() => navigate('/bookings')} data-skip-create-action="true">Open booking</button> : <button type="button" onClick={() => convertImportedEventToBooking(row.id)} data-skip-create-action="true">Convert to booking</button> },
        ]} />
      </section>

      {showAdd && <AddFeedModal properties={properties} form={form} setForm={setForm} onClose={() => setShowAdd(false)} onSubmit={submit} saving={saving} error={error} />}
    </AppLayout>
  );
}
