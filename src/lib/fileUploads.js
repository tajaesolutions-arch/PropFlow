export const WORKSPACE_FILES_BUCKET = 'workspace-files';

export const allowedImageMimeTypes = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const allowedDocumentMimeTypes = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const workspaceFileTypes = Object.freeze([
  'property_photo',
  'cleaning_before_photo',
  'cleaning_after_photo',
  'maintenance_issue_photo',
  'maintenance_completion_photo',
  'receipt',
  'invoice',
  'lease',
  'contract',
  'report_file',
  'general_document',
]);

export const workspaceEntityTypes = Object.freeze([
  'property',
  'booking',
  'cleaning_task',
  'maintenance_work_order',
  'owner_report',
  'expense',
  'workspace',
]);

export const legacyFileCategoryMap = Object.freeze({
  cleaning_photo: 'cleaning_before_photo',
  maintenance_photo: 'maintenance_issue_photo',
  repair_completion_photo: 'maintenance_completion_photo',
  cleaning_issue_photo: 'cleaning_before_photo',
  owner_report: 'report_file',
  property_document: 'general_document',
  other: 'general_document',
});

export const workspaceFileValidationRules = Object.freeze({
  property_photo: { allowedTypes: allowedImageMimeTypes, maxSizeMB: 10 },
  cleaning_before_photo: { allowedTypes: allowedImageMimeTypes, maxSizeMB: 10 },
  cleaning_after_photo: { allowedTypes: allowedImageMimeTypes, maxSizeMB: 10 },
  maintenance_issue_photo: { allowedTypes: allowedImageMimeTypes, maxSizeMB: 10 },
  maintenance_completion_photo: { allowedTypes: allowedImageMimeTypes, maxSizeMB: 10 },
  receipt: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
  invoice: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
  lease: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
  contract: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
  report_file: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
  general_document: { allowedTypes: allowedDocumentMimeTypes, maxSizeMB: 25 },
});

export function normalizeWorkspaceFileType(value = 'general_document') {
  const normalized = legacyFileCategoryMap[value] || value || 'general_document';
  return workspaceFileValidationRules[normalized] ? normalized : 'general_document';
}

export function sanitizeFileName(fileName = 'upload') {
  const safeName = String(fileName || 'upload')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 120);

  return safeName || 'upload';
}

function getFallbackId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2);
}

export function getWorkspaceFilePath({ workspaceId, entityType = 'workspace', entityId = 'workspace', fileName = 'upload', timestamp = Date.now() } = {}) {
  if (!workspaceId) throw new Error('Workspace is required before uploading files.');

  const safeEntityType = workspaceEntityTypes.includes(entityType) ? entityType : 'workspace';
  const safeEntityId = sanitizeFileName(entityId || 'workspace');
  const safeName = sanitizeFileName(fileName);
  const uniquePrefix = `${timestamp}-${getFallbackId()}`;

  return `workspaces/${workspaceId}/${safeEntityType}/${safeEntityId}/${uniquePrefix}-${safeName}`;
}

export function validateUploadFile(file, allowedTypes = allowedDocumentMimeTypes, maxSizeMB = 25) {
  if (!file) return { valid: false, error: 'Choose a file before uploading.' };

  const mimeType = file.type || '';
  if (mimeType.startsWith('video/')) {
    return { valid: false, error: 'Video uploads coming soon.' };
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File is too large. Maximum size is ${maxSizeMB} MB.` };
  }

  if (mimeType && !allowedTypes.includes(mimeType)) {
    return { valid: false, error: 'This file type is not supported for private workspace uploads.' };
  }

  return { valid: true, error: '' };
}

export function validateWorkspaceUploadFile(file, fileType) {
  const normalizedType = normalizeWorkspaceFileType(fileType);
  const rule = workspaceFileValidationRules[normalizedType];
  return validateUploadFile(file, rule.allowedTypes, rule.maxSizeMB);
}

export function getEntityContext({ propertyId, bookingId, cleaningTaskId, maintenanceWorkOrderId, expenseId, reportId } = {}) {
  if (cleaningTaskId) return { entityType: 'cleaning_task', entityId: cleaningTaskId };
  if (maintenanceWorkOrderId) return { entityType: 'maintenance_work_order', entityId: maintenanceWorkOrderId };
  if (expenseId) return { entityType: 'expense', entityId: expenseId };
  if (reportId) return { entityType: 'owner_report', entityId: reportId };
  if (bookingId) return { entityType: 'booking', entityId: bookingId };
  if (propertyId) return { entityType: 'property', entityId: propertyId };
  return { entityType: 'workspace', entityId: 'workspace' };
}

export async function uploadWorkspaceFile(payload = {}) {
  const { supabase, file, metadata, bucket = WORKSPACE_FILES_BUCKET } = payload;
  if (!supabase) throw new Error('Supabase is not configured for private file uploads.');
  if (!file) throw new Error('Choose a file before uploading.');

  const fileType = normalizeWorkspaceFileType(metadata?.file_category || metadata?.fileType || metadata?.file_type);
  const validation = validateWorkspaceUploadFile(file, fileType);
  if (!validation.valid) throw new Error(validation.error);

  const context = getEntityContext({
    propertyId: metadata?.property_id,
    bookingId: metadata?.booking_id,
    cleaningTaskId: metadata?.cleaning_task_id,
    maintenanceWorkOrderId: metadata?.maintenance_work_order_id,
    expenseId: metadata?.expense_id,
    reportId: metadata?.report_id,
  });
  const storagePath = metadata?.file_path || getWorkspaceFilePath({
    workspaceId: metadata?.workspace_id,
    entityType: metadata?.entity_type || context.entityType,
    entityId: metadata?.entity_id || context.entityId,
    fileName: file.name,
  });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'File upload failed. Confirm the private workspace-files bucket and storage policies are applied.');
  }

  const rowPayload = {
    ...metadata,
    file_category: fileType,
    file_name: file.name,
    file_path: storagePath,
    bucket_name: bucket,
    mime_type: file.type || null,
    file_size: file.size || null,
    visibility: 'private',
    bucket,
    path: storagePath,
    file_type: file.type || null,
    category: fileType,
  };

  const { data, error: insertError } = await supabase
    .from('file_uploads')
    .insert(rowPayload)
    .select('*')
    .single();

  if (insertError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    throw insertError;
  }

  return data;
}

export async function listWorkspaceFiles({ supabase, workspaceId, filters = {} } = {}) {
  if (!supabase || !workspaceId) return [];

  let query = supabase.from('file_uploads').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });

  if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters.fileType) query = query.eq('file_category', normalizeWorkspaceFileType(filters.fileType));
  if (filters.activeOnly !== false) query = query.is('archived_at', null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function archiveWorkspaceFile({ supabase, workspaceId, fileId, archived = true } = {}) {
  if (!supabase || !workspaceId || !fileId) throw new Error('Select a private file to update.');

  const { data, error } = await supabase
    .from('file_uploads')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', fileId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getSignedFileUrl({ supabase, file, bucket = WORKSPACE_FILES_BUCKET, expiresIn = 300 } = {}) {
  if (!supabase || !file?.file_path) throw new Error('Select a private file to view.');
  if ((file.bucket_name || file.bucket || bucket) !== WORKSPACE_FILES_BUCKET) {
    throw new Error('This file is not stored in the private workspace file bucket.');
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(file.file_path, expiresIn);
  if (error || !data?.signedUrl) throw error || new Error('Signed file link could not be created.');
  return data.signedUrl;
}

export const getPrivateFileUrl = getSignedFileUrl;
