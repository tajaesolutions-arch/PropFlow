import React from 'react';
import { Archive, Download, FileText, Image, ShieldCheck } from 'lucide-react';

import { StatusBadge } from './StatusBadge.jsx';

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCategory(value) {
  return String(value || 'general_document').replaceAll('_', ' ');
}

export function FilePreviewCard({ file, onView, onArchive, canArchive = false, busy = false }) {
  const mimeType = file?.mimeType || file?.mime_type || file?.fileType || file?.file_type || '';
  const isImage = mimeType.startsWith('image/');
  const archived = Boolean(file?.archivedAt || file?.archived_at);

  return (
    <article className={`file-preview-card ${archived ? 'is-archived' : ''}`}>
      <div className="file-preview-icon">{isImage ? <Image size={18} /> : <FileText size={18} />}</div>
      <div className="file-preview-content">
        <div className="file-preview-title-row">
          <strong>{file?.fileName || file?.file_name || 'Private file'}</strong>
          <StatusBadge tone={archived ? 'warning' : 'info'}>{archived ? 'archived' : 'private'}</StatusBadge>
        </div>
        <small>{formatCategory(file?.fileCategory || file?.file_category || file?.category)} · {mimeType || 'unknown'} · {formatBytes(file?.fileSize || file?.file_size)}</small>
        <span><ShieldCheck size={14} /> Short-lived signed viewing only</span>
      </div>
      <div className="file-preview-actions">
        {onView && (
          <button type="button" onClick={() => onView(file)} disabled={busy} data-skip-create-action="true">
            <Download size={14} /> View
          </button>
        )}
        {canArchive && onArchive && (
          <button type="button" onClick={() => onArchive(file, !archived)} disabled={busy} data-skip-create-action="true">
            <Archive size={14} /> {archived ? 'Restore' : 'Archive'}
          </button>
        )}
      </div>
    </article>
  );
}
