import React from 'react';
import { Camera, FileText, ImagePlus, LockKeyhole, Receipt, ShieldCheck, UploadCloud, Wrench } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const uploadManagerRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const cleaningUploadRoles = [...uploadManagerRoles, roles.CLEANER];
const maintenanceUploadRoles = [...uploadManagerRoles, roles.MAINTENANCE];
const financeUploadRoles = [...uploadManagerRoles, roles.ACCOUNTANT];

const uploadSetupStates = [
  {
    title: 'Property photos',
    description: 'Property gallery photos should use private storage and workspace-scoped access checks.',
    icon: ImagePlus,
    roles: uploadManagerRoles,
  },
  {
    title: 'Cleaning before/after photos',
    description: 'Cleaner media should be visible only to assigned cleaners and authorized workspace managers.',
    icon: Camera,
    roles: cleaningUploadRoles,
  },
  {
    title: 'Maintenance issue/completion photos',
    description: 'Repair media should be visible only to assigned maintenance users and authorized workspace managers.',
    icon: Wrench,
    roles: maintenanceUploadRoles,
  },
  {
    title: 'Documents, leases, and contracts',
    description: 'Legal documents must stay private and role-scoped. Do not expose public storage URLs.',
    icon: FileText,
    roles: [...uploadManagerRoles, roles.ACCOUNTANT, roles.OWNER],
  },
  {
    title: 'Receipts and invoices',
    description: 'Finance files should be private and limited to workspace owners, managers, and accountants.',
    icon: Receipt,
    roles: financeUploadRoles,
  },
];

function getEnvValue(key) {
  return import.meta.env?.[key]?.trim?.() || '';
}

function isStorageFlagConfigured() {
  return Boolean(getEnvValue('VITE_SUPABASE_STORAGE_CONFIGURED'));
}

function getVisibleSetupStates(currentUser) {
  return uploadSetupStates.filter((item) => hasAnyRole(currentUser, item.roles));
}

export function UploadSafetyNotice() {
  const { currentUser } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const storageConfigured = isStorageFlagConfigured();
  const visibleSetupStates = getVisibleSetupStates(currentUser);

  return (
    <section className="card upload-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Uploads and private storage</p>
          <h3>File/photo upload safety status</h3>
          <p>
            Upload UI is setup-gated until private Supabase Storage buckets, signed access rules,
            and workspace/role authorization checks are implemented.
          </p>
        </div>
        <UploadCloud size={22} className="muted" />
      </div>

      <div className="upload-safety-grid">
        <div className="upload-safety-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Storage configuration</strong>
            <small>
              {storageConfigured
                ? 'Storage readiness flag is present. Bucket policies and backend checks still need verification.'
                : 'Supabase Storage is not connected yet. Upload controls should remain disabled or setup-gated.'}
            </small>
          </span>
          <StatusBadge tone={storageConfigured ? 'info' : 'warning'}>
            {storageConfigured ? 'flag present' : 'not connected'}
          </StatusBadge>
        </div>

        <div className="upload-safety-card">
          <LockKeyhole size={18} />
          <span>
            <strong>Private by default</strong>
            <small>Operational files must use private buckets, signed URLs, workspace_id scoping, and role checks.</small>
          </span>
          <StatusBadge tone="warning">policy required</StatusBadge>
        </div>

        <div className="upload-safety-card">
          <UploadCloud size={18} />
          <span>
            <strong>Current upload state</strong>
            <small>Do not enable public upload links, public buckets, or public storage URLs in the MVP.</small>
          </span>
          <StatusBadge tone="warning">setup required</StatusBadge>
        </div>
      </div>

      <div className="upload-placeholder-grid" aria-label="Upload setup states by role">
        {visibleSetupStates.map((item) => {
          const Icon = item.icon;

          return (
            <div className="upload-placeholder-card" key={item.title}>
              <Icon size={17} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <StatusBadge tone="info">disabled</StatusBadge>
            </div>
          );
        })}

        {!visibleSetupStates.length && (
          <div className="upload-placeholder-card restricted">
            <LockKeyhole size={17} />
            <span>
              <strong>Upload access restricted</strong>
              <small>This role should not see upload actions unless explicitly assigned to a related task or property.</small>
            </span>
            <StatusBadge tone="error">{primaryRole || 'restricted'}</StatusBadge>
          </div>
        )}
      </div>

      <div className="helper upload-safety-helper">
        <LockKeyhole size={16} />
        Before enabling uploads, enforce private buckets, workspace_id ownership, assigned-user checks, file type limits, file size limits, and signed URL expiry.
      </div>
    </section>
  );
}
