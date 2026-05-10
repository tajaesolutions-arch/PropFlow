import React from 'react';
import { Archive, Download, FileText, Filter, Lock, RotateCcw, Search, ShieldCheck, Upload, X } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';
import { formatDate } from '../lib/formatters.js';

const fileCategories = [
  ['property_photo', 'Property photo'],
  ['cleaning_before_photo', 'Cleaning before photo'],
  ['cleaning_after_photo', 'Cleaning after photo'],
  ['cleaning_issue_photo', 'Cleaning issue photo'],
  ['maintenance_issue_photo', 'Maintenance issue photo'],
  ['maintenance_completion_photo', 'Maintenance completion photo'],
  ['maintenance_video', 'Maintenance video'],
  ['receipt', 'Receipt'],
  ['lease', 'Lease'],
  ['contract', 'Contract'],
  ['owner_report', 'Owner report'],
  ['invoice', 'Invoice'],
  ['property_document', 'Property document'],
  ['general_document', 'General document'],
  ['other', 'Other'],
];

const broadUploadRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const archiveRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];

function hasAnyRole(currentUser, allowedRoles) {
  return allowedRoles.some((role) => currentUser?.roles?.includes(role));
}

function formatLabel(value) {
  const label = fileCategories.find(([category]) => category === value)?.[1];
  return label || String(value || 'File').replaceAll('_', ' ');
}

function getPropertyName(file, properties) {
  const propertyId = file.propertyId || file.property_id;
  if (!propertyId) return 'Workspace';
  return properties.find((property) => property.id === propertyId)?.name || 'Linked property';
}

function getUploaderName(file, members = []) {
  const userId = file.uploadedBy || file.uploaded_by;
  if (!userId) return 'Unknown uploader';
  const member = members.find((item) => (item.user_id || item.userId || item.id) === userId);
  const profile = member?.profiles || member?.profile || {};
  return profile.full_name || profile.name || profile.email || member?.email || member?.user_email || 'Workspace member';
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isInDateRange(value, start, end) {
  if (!value) return !start && !end;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (start && date < new Date(`${start}T00:00:00`)) return false;
  if (end && date > new Date(`${end}T23:59:59`)) return false;
  return true;
}

function contextLabel(file, data) {
  if (file.cleaningTaskId || file.cleaning_task_id) return 'Cleaning task';
  if (file.maintenanceWorkOrderId || file.maintenance_work_order_id) return 'Maintenance work order';
  if (file.expenseId || file.expense_id) return 'Expense';
  if (file.reportId || file.report_id) return 'Owner report';
  if (file.bookingId || file.booking_id) return 'Booking';
  if (file.contactId || file.contact_id) return 'Contact';
  return getPropertyName(file, data.properties || []);
}

function FileUploadPanel({ data, onClose, onUpload, uploading }) {
  const [form, setForm] = React.useState({
    file: null,
    fileCategory: 'property_document',
    propertyId: '',
    notes: '',
  });
  const [error, setError] = React.useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.file) {
      setError('Choose a file before uploading.');
      return;
    }

    try {
      await onUpload({
        file: form.file,
        fileCategory: form.fileCategory,
        propertyId: form.propertyId || null,
        notes: form.notes,
      });
      onClose();
    } catch (uploadError) {
      setError(uploadError?.message || 'File upload failed.');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !uploading && onClose()}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="file-upload-title">
        <header className="modal-header">
          <div>
            <h3 id="file-upload-title">Upload private file</h3>
            <p>Files are stored in the private workspace-files bucket and viewed through short-lived signed links.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close upload form" onClick={onClose} disabled={uploading} data-skip-create-action="true">
            <X size={18} />
          </button>
        </header>

        <form className="modal-form" onSubmit={submit}>
          {error && <div className="helper error-helper">{error}</div>}

          <label>
            File
            <input type="file" onChange={(event) => setForm((value) => ({ ...value, file: event.target.files?.[0] || null }))} required />
          </label>

          <label>
            Category
            <select value={form.fileCategory} onChange={(event) => setForm((value) => ({ ...value, fileCategory: event.target.value }))}>
              {fileCategories.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Property context (optional)
            <select value={form.propertyId} onChange={(event) => setForm((value) => ({ ...value, propertyId: event.target.value }))}>
              <option value="">Workspace-level file</option>
              {(data.properties || []).map((property) => (
                <option value={property.id} key={property.id}>{property.name}</option>
              ))}
            </select>
          </label>

          <label>
            Notes (optional)
            <textarea value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} rows={3} placeholder="Internal note for this private file..." />
          </label>

          <div className="helper">
            <Lock size={15} />
            Public links are not created or stored. View/download actions request a short-lived signed URL.
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={uploading} data-skip-create-action="true">Cancel</button>
            <button type="submit" className="primary" disabled={uploading} data-skip-create-action="true">
              <Upload size={16} />
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function FilesPage() {
  const app = useApp();
  const { currentUser, data, uploadWorkspaceFile, getFileSignedUrl, archiveFileUpload } = app;
  const [filters, setFilters] = React.useState({
    query: '',
    propertyId: 'all',
    category: 'all',
    fileType: 'all',
    uploadedBy: 'all',
    archived: 'active',
    start: '',
    end: '',
  });
  const [showUpload, setShowUpload] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const canUpload = hasAnyRole(currentUser, broadUploadRoles) || hasAnyRole(currentUser, [roles.ACCOUNTANT]);
  const canArchive = hasAnyRole(currentUser, archiveRoles);

  const fileRows = (data.fileUploads || [])
    .filter((file) => filters.archived === 'all' || (filters.archived === 'archived' ? Boolean(file.archivedAt || file.archived_at) : !file.archivedAt && !file.archived_at))
    .filter((file) => filters.propertyId === 'all' || (file.propertyId || file.property_id || '') === filters.propertyId)
    .filter((file) => filters.category === 'all' || (file.fileCategory || file.file_category || file.category) === filters.category)
    .filter((file) => filters.fileType === 'all' || String(file.mimeType || file.mime_type || file.fileType || file.file_type || '').startsWith(filters.fileType))
    .filter((file) => filters.uploadedBy === 'all' || (file.uploadedBy || file.uploaded_by || '') === filters.uploadedBy)
    .filter((file) => isInDateRange(file.created_at || file.createdAt, filters.start, filters.end))
    .filter((file) => {
      const query = filters.query.trim().toLowerCase();
      if (!query) return true;
      return [
        file.fileName || file.file_name,
        formatLabel(file.fileCategory || file.file_category || file.category),
        getPropertyName(file, data.properties || []),
        getUploaderName(file, data.members || []),
        file.notes,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });

  const uploaderOptions = [...new Set((data.fileUploads || []).map((file) => file.uploadedBy || file.uploaded_by).filter(Boolean))];

  const openFile = async (file) => {
    setError('');
    setMessage('');
    setBusyId(file.id);
    try {
      const signedUrl = await getFileSignedUrl(file, 300);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (viewError) {
      setError(viewError?.message || 'Signed file link could not be created.');
    } finally {
      setBusyId('');
    }
  };

  const toggleArchive = async (file, archived) => {
    setError('');
    setMessage('');
    setBusyId(file.id);
    try {
      await archiveFileUpload(file.id, archived);
      setMessage(archived ? 'File archived.' : 'File restored.');
    } catch (archiveError) {
      setError(archiveError?.message || 'File archive status could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const uploadFile = async (payload) => {
    setUploading(true);
    setError('');
    setMessage('');
    try {
      await uploadWorkspaceFile(payload);
      setMessage('File uploaded to private workspace storage.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Files / Documents" subtitle="Private workspace-scoped files with metadata, filters, and signed viewing links.">
      {(message || error) && (
        <div className={error ? 'helper error-helper' : 'helper'} role="status">
          {error || message}
        </div>
      )}

      <section className="card files-privacy-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Private storage</p>
            <h3>Operational files stay private by default</h3>
            <p>Property photos, cleaning photos, maintenance media, receipts, leases, contracts, invoices, and reports use private Supabase Storage metadata. No public file URLs are stored.</p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>
      </section>

      <section className="card files-toolbar-card">
        <div className="card-header">
          <div>
            <h3>Workspace files</h3>
            <p>Search and filter files uploaded from properties, cleaning, maintenance, expenses, reports, contacts, and bookings.</p>
          </div>
          {canUpload && (
            <button type="button" className="primary" onClick={() => setShowUpload(true)} data-skip-create-action="true">
              <Upload size={16} />
              Upload file
            </button>
          )}
        </div>

        <div className="filters-grid files-filters-grid">
          <label className="search-field">
            <Search size={16} />
            <input value={filters.query} onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} placeholder="Search file name, category, property, notes, uploader..." />
          </label>

          <label>
            <Filter size={14} /> Property
            <select value={filters.propertyId} onChange={(event) => setFilters((value) => ({ ...value, propertyId: event.target.value }))}>
              <option value="all">All properties</option>
              {(data.properties || []).map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}
            </select>
          </label>

          <label>
            Category
            <select value={filters.category} onChange={(event) => setFilters((value) => ({ ...value, category: event.target.value }))}>
              <option value="all">All categories</option>
              {fileCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>

          <label>
            File type
            <select value={filters.fileType} onChange={(event) => setFilters((value) => ({ ...value, fileType: event.target.value }))}>
              <option value="all">All types</option>
              <option value="image/">Images</option>
              <option value="application/pdf">PDFs</option>
              <option value="video/">Videos</option>
            </select>
          </label>

          <label>
            Uploaded by
            <select value={filters.uploadedBy} onChange={(event) => setFilters((value) => ({ ...value, uploadedBy: event.target.value }))}>
              <option value="all">All uploaders</option>
              {uploaderOptions.map((userId) => <option value={userId} key={userId}>{getUploaderName({ uploadedBy: userId }, data.members || [])}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={filters.archived} onChange={(event) => setFilters((value) => ({ ...value, archived: event.target.value }))}>
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
              <option value="all">All files</option>
            </select>
          </label>

          <label>
            From
            <input type="date" value={filters.start} onChange={(event) => setFilters((value) => ({ ...value, start: event.target.value }))} />
          </label>

          <label>
            To
            <input type="date" value={filters.end} onChange={(event) => setFilters((value) => ({ ...value, end: event.target.value }))} />
          </label>
        </div>
      </section>

      <section className="card">
        <DataTable
          rows={fileRows}
          empty={{
            eyebrow: 'No files yet',
            title: 'No private files match this view',
            description: 'Uploads from properties, cleaning, maintenance, expenses, reports, documents, contacts, and bookings will appear here after real files are uploaded.',
          }}
          columns={[
            {
              key: 'file',
              label: 'File',
              render: (row) => (
                <span>
                  <strong>{row.fileName || row.file_name || 'Workspace file'}</strong>
                  <small>{formatLabel(row.fileCategory || row.file_category || row.category)}</small>
                </span>
              ),
            },
            { key: 'context', label: 'Context', render: (row) => contextLabel(row, data) },
            { key: 'uploaded_by', label: 'Uploaded by', render: (row) => getUploaderName(row, data.members || []) },
            { key: 'created_at', label: 'Uploaded', render: (row) => formatDate(row.created_at || row.createdAt) },
            { key: 'size', label: 'Size', render: (row) => formatBytes(row.fileSize || row.file_size) },
            { key: 'type', label: 'Type', render: (row) => row.mimeType || row.mime_type || row.fileType || row.file_type || '—' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge tone={row.archivedAt || row.archived_at ? 'warning' : 'success'}>{row.archivedAt || row.archived_at ? 'archived' : 'private'}</StatusBadge>,
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="table-actions">
                  <button type="button" onClick={() => openFile(row)} disabled={busyId === row.id} data-skip-create-action="true">
                    <Download size={15} />
                    View
                  </button>
                  {canArchive && (
                    <button type="button" onClick={() => toggleArchive(row, !(row.archivedAt || row.archived_at))} disabled={busyId === row.id} data-skip-create-action="true">
                      {row.archivedAt || row.archived_at ? <RotateCcw size={15} /> : <Archive size={15} />}
                      {row.archivedAt || row.archived_at ? 'Restore' : 'Archive'}
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />

        {!fileRows.length && !(data.fileUploads || []).length && (
          <EmptyState
            compact
            icon={FileText}
            title="Private uploads will appear here"
            description="No fake or demo files are added. Upload a property document/photo or use cleaning, maintenance, expense, and report workflows after Supabase migrations and the private bucket are ready."
          />
        )}
      </section>

      {showUpload && <FileUploadPanel data={data} onClose={() => setShowUpload(false)} onUpload={uploadFile} uploading={uploading} />}
    </AppLayout>
  );
}
