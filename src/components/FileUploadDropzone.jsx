import React from 'react';
import { FileUp, Loader2, ShieldCheck, X } from 'lucide-react';

import { validateWorkspaceUploadFile } from '../lib/fileUploads.js';

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadDropzone({ fileType = 'general_document', disabled = false, uploading = false, onFileSelect, status = '', error = '' }) {
  const inputRef = React.useRef(null);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [localError, setLocalError] = React.useState('');
  const [dragActive, setDragActive] = React.useState(false);

  const chooseFile = (file) => {
    setLocalError('');
    if (!file) {
      setSelectedFile(null);
      onFileSelect?.(null, '');
      return;
    }

    const validation = validateWorkspaceUploadFile(file, fileType);
    if (!validation.valid) {
      setSelectedFile(null);
      setLocalError(validation.error);
      onFileSelect?.(null, validation.error);
      return;
    }

    setSelectedFile(file);
    onFileSelect?.(file, '');
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled || uploading) return;
    chooseFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="file-upload-widget">
      <button
        type="button"
        className={`file-upload-dropzone ${dragActive ? 'is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        disabled={disabled || uploading}
        data-skip-create-action="true"
      >
        <span className="file-upload-icon">{uploading ? <Loader2 size={18} className="spin" /> : <FileUp size={18} />}</span>
        <span>
          <strong>{uploading ? 'Uploading privately…' : 'Choose a private file'}</strong>
          <small>JPEG, PNG, WebP images up to 10 MB. PDF, DOCX, XLSX documents up to 25 MB. Video uploads coming soon.</small>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      {selectedFile && (
        <div className="file-upload-selection">
          <ShieldCheck size={16} />
          <span>
            <strong>{selectedFile.name}</strong>
            <small>{selectedFile.type || 'Unknown type'} · {formatBytes(selectedFile.size)}</small>
          </span>
          <button type="button" onClick={() => chooseFile(null)} disabled={uploading} data-skip-create-action="true" aria-label="Clear selected file">
            <X size={14} />
          </button>
        </div>
      )}

      {(localError || error || status) && (
        <p className={`file-upload-message ${localError || error ? 'error' : 'success'}`}>{localError || error || status}</p>
      )}
    </div>
  );
}
