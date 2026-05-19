export const WORKSPACE_FILES_BUCKET = 'workspace-files';

const MB = 1024 * 1024;

const allowedExtensionGroups = Object.freeze({
  image: ['jpg', 'jpeg', 'png', 'webp'],
  document: ['pdf', 'doc', 'docx'],
  spreadsheet: ['csv', 'xls', 'xlsx'],
  video: ['mp4', 'mov', 'webm'],
});

const extensionToMime = Object.freeze({
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
});

export const workspaceFileTypes = Object.freeze([
  'property_photo', 'property_document', 'cleaning_before_photo', 'cleaning_after_photo',
  'maintenance_issue_photo', 'maintenance_completion_photo', 'maintenance_video',
  'receipt', 'invoice', 'lease', 'contract', 'owner_report', 'report_file', 'general_document',
]);

export const workspaceEntityTypes = Object.freeze(['property', 'booking', 'cleaning_task', 'maintenance_work_order', 'owner_report', 'expense', 'workspace']);

export const legacyFileCategoryMap = Object.freeze({
  cleaning_photo: 'cleaning_before_photo', maintenance_photo: 'maintenance_issue_photo', repair_completion_photo: 'maintenance_completion_photo',
  cleaning_issue_photo: 'cleaning_before_photo', owner_report: 'report_file', property_document: 'general_document', other: 'general_document',
});

export const workspaceFileValidationRules = Object.freeze({
  property_photo: { extensions: allowedExtensionGroups.image, maxSizeBytes: 10 * MB },
  property_document: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
  cleaning_before_photo: { extensions: allowedExtensionGroups.image, maxSizeBytes: 10 * MB },
  cleaning_after_photo: { extensions: allowedExtensionGroups.image, maxSizeBytes: 10 * MB },
  maintenance_issue_photo: { extensions: allowedExtensionGroups.image, maxSizeBytes: 10 * MB },
  maintenance_completion_photo: { extensions: allowedExtensionGroups.image, maxSizeBytes: 10 * MB },
  maintenance_video: { extensions: allowedExtensionGroups.video, maxSizeBytes: 100 * MB },
  receipt: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet, ...allowedExtensionGroups.image], maxSizeBytes: 25 * MB },
  invoice: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet, ...allowedExtensionGroups.image], maxSizeBytes: 25 * MB },
  lease: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
  contract: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
  owner_report: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
  report_file: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
  general_document: { extensions: [...allowedExtensionGroups.document, ...allowedExtensionGroups.spreadsheet], maxSizeBytes: 25 * MB },
});

export function normalizeWorkspaceFileType(value = 'general_document') {
  const raw = String(value || '').trim().toLowerCase();
  const mapped = legacyFileCategoryMap[raw] || raw || 'general_document';
  return workspaceFileValidationRules[mapped] ? mapped : 'general_document';
}

export function sanitizeFileName(fileName = 'upload') {
  const base = String(fileName || 'upload').trim().split(/[/\\]/).pop() || 'upload';
  const cleaned = base.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-_.]+/, '').replace(/[-_.]+$/, '').slice(0, 120);
  return cleaned || 'upload';
}

function extFromName(name = '') { const part = String(name).toLowerCase().split('.').pop(); return part && part !== String(name).toLowerCase() ? part : ''; }
function fallbackId() { return globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2); }
const envReady = () => Boolean(import.meta?.env?.VITE_SUPABASE_URL && import.meta?.env?.VITE_SUPABASE_ANON_KEY);

export function getWorkspaceFilePath({ workspaceId, entityType = 'workspace', entityId = 'workspace', fileName = 'upload', timestamp = Date.now() } = {}) {
  if (!workspaceId) throw new Error('workspace_id is required.');
  const safeEntityType = workspaceEntityTypes.includes(entityType) ? entityType : 'workspace';
  const safeEntityId = sanitizeFileName(String(entityId || 'workspace'));
  const safeName = sanitizeFileName(fileName);
  return `workspaces/${sanitizeFileName(workspaceId)}/${safeEntityType}/${safeEntityId}/${timestamp}-${fallbackId()}-${safeName}`;
}

export function validateWorkspaceUploadFile(file, options = {}) {
  const fileCategory = normalizeWorkspaceFileType(options.fileCategory || options.file_type || options.fileType || options);
  const rule = workspaceFileValidationRules[fileCategory];
  if (!file) return { valid: false, error: 'Choose a file before uploading.' };
  const fileName = sanitizeFileName(file.name || 'upload');
  const extension = extFromName(fileName);
  if (!rule.extensions.includes(extension)) return { valid: false, error: 'This file type is not supported for this upload category.' };
  if (Number(file.size || 0) > rule.maxSizeBytes) return { valid: false, error: `File is too large. Maximum size is ${Math.round(rule.maxSizeBytes / MB)} MB.` };
  const mimeType = String(file.type || '').toLowerCase();
  if (mimeType && extensionToMime[extension] && !mimeType.includes(extensionToMime[extension].split('/')[0])) return { valid: false, error: 'File MIME type does not match the selected upload category.' };
  return { valid: true, error: '', fileCategory };
}

export function buildWorkspaceFilePayload(values = {}) {
  const fileCategory = normalizeWorkspaceFileType(values.file_category || values.fileCategory || values.category);
  return {
    workspace_id: String(values.workspace_id || values.workspaceId || '').trim() || null,
    entity_type: workspaceEntityTypes.includes(values.entity_type) ? values.entity_type : getEntityContext(values).entityType,
    entity_id: values.entity_id || getEntityContext(values).entityId || null,
    property_id: values.property_id || values.propertyId || null,
    booking_id: values.booking_id || values.bookingId || null,
    cleaning_task_id: values.cleaning_task_id || values.cleaningTaskId || null,
    maintenance_work_order_id: values.maintenance_work_order_id || values.maintenanceWorkOrderId || null,
    expense_id: values.expense_id || values.expenseId || null,
    report_id: values.report_id || values.reportId || null,
    contact_id: values.contact_id || values.contactId || null,
    uploaded_by: values.uploaded_by || values.userId || values.uploadedBy || null,
    file_name: values.file_name ? sanitizeFileName(values.file_name) : null,
    file_path: values.file_path || values.filePath || null,
    file_size: Number.isFinite(Number(values.file_size ?? values.fileSize)) ? Number(values.file_size ?? values.fileSize) : null,
    mime_type: String(values.mime_type || values.mimeType || '').trim() || null,
    file_category: fileCategory,
    visibility: 'private',
    status: String(values.status || '').trim() || 'active',
    notes: String(values.notes || '').trim() || null,
    metadata: values.metadata && typeof values.metadata === 'object' ? values.metadata : {},
    bucket_name: WORKSPACE_FILES_BUCKET,
  };
}

export const normalizeWorkspaceFile = (row = {}) => ({ ...row, fileCategory: normalizeWorkspaceFileType(row.file_category || row.category), fileName: row.file_name || null, filePath: row.file_path || row.path || null, workspaceId: row.workspace_id || null });

export function getEntityContext({ propertyId, bookingId, cleaningTaskId, maintenanceWorkOrderId, expenseId, reportId } = {}) { if (cleaningTaskId) return { entityType: 'cleaning_task', entityId: cleaningTaskId }; if (maintenanceWorkOrderId) return { entityType: 'maintenance_work_order', entityId: maintenanceWorkOrderId }; if (expenseId) return { entityType: 'expense', entityId: expenseId }; if (reportId) return { entityType: 'owner_report', entityId: reportId }; if (bookingId) return { entityType: 'booking', entityId: bookingId }; if (propertyId) return { entityType: 'property', entityId: propertyId }; return { entityType: 'workspace', entityId: 'workspace' }; }

export async function listWorkspaceFiles({ supabase, workspaceId, entityType, entityId } = {}) { if (!workspaceId) throw new Error('workspace_id is required.'); if (!supabase || !envReady()) return []; let q = supabase.from('file_uploads').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }); if (entityType) q = q.eq('entity_type', entityType); if (entityId) q = q.eq('entity_id', entityId); const { data, error } = await q; if (error) throw error; return (data || []).map(normalizeWorkspaceFile); }
export async function getWorkspaceFileById({ supabase, workspaceId, fileId } = {}) { if (!workspaceId || !fileId) throw new Error('workspace_id and fileId are required.'); if (!supabase || !envReady()) return null; const { data, error } = await supabase.from('file_uploads').select('*').eq('workspace_id', workspaceId).eq('id', fileId).maybeSingle(); if (error) throw error; return data ? normalizeWorkspaceFile(data) : null; }
export async function createWorkspaceFileMetadata({ supabase, workspaceId, userId, values } = {}) { if (!workspaceId) throw new Error('workspace_id is required.'); if (!supabase || !envReady()) return { data: null, error: new Error('Supabase is not configured.') }; const payload = buildWorkspaceFilePayload({ ...values, workspace_id: workspaceId, uploaded_by: userId }); const { data, error } = await supabase.from('file_uploads').insert(payload).select('*').single(); if (error) throw error; return normalizeWorkspaceFile(data); }
export async function updateWorkspaceFileMetadata({ supabase, workspaceId, fileId, values } = {}) { if (!workspaceId || !fileId) throw new Error('workspace_id and fileId are required.'); if (!supabase || !envReady()) return null; const payload = buildWorkspaceFilePayload(values); const { data, error } = await supabase.from('file_uploads').update(payload).eq('workspace_id', workspaceId).eq('id', fileId).select('*').single(); if (error) throw error; return normalizeWorkspaceFile(data); }
export async function deleteWorkspaceFileMetadata({ supabase, workspaceId, fileId } = {}) { if (!workspaceId || !fileId) throw new Error('workspace_id and fileId are required.'); if (!supabase || !envReady()) return null; const { data, error } = await supabase.from('file_uploads').delete().eq('workspace_id', workspaceId).eq('id', fileId).select('id').maybeSingle(); if (error) throw error; return data || null; }

export async function uploadWorkspaceFile({ supabase, workspaceId, userId, file, values = {}, bucket = WORKSPACE_FILES_BUCKET, metadata } = {}) {
  const workspaceScopedId = workspaceId || metadata?.workspace_id || values?.workspace_id;
  if (!workspaceScopedId) throw new Error('workspace_id is required.');
  if (!supabase || !envReady()) throw new Error('Supabase is not configured for private file uploads.');
  const validation = validateWorkspaceUploadFile(file, { fileCategory: values.file_category || metadata?.file_category || values.fileCategory });
  if (!validation.valid) throw new Error(validation.error);
  const payload = buildWorkspaceFilePayload({ ...values, ...metadata, workspace_id: workspaceScopedId, uploaded_by: userId || values.userId || metadata?.uploaded_by, file_category: validation.fileCategory });
  const path = payload.file_path || getWorkspaceFilePath({ workspaceId: workspaceScopedId, entityType: payload.entity_type, entityId: payload.entity_id, fileName: file.name });
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message || 'File upload failed.');
  const row = await createWorkspaceFileMetadata({ supabase, workspaceId: workspaceScopedId, userId: payload.uploaded_by, values: { ...payload, file_path: path, file_name: sanitizeFileName(file.name), file_size: file.size, mime_type: file.type, bucket_name: WORKSPACE_FILES_BUCKET } });
  return row;
}

export async function archiveWorkspaceFile({ supabase, workspaceId, fileId, archived = true } = {}) { return updateWorkspaceFileMetadata({ supabase, workspaceId, fileId, values: { status: archived ? 'archived' : 'active', archived_at: archived ? new Date().toISOString() : null } }); }
export async function getSignedFileUrl({ supabase, file, bucket = WORKSPACE_FILES_BUCKET, expiresIn = 300 } = {}) { if (!supabase || !file?.file_path) throw new Error('Select a private file to view.'); if ((file.bucket_name || file.bucket || bucket) !== WORKSPACE_FILES_BUCKET) throw new Error('This file is not stored in the private workspace file bucket.'); const { data, error } = await supabase.storage.from(bucket).createSignedUrl(file.file_path, expiresIn); if (error || !data?.signedUrl) throw error || new Error('Signed file link could not be created.'); return data.signedUrl; }
export const getPrivateFileUrl = getSignedFileUrl;
