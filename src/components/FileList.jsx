import React from 'react';
import { FileText } from 'lucide-react';

import { EmptyState } from './EmptyState.jsx';
import { FilePreviewCard } from './FilePreviewCard.jsx';

export function FileList({ files = [], onView, onArchive, canArchive = false, busyId = '', emptyTitle = 'No private files yet', emptyDescription = 'Private uploads will appear here after real files are added.' }) {
  if (!files.length) {
    return <EmptyState compact icon={FileText} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="file-list-grid">
      {files.map((file) => (
        <FilePreviewCard
          key={file.id || file.file_path || file.path}
          file={file}
          onView={onView}
          onArchive={onArchive}
          canArchive={canArchive}
          busy={busyId === file.id}
        />
      ))}
    </div>
  );
}
