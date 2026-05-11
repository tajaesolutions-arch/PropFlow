import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { billingAccessRoles, billingEventTypes, billingManageRoles, billingPlans, calendarImportedEventStatuses, calendarImportedEventTypes, calendarImportConflictTypes, calendarImportProviderTypes, calendarImportStatuses, calendarImportSyncStatuses, currencies, deliveryStatuses, directBookingConfirmationModes, directBookingPageStatuses, directBookingPaymentModes, expenseCategories, expensePaymentStatuses, expenseStatuses, invitePermissionLevels, inviteRoleOptions, leasePaymentStatuses, leaseStatuses, leaseTypes, notificationChannels, notificationEventTypes, notificationPreferenceGroups, notificationStatuses, propertyAssignmentRoleOptions, propertyScopedInviteRoles, propertyStatuses, propertyTypes, rentalTypes, rentFrequencies, roles } from '../data/constants.js';
import { canAccessPlatformAdmin, resolvePrimaryRole } from './auth.js';
import { logActivity } from './activityLogs.js';
import { isSupabaseConfigured, supabase } from './supabase.js';
import { getBillingStatus } from './billingStatus.js';
import { WORKSPACE_FILES_BUCKET, getEntityContext, getWorkspaceFilePath, normalizeWorkspaceFileType, uploadWorkspaceFile as uploadPrivateWorkspaceFile, validateWorkspaceUploadFile } from './fileUploads.js';

const AppContext = createContext(null);

const storageKey = 'propflow.currentWorkspaceId';

const workspaceCreationCurrencies = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];

function normalizeWorkspaceCurrency(value) {
  return String(value || 'USD').trim().toUpperCase();
}

function getErrorText(error) {
  return [error?.message, error?.details, error?.hint, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function formatAuthError(error, fallback = 'Authentication failed.') {
  const combined = getErrorText(error);
  const status = Number(error?.status || 0);

  if (combined.includes('already registered') || combined.includes('already exists') || combined.includes('user already')) {
    return 'This email is already registered. Log in instead, or use password reset if needed.';
  }

  if (combined.includes('password') && (combined.includes('weak') || combined.includes('short') || status === 422)) {
    return 'Choose a stronger password. Use at least 8 characters and avoid common passwords.';
  }

  if (combined.includes('email not confirmed') || combined.includes('confirm')) {
    return 'Email confirmation is required. Check your inbox, confirm your account, then log in again.';
  }

  if (combined.includes('invalid login') || combined.includes('invalid credentials')) {
    return 'Email or password is incorrect. Check your credentials and try again.';
  }

  if (combined.includes('failed to fetch') || combined.includes('network') || combined.includes('timeout')) {
    return 'Could not reach Supabase. Check your connection and try again.';
  }

  return fallback;
}

function formatWorkspaceCreationError(error) {
  const code = String(error?.code || '');
  const combined = getErrorText(error);

  if (combined.includes('failed to fetch') || combined.includes('network') || combined.includes('timeout')) {
    return 'Network issue while creating the workspace. Check your connection and try again.';
  }

  if (combined.includes('workspace_name_required') || combined.includes('null value')) {
    return 'Workspace/business name is required.';
  }

  if (combined.includes('missing_authenticated_session') || code === '28000') {
    return 'Your session expired. Sign in again before creating a workspace.';
  }

  if (combined.includes('invalid_default_currency') || combined.includes('default_currency')) {
    return 'Choose a supported launch currency: USD, JMD, CAD, GBP, or EUR.';
  }

  if (combined.includes('schema cache')) {
    return 'Workspace setup RPC is not visible to Supabase yet. Confirm the create_workspace_with_owner migration is applied, then wait briefly, reload the app, and try again.';
  }

  if (combined.includes('could not find the function') || combined.includes('function public.create_workspace_with_owner') || code === 'PGRST202' || code === '42883') {
    return 'Workspace setup is not deployed yet. Ask an admin to apply the create_workspace_with_owner RPC migration.';
  }

  if (combined.includes('row-level security') || combined.includes('permission denied') || code === '42501') {
    return 'Workspace setup is blocked by database security rules. Ask an admin to verify the workspace creation RPC grant and RLS migration.';
  }

  if (combined.includes('workspace_created_but_membership_failed')) {
    return 'Workspace setup could not finish assigning your owner membership. Please try again or contact support.';
  }

  if (combined.includes('workspace_creation_validation_failed')) {
    return 'Workspace setup could not be saved. Check the workspace details and try again.';
  }

  return 'Workspace could not be created. Please try again.';
}

const emptyData = {
  properties: [],
  cleaningTasks: [],
  maintenanceWorkOrders: [],
  bookings: [],
  leases: [],
  contacts: [],
  supplies: [],
  notifications: [],
  notificationPreferences: [],
  notificationDeliveryLogs: [],
  notificationProviderSettings: [],
  unreadNotificationCount: 0,
  activityLogs: [],
  ownerReports: [],
  fileUploads: [],
  invites: [],
  members: [],
  propertyAssignments: [],
  expenses: [],
  subscription: null,
  billingEvents: [],
  billingPlanLimits: [],
  billingAccessState: { allowed: true, warning: false, restricted: false, recoveryOnly: false, reason: 'not_configured', gracePeriodEndsAt: null },
  billingTablesReady: false,
  directBookingPages: [],
  directBookingRequests: [],
  calendarImportFeeds: [],
  calendarImportEvents: [],
  calendarImportSyncRuns: [],
  calendarImportConflicts: [],
  calendarImportTablesReady: true,
  platformOverview: null,
  platformWorkspaces: [],
  platformUsers: [],
  platformWorkspaceDetail: null,
  platformHealthReport: null,
  platformAdminAuditLogs: [],
  platformAdminNotes: [],
  platformAdminSetupRequired: false,
  platformAdminError: '',
};

function firstResult(data) {
  return Array.isArray(data) ? data[0] : data;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanNumber(value) {
  if (value === '' || value === undefined || value === null) return null;

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
    return null;
  }

  const numericValue = Number(cleanValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function cleanEmail(value) {
  const text = String(value || '').trim().toLowerCase();
  return text || null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function cleanRoleArray(value, allowedRoles = inviteRoleOptions) {
  const rawRoles = Array.isArray(value) ? value : [value];
  const normalized = Array.from(new Set(rawRoles.map((role) => String(role || '').trim()).filter(Boolean)));
  const invalidRoles = normalized.filter((role) => !allowedRoles.includes(role));

  if (invalidRoles.length) {
    throw new Error('Select valid customer workspace roles only. PropFlow Admin cannot be assigned inside customer workspaces.');
  }

  return normalized;
}

function cleanPhone(value) {
  const text = String(value || '')
    .replace(/[^+\d()\-.\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}

function normalizeWorkspace(row) {
  if (!row) return null;

  return {
    ...row,
    defaultCurrency: row.default_currency || row.defaultCurrency || 'USD',
    code: row.company_code || row.code,
  };
}

function normalizeProperty(row) {
  if (!row) return row;

  return {
    ...row,
    rentalType: row.rental_type,
    propertyType: row.property_type,
    nightlyRate: row.nightly_rate,
    monthlyRent: row.monthly_rent,
    squareFeet: row.square_feet,
    assignedOwnerId: row.assigned_owner_id,
    archivedAt: row.archived_at,
  };
}

function normalizeCleaning(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    assignedCleanerId: row.assigned_cleaner_id,
    scheduledFor: row.scheduled_for,
    checklist: row.checklist_items || [],
    cleanerNotes: row.cleaner_notes,
    suppliesUsed: row.supplies_used,
  };
}

function normalizeMaintenance(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    status: normalizeMaintenanceStatus(row.status),
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    description: row.description || row.issue_description || '',
    issueDescription: row.description || row.issue_description || '',
    assignedMaintenanceId: row.assigned_maintenance_id,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    partsNeeded: row.parts_needed,
    due: row.due_date,
  };
}

function normalizeBooking(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    contactId: row.contact_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestCount: row.guest_count,
    paymentStatus: row.payment_status,
    totalAmount: row.total_amount,
    cleaningFee: row.cleaning_fee,
    taxesFees: row.taxes_fees,
    ownerPayout: row.owner_payout,
    autoCreateCleaning: row.auto_create_cleaning,
    cancelledAt: row.cancelled_at,
  };
}

function normalizeLease(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    tenantContactId: row.tenant_contact_id || row.contact_id,
    contactId: row.tenant_contact_id || row.contact_id,
    leaseType: row.lease_type || 'fixed_term',
    leaseStatus: row.lease_status || 'draft',
    tenantName: row.tenant_name,
    tenantEmail: row.tenant_email,
    tenantPhone: row.tenant_phone,
    leaseStart: row.lease_start,
    leaseEnd: row.lease_end,
    rentAmount: row.rent_amount ?? row.monthly_rent ?? 0,
    monthlyRent: row.rent_amount ?? row.monthly_rent ?? 0,
    rentFrequency: row.rent_frequency || 'monthly',
    securityDepositAmount: row.security_deposit_amount ?? row.security_deposit,
    securityDeposit: row.security_deposit_amount ?? row.security_deposit,
    depositStatus: row.deposit_status || 'not_tracked',
    paymentStatus: row.payment_status || row.rent_payment_status || 'not_tracked',
    rentPaymentStatus: row.payment_status || row.rent_payment_status || 'not_tracked',
    dueDay: row.due_day,
    gracePeriodDays: row.grace_period_days,
    lateFeeAmount: row.late_fee_amount,
    leaseDocumentFileId: row.lease_document_file_id,
    moveInNotes: row.move_in_notes,
    moveOutNotes: row.move_out_notes,
    internalNotes: row.internal_notes || row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    archivedAt: row.archived_at,
    terminatedAt: row.terminated_at,
  };
}

function normalizeSupply(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || 'Workspace supply',
    propertyId: row.property_id,
    itemName: row.item_name,
    currentQuantity: row.current_quantity,
    lowStockThreshold: row.low_stock_threshold,
    supplierName: row.supplier_name,
    supplierContact: row.supplier_contact,
    estimatedUnitCost: row.estimated_unit_cost,
    archivedAt: row.archived_at,
  };
}

function normalizeMember(row) {
  if (!row) return row;

  const profile = row.profiles || row.profile || null;

  return {
    ...row,
    profile,
    profiles: profile,
  };
}

function normalizeContact(row) {
  if (!row) return row;

  return {
    ...row,
    name: row.full_name || row.name,
    fullName: row.full_name || row.name,
    contactType: row.contact_type,
  };
}

function normalizeReport(row) {
  if (!row) return row;

  return {
    ...row,
    propertyId: row.property_id,
    ownerId: row.owner_id,
    contactId: row.contact_id,
    reportType: row.report_type || row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    summary: row.summary || row.notes,
    summaryData: row.summary_data || {},
    fileId: row.file_id,
    generatedBy: row.generated_by || row.created_by,
    archivedAt: row.archived_at,
  };
}

function normalizeFileUpload(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    bookingId: row.booking_id,
    cleaningTaskId: row.cleaning_task_id,
    maintenanceWorkOrderId: row.maintenance_work_order_id,
    expenseId: row.expense_id,
    reportId: row.report_id,
    contactId: row.contact_id,
    fileCategory: row.file_category || row.category,
    fileName: row.file_name,
    filePath: row.file_path || row.path,
    bucketName: row.bucket_name || row.bucket || 'workspace-files',
    mimeType: row.mime_type || row.file_type,
    fileType: row.mime_type || row.file_type,
    fileSize: row.file_size,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    uploadedBy: row.uploaded_by,
    archivedAt: row.archived_at,
    visibility: row.visibility || 'private',
  };
}

function normalizeExpense(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Workspace-level expense',
    propertyId: row.property_id,
    bookingId: row.booking_id,
    maintenanceWorkOrderId: row.maintenance_work_order_id,
    cleaningTaskId: row.cleaning_task_id,
    contactId: row.contact_id,
    vendorName: row.vendor_name,
    expenseDate: row.expense_date,
    paymentStatus: row.payment_status,
    expenseStatus: row.expense_status,
    receiptFileId: row.receipt_file_id,
    createdBy: row.created_by,
    archivedAt: row.archived_at,
  };
}



function normalizeDirectBookingPage(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    pageTitle: row.page_title,
    bookingMode: row.booking_mode,
    paymentMode: row.payment_mode,
    allowInquiries: row.allow_inquiries,
    allowBookingRequests: row.allow_booking_requests,
    requireGuestPhone: row.require_guest_phone,
    requireGuestMessage: row.require_guest_message,
    minNights: row.min_nights,
    maxNights: row.max_nights,
    baseRate: row.base_rate,
    cleaningFee: row.cleaning_fee,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    checkInInstructions: row.check_in_instructions,
    cancellationPolicy: row.cancellation_policy,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeDirectBookingRequest(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    directBookingPageId: row.direct_booking_page_id,
    inquiryType: row.inquiry_type,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestCount: row.guest_count,
    quotedRate: row.quoted_rate,
    quotedCleaningFee: row.quoted_cleaning_fee,
    quotedTotal: row.quoted_total,
    convertedBookingId: row.converted_booking_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    declineReason: row.decline_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}


function normalizeCalendarImportFeed(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    providerType: row.provider_type,
    feedUrl: row.feed_url,
    importAs: row.import_as,
    autoCreateBookings: row.auto_create_bookings,
    autoCreateCleaningTasks: row.auto_create_cleaning_tasks,
    lastSyncStatus: row.last_sync_status,
    lastSyncAt: row.last_sync_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    lastError: row.last_error,
    createdBy: row.created_by,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCalendarImportEvent(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    feedId: row.feed_id,
    externalUid: row.external_uid,
    externalSequence: row.external_sequence,
    externalEtag: row.external_etag,
    eventType: row.event_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    sourcePlatform: row.source_platform,
    importedBookingId: row.imported_booking_id,
    rawEvent: row.raw_event,
    conflictSummary: row.conflict_summary,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCalendarImportSyncRun(row, feeds = [], properties = []) {
  if (!row) return row;

  const feed = feeds.find((item) => item.id === row.feed_id);
  const property = properties.find((item) => item.id === row.property_id) || properties.find((item) => item.id === feed?.propertyId);

  return {
    ...row,
    workspaceId: row.workspace_id,
    feedId: row.feed_id,
    feedName: feed?.name || 'Calendar feed',
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    startedAt: row.started_at,
    completedAt: row.completed_at,
    eventsFound: row.events_found,
    eventsCreated: row.events_created,
    eventsUpdated: row.events_updated,
    eventsIgnored: row.events_ignored,
    conflictsFound: row.conflicts_found,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function normalizeCalendarImportConflict(row, feeds = [], events = [], properties = []) {
  if (!row) return row;

  const feed = feeds.find((item) => item.id === row.feed_id);
  const importedEvent = events.find((item) => item.id === row.imported_event_id);
  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    workspaceId: row.workspace_id,
    propertyId: row.property_id,
    property: property?.name || row.property || 'Unassigned property',
    feedId: row.feed_id,
    feedName: feed?.name || 'Calendar feed',
    importedEventId: row.imported_event_id,
    importedEventTitle: importedEvent?.title || 'Imported calendar block',
    conflictType: row.conflict_type,
    relatedBookingId: row.related_booking_id,
    relatedLeaseId: row.related_lease_id,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function normalizeNotification(row) {
  if (!row) return row;

  return {
    ...row,
    type: row.event_type || row.type || 'workspace_activity',
    message: row.body || row.message || '',
    workspaceId: row.workspace_id,
    recipientUserId: row.recipient_user_id,
    recipientRole: row.recipient_role,
    actorUserId: row.actor_user_id,
    eventType: row.event_type || row.type,
    relatedPropertyId: row.related_property_id,
    relatedBookingId: row.related_booking_id,
    relatedCleaningTaskId: row.related_cleaning_task_id,
    relatedMaintenanceWorkOrderId: row.related_maintenance_work_order_id,
    relatedExpenseId: row.related_expense_id,
    relatedReportId: row.related_report_id,
    relatedFileUploadId: row.related_file_upload_id,
    relatedInviteId: row.related_invite_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionUrl: row.action_url,
    readAt: row.read_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeNotificationPreference(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    eventGroup: row.event_group,
    inAppEnabled: row.in_app_enabled,
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    whatsappEnabled: row.whatsapp_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeNotificationDeliveryLog(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    notificationId: row.notification_id,
    recipientUserId: row.recipient_user_id,
    recipientAddress: row.recipient_address,
    errorMessage: row.error_message,
    providerMessageId: row.provider_message_id,
    attemptedAt: row.attempted_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeActivityLog(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  };
}

function normalizeNotificationProviderSetting(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to,
    senderPhoneLabel: row.sender_phone_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSubscription(row) {
  if (!row) return null;

  return {
    ...row,
    workspaceId: row.workspace_id,
    billingProvider: row.billing_provider,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
    paymentFailedAt: row.payment_failed_at,
    gracePeriodStartedAt: row.grace_period_started_at,
    gracePeriodEndsAt: row.grace_period_ends_at,
    restrictedAt: row.restricted_at,
    restoredAt: row.restored_at,
    lastWebhookEventId: row.last_webhook_event_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBillingEvent(row) {
  if (!row) return row;

  return {
    ...row,
    workspaceId: row.workspace_id,
    subscriptionId: row.subscription_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    providerEventId: row.provider_event_id,
    createdAt: row.created_at,
  };
}

function normalizeBillingPlanLimit(row) {
  if (!row) return row;

  return {
    ...row,
    maxProperties: row.max_properties,
    maxTeamMembers: row.max_team_members,
    maxFileStorageMb: row.max_file_storage_mb,
    includesOwnerReports: row.includes_owner_reports,
    includesInventory: row.includes_inventory,
    includesAccountantDashboard: row.includes_accountant_dashboard,
    includesDirectBooking: row.includes_direct_booking,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tableIsMissing(error) {
  const text = getErrorText(error);
  return error?.code === '42P01' || error?.code === 'PGRST205' || text.includes('does not exist') || text.includes('schema cache');
}

function userHasAnyWorkspaceRole(currentUser, memberships, currentWorkspace, allowedRoles) {
  if (currentUser?.roles?.includes(roles.ADMIN)) return true;
  return getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace).some((role) => allowedRoles.includes(role));
}

export function getWorkspaceBillingGate(currentWorkspace, subscription, currentUser) {
  if (!currentWorkspace?.id || !subscription) {
    return { allowed: true, warning: false, restricted: false, recoveryOnly: false, reason: 'no_subscription', gracePeriodEndsAt: null };
  }

  if (currentUser?.roles?.includes(roles.ADMIN)) {
    return { allowed: true, warning: false, restricted: false, recoveryOnly: false, reason: 'platform_admin', gracePeriodEndsAt: null };
  }

  const billingStatus = getBillingStatus(subscription, currentUser);
  const rawStatus = String(subscription.status || '').toLowerCase();
  const isBillingRole = currentUser?.roles?.some((role) => billingAccessRoles.includes(role));

  if (['trialing', 'active', 'no_subscription'].includes(billingStatus.normalizedStatus)) {
    return { allowed: true, warning: false, restricted: false, recoveryOnly: false, reason: billingStatus.normalizedStatus, gracePeriodEndsAt: billingStatus.gracePeriodEndsAt };
  }

  if (billingStatus.isInGracePeriod) {
    return { allowed: true, warning: true, restricted: false, recoveryOnly: false, reason: 'grace_period', gracePeriodEndsAt: billingStatus.gracePeriodEndsAt };
  }

  if (billingStatus.isRestricted || ['restricted', 'past_due', 'unpaid', 'grace_period'].includes(rawStatus)) {
    return { allowed: Boolean(isBillingRole), warning: true, restricted: true, recoveryOnly: Boolean(isBillingRole), reason: 'billing_restricted', gracePeriodEndsAt: billingStatus.gracePeriodEndsAt };
  }

  return { allowed: true, warning: ['incomplete', 'canceled'].includes(billingStatus.normalizedStatus), restricted: false, recoveryOnly: false, reason: billingStatus.normalizedStatus, gracePeriodEndsAt: billingStatus.gracePeriodEndsAt };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using database actions.',
    );
  }

  return supabase;
}

const PLAN_LIMIT_ERROR_MESSAGES = [
  'Your current plan has reached the property limit. Upgrade your plan to add more properties.',
  'Your current plan has reached the team member limit. Upgrade your plan to invite more team members.',
  'Your current plan has reached the owner report limit for this month. Upgrade your plan or wait until next month.',
  'Direct booking pages are not available on this plan.',
  'Your workspace billing needs attention before adding premium records.',
  'Plan property limit reached. Upgrade your plan to add more properties.',
  'Plan team member limit reached. Upgrade your plan to invite more team members.',
  'Monthly owner report limit reached. Upgrade your plan or wait until next month.',
  'Direct booking pages are available on Pro and Business plans.',
  'Billing recovery is required before premium workspace operations can continue.',
];

const PLAN_LIMIT_ERROR_MAP = new Map([
  ['Plan property limit reached. Upgrade your plan to add more properties.', 'Your current plan has reached the property limit. Upgrade your plan to add more properties.'],
  ['Plan team member limit reached. Upgrade your plan to invite more team members.', 'Your current plan has reached the team member limit. Upgrade your plan to invite more team members.'],
  ['Monthly owner report limit reached. Upgrade your plan or wait until next month.', 'Your current plan has reached the owner report limit for this month. Upgrade your plan or wait until next month.'],
  ['Direct booking pages are available on Pro and Business plans.', 'Direct booking pages are not available on this plan.'],
  ['Billing recovery is required before premium workspace operations can continue.', 'Your workspace billing needs attention before adding premium records.'],
]);

function formatSupabaseError(error, fallback = 'The database action failed.') {
  if (!error) return fallback;

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  const message = parts.join(' ');
  const lowerMessage = message.toLowerCase();

  const planLimitMessage = PLAN_LIMIT_ERROR_MESSAGES.find((safeMessage) => message.includes(safeMessage));
  if (planLimitMessage) return PLAN_LIMIT_ERROR_MAP.get(planLimitMessage) || planLimitMessage;

  if (error.code === 'P0001' && (lowerMessage.includes('plan') || lowerMessage.includes('billing'))) {
    return 'This action is blocked by your workspace plan limits. Upgrade your plan to continue.';
  }

  if (error.code === '23505') return 'A record with these details already exists.';
  if (error.code === '23503') return 'This record is linked to missing or unavailable workspace data.';
  if (error.code === '23514') return 'This record does not meet PropFlow workspace rules.';
  if (error.code === '42501' || lowerMessage.includes('row-level security')) {
    return 'You do not have permission to complete this action.';
  }

  if (/sqlstate|\bp\d{4}\b|function|trigger|stack|json|undefined|null/i.test(message)) {
    return fallback;
  }

  return message || fallback;
}

function requireWorkspaceSession(workspace, activeSession) {
  if (!workspace?.id) {
    throw new Error('No workspace selected. Select or create a workspace before saving.');
  }

  if (!activeSession?.user?.id) {
    throw new Error('Your session expired. Sign in again before saving.');
  }
}

function inviteToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSavedWorkspaceId() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function saveWorkspaceId(workspaceId) {
  try {
    if (workspaceId) window.localStorage.setItem(storageKey, workspaceId);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Local storage may be unavailable in strict browser modes.
  }
}

async function safeQuery(label, query, fallback = []) {
  try {
    const { data, error } = await query;

    if (error) {
      console.error(`[PropFlow] Could not load ${label}`, error);
      return { data: fallback, error };
    }

    return { data: data || fallback, error: null };
  } catch (error) {
    console.error(`[PropFlow] Could not load ${label}`, error);
    return { data: fallback, error };
  }
}

function getWorkspaceCode(workspace) {
  return workspace?.company_code || workspace?.code || '';
}

function makeDateTimeFromDate(value, fallback = new Date()) {
  if (!value) return fallback.toISOString();

  const text = String(value).trim();
  const date = new Date(text.includes('T') ? text : `${text}T11:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Select a valid scheduled date and time.');
  }

  return date.toISOString();
}

function stripUnsupportedPayloadKeys(payload, allowedKeys) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => allowedKeys.includes(key) && value !== undefined),
  );
}

const scopedInviteRoles = propertyScopedInviteRoles;
const supportedContactTypes = ['owner', 'guest', 'tenant', 'vendor', 'cleaner', 'maintenance', 'other'];

const maintenancePriorities = ['low', 'medium', 'high', 'urgent'];
const maintenanceStatuses = ['reported', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];
const maintenanceClosedStatuses = ['completed', 'cancelled'];

const reportTypes = [
  'owner_report',
  'owner_statement',
  'revenue_report',
  'expense_report',
  'occupancy_report',
  'maintenance_cost_report',
  'cleaning_cost_report',
  'property_performance_report',
  'property_performance',
  'booking_summary',
];
const reportStatuses = ['draft', 'ready', 'exported', 'released', 'published', 'sent', 'delivered', 'completed', 'archived'];

function normalizeMaintenanceStatus(value) {
  if (value === 'open') return 'reported';
  if (value === 'waiting_for_parts') return 'waiting_parts';
  return value || 'reported';
}

function cleanNonNegativeMoney(value, label) {
  const numericValue = cleanNumber(value);

  if (numericValue === null) return null;
  if (numericValue < 0) throw new Error(`${label} must be 0 or more.`);

  return numericValue;
}

function cleanOptionalDateOnly(value, label) {
  if (!value) return null;

  const dateValue = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(new Date(`${dateValue}T00:00:00`).getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return dateValue;
}

const workspaceActionRoles = {
  property: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  booking: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  cleaning: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  maintenance: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  contact: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  ownerContact: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  guestContact: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  invite: [roles.OWNER_ADMIN],
  teamLifecycle: [roles.OWNER_ADMIN],
  propertyAssignment: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  report: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT],
  expense: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  inventory: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  directBooking: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  calendarImport: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  lease: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
};


const calendarImportProviderTypeValues = calendarImportProviderTypes.map(([value]) => value);
const calendarImportStatusValues = calendarImportStatuses.map(([value]) => value);
const calendarImportSyncStatusValues = calendarImportSyncStatuses.map(([value]) => value);
const calendarImportedEventStatusValues = calendarImportedEventStatuses.map(([value]) => value);
const calendarImportedEventTypeValues = calendarImportedEventTypes.map(([value]) => value);
const calendarImportConflictTypeValues = calendarImportConflictTypes.map(([value]) => value);
const calendarImportManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

const notificationChannelValues = notificationChannels.map(([value]) => value);
const notificationEventTypeValues = notificationEventTypes.map(([value]) => value);
const notificationPreferenceGroupValues = notificationPreferenceGroups.map(([value]) => value);
const notificationStatusValues = notificationStatuses.map(([value]) => value);
const deliveryStatusValues = deliveryStatuses.map(([value]) => value);
const notificationPriorities = ['low', 'normal', 'high', 'urgent'];
const notificationManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const limitedOperationalNotificationTypes = ['cleaning_task_completed', 'cleaning_task_issue_reported', 'maintenance_work_order_completed'];
const providerManagerRoles = [roles.OWNER_ADMIN];
const externalNotificationChannels = ['email', 'sms', 'whatsapp'];
const blockedProviderSettingKeys = ['api_key', 'apikey', 'apiKey', 'token', 'auth_token', 'authToken', 'secret', 'webhook_secret', 'webhookSecret', 'service_role', 'serviceRole'];

function getNotificationEventGroup(eventType) {
  if (eventType === 'property_created') return 'workspace_activity';
  if (String(eventType || '').startsWith('booking_')) return 'bookings';
  if (String(eventType || '').startsWith('cleaning_')) return 'cleaning';
  if (String(eventType || '').startsWith('maintenance_')) return 'maintenance';
  if (String(eventType || '').startsWith('owner_report_')) return 'owner_reports';
  if (String(eventType || '').startsWith('expense_')) return 'finance';
  if (eventType === 'low_stock_alert') return 'inventory';
  if (eventType === 'file_uploaded') return 'files';
  if (['team_invite_created', 'team_member_invited', 'team_invite_accepted', 'member_suspended', 'member_reactivated'].includes(eventType)) return 'team';
  if (String(eventType || '').startsWith('billing_') || ['payment_failed', 'workspace_billing_restricted'].includes(eventType)) return 'billing';
  if (String(eventType || '').startsWith('lease_')) return 'leases';
  if (String(eventType || '').startsWith('ical_')) return 'calendar_imports';
  return 'workspace_activity';
}

function getActiveWorkspaceMembers(members, workspaceId) {
  return asArray(members).filter((member) => member.workspace_id === workspaceId && member.status === 'active');
}

function getWorkspaceManagers(members, workspaceId) {
  return getActiveWorkspaceMembers(members, workspaceId).filter((member) =>
    asArray(member.roles).some((role) => notificationManagerRoles.includes(role)),
  );
}

function getWorkspaceOwners(members, workspaceId) {
  return getActiveWorkspaceMembers(members, workspaceId).filter((member) => asArray(member.roles).includes(roles.OWNER_ADMIN));
}

function isUnreadNotification(notification) {
  return notification?.status === 'unread' && !notification?.read_at && !notification?.readAt && !notification?.archived_at && !notification?.archivedAt;
}

const workspaceFileBucket = WORKSPACE_FILES_BUCKET;
const fileManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const hostFileCategories = [
  'property_photo',
  'cleaning_before_photo',
  'cleaning_after_photo',
  'maintenance_issue_photo',
  'maintenance_completion_photo',
  'general_document',
];
const accountantFileCategories = ['receipt', 'invoice', 'report_file', 'general_document'];
const cleanerFileCategories = ['cleaning_before_photo', 'cleaning_after_photo'];
const maintenanceFileCategories = ['maintenance_issue_photo', 'maintenance_completion_photo', 'receipt'];

function normalizeFileCategory(value = 'general_document') {
  return normalizeWorkspaceFileType(value);
}

function assertFileTypeAndSize(file, fileCategory) {
  const validation = validateWorkspaceUploadFile(file, fileCategory);
  if (!validation.valid) throw new Error(validation.error);
}

function buildWorkspaceFilePath(workspaceId, context, file) {
  const entityContext = getEntityContext(context);
  return getWorkspaceFilePath({
    workspaceId,
    entityType: entityContext.entityType,
    entityId: entityContext.entityId,
    fileName: file?.name,
  });
}

function getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace) {
  const activeMembership = asArray(memberships).find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status === 'active',
  );

  return asArray(activeMembership?.roles || currentUser?.membership?.roles);
}

function assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, action) {
  const allowedRoles = workspaceActionRoles[action] || [];
  const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);

  if (!allowedRoles.some((role) => activeRoles.includes(role))) {
    throw new Error('Your current workspace role cannot create this type of record.');
  }
}

function requireWorkspaceProperty(properties, propertyId, label = 'property') {
  const property = asArray(properties).find((item) => item.id === propertyId);

  if (!property) {
    throw new Error(`Select an existing ${label} in this workspace.`);
  }

  return property;
}

function optionalWorkspaceProperty(properties, propertyId, label = 'property') {
  if (!propertyId) return null;
  return requireWorkspaceProperty(properties, propertyId, label);
}

function memberUserId(member) {
  return member?.user_id || member?.userId || member?.id || '';
}

function requireActiveWorkspaceMemberWithRole(members, userId, role, label) {
  if (!userId) return null;

  const member = asArray(members).find((item) => memberUserId(item) === userId);

  if (!member || member.status !== 'active' || !asArray(member.roles).includes(role)) {
    throw new Error(`${label} must be an active workspace ${role.replaceAll('_', ' ')}.`);
  }

  return member;
}

function normalizeChecklistItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireAllowedValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw new Error(`Select a valid ${label}.`);
  }
}

function cleanDateOnly(value, label) {
  const dateValue = String(value || '').slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error(`${label} is required.`);
  }

  return dateValue;
}

function cleanPositiveInteger(value, label) {
  const numericValue = Number(value || 1);

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new Error(`${label} must be at least 1.`);
  }

  return numericValue;
}

function findActiveWorkspaceMember(members, workspaceId, userId) {
  if (!userId) return null;

  return asArray(members).find(
    (member) =>
      member.workspace_id === workspaceId &&
      member.status === 'active' &&
      (member.user_id === userId || member.userId === userId || member.id === userId),
  );
}

function assertAssignedOwnerIsWorkspaceMember(members, workspaceId, assignedOwnerId) {
  if (!assignedOwnerId) return;

  const member = findActiveWorkspaceMember(members, workspaceId, assignedOwnerId);

  if (!member || !asArray(member.roles).includes(roles.OWNER)) {
    throw new Error('Assigned owner must be an active Property Owner member in this workspace.');
  }
}

function assertOwnerContactIsWorkspaceOwner(contacts, contactId) {
  if (!contactId) return;

  const contact = asArray(contacts).find((item) => item.id === contactId);

  if (!contact || contact.contact_type !== 'owner') {
    throw new Error('Selected owner contact must be an owner contact in this workspace.');
  }
}

function cleanNonNegativeNumber(value, label) {
  const numericValue = cleanNumber(value);

  if (numericValue !== null && numericValue < 0) {
    throw new Error(`${label} must be 0 or more.`);
  }

  return numericValue;
}

const expenseCategoryValues = expenseCategories.map(([value]) => value);
const expensePaymentStatusValues = expensePaymentStatuses.map(([value]) => value);
const expenseStatusValues = expenseStatuses.map(([value]) => value);
const directBookingPageStatusValues = directBookingPageStatuses.map(([value]) => value);
const directBookingPaymentModeValues = directBookingPaymentModes.map(([value]) => value);
const directBookingConfirmationModeValues = directBookingConfirmationModes.map(([value]) => value);
const leaseStatusValues = leaseStatuses.map(([value]) => value);
const leasePaymentStatusValues = leasePaymentStatuses.map(([value]) => value);
const leaseTypeValues = leaseTypes.map(([value]) => value);
const rentFrequencyValues = rentFrequencies.map(([value]) => value);
const sensitiveHostExpenseCategories = ['owner_payout', 'property_tax', 'insurance'];

function getRecordPropertyId(record) {
  return record?.property_id || record?.propertyId || null;
}

function requireWorkspaceScopedRecord(records, recordId, label, propertyId = null) {
  if (!recordId) return null;

  const record = asArray(records).find((item) => item.id === recordId);
  if (!record) throw new Error(`Selected ${label} must belong to this workspace.`);

  const recordPropertyId = getRecordPropertyId(record);
  if (propertyId && recordPropertyId && recordPropertyId !== propertyId) {
    throw new Error(`Selected ${label} must match the selected property.`);
  }

  return record;
}

function cleanExpenseAmount(value) {
  const numericValue = cleanNumber(value);

  if (numericValue === null) throw new Error('Expense amount is required.');
  if (numericValue < 0) throw new Error('Expense amount must be 0 or more.');

  return numericValue;
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [currentUser, setCurrentUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState(null);
  const [data, setData] = useState(emptyData);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataWarnings, setDataWarnings] = useState([]);
  const [error, setError] = useState('');

  const refreshWorkspaceData = async (workspace = currentWorkspace, activeSession = session) => {
    if (!supabase || !workspace?.id || !activeSession?.user?.id) {
      setData(emptyData);
      setDataWarnings([]);
      setDataLoading(false);
      return { ok: true, warnings: [] };
    }

    setDataLoading(true);

    const workspaceId = workspace.id;
    const nextData = { ...emptyData };
    const warnings = [];

    const propertiesResponse = await safeQuery(
      'properties',
      supabase
        .from('properties')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    );

    if (propertiesResponse.error) warnings.push(`properties: ${formatSupabaseError(propertiesResponse.error)}`);

    const properties = asArray(propertiesResponse.data).map(normalizeProperty);
    nextData.properties = properties;

    const workspaceQueries = [
      {
        label: 'workspace members',
        key: 'members',
        query: supabase
          .from('workspace_members')
          .select('*, profiles:profiles!workspace_members_user_id_fkey(full_name, email)')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        normalize: (rows) => rows.map(normalizeMember),
      },
      {
        label: 'bookings',
        key: 'bookings',
        query: supabase
          .from('bookings')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('check_in', { ascending: true }),
        normalize: (rows) => rows.map((row) => normalizeBooking(row, properties)),
      },
      {
        label: 'leases',
        key: 'leases',
        query: supabase
          .from('leases')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('lease_start', { ascending: false })
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeLease(row, properties)),
      },
      {
        label: 'contacts',
        key: 'contacts',
        query: supabase
          .from('contacts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('updated_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeContact),
      },
      {
        label: 'cleaning tasks',
        key: 'cleaningTasks',
        query: supabase
          .from('cleaning_tasks')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('scheduled_for', { ascending: true }),
        normalize: (rows) => rows.map((row) => normalizeCleaning(row, properties)),
      },
      {
        label: 'maintenance work orders',
        key: 'maintenanceWorkOrders',
        query: supabase
          .from('maintenance_work_orders')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeMaintenance(row, properties)),
      },
      {
        label: 'supplies',
        key: 'supplies',
        query: supabase
          .from('supplies')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeSupply(row, properties)),
      },
      {
        label: 'workspace invites',
        key: 'invites',
        query: supabase
          .from('workspace_invites')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows,
      },
      {
        label: 'property assignments',
        key: 'propertyAssignments',
        query: supabase
          .from('property_assignments')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows,
      },
      {
        label: 'file uploads',
        key: 'fileUploads',
        query: supabase
          .from('file_uploads')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeFileUpload),
      },
      {
        label: 'direct booking pages',
        key: 'directBookingPages',
        query: supabase
          .from('direct_booking_pages')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeDirectBookingPage(row, properties)),
      },
      {
        label: 'direct booking requests',
        key: 'directBookingRequests',
        query: supabase
          .from('direct_booking_requests')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeDirectBookingRequest(row, properties)),
      },
      {
        label: 'calendar import feeds',
        key: 'calendarImportFeeds',
        query: supabase
          .from('calendar_import_feeds')
          .select('*')
          .eq('workspace_id', workspaceId)
          .is('archived_at', null)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeCalendarImportFeed(row, properties)),
      },
      {
        label: 'calendar import events',
        key: 'calendarImportEvents',
        query: supabase
          .from('calendar_import_events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .is('archived_at', null)
          .order('starts_at', { ascending: true })
          .limit(500),
        normalize: (rows) => rows.map((row) => normalizeCalendarImportEvent(row, properties)),
      },
      {
        label: 'calendar import sync runs',
        key: 'calendarImportSyncRuns',
        query: supabase
          .from('calendar_import_sync_runs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(50),
        normalize: (rows) => rows.map((row) => normalizeCalendarImportSyncRun(row, nextData.calendarImportFeeds, properties)),
      },
      {
        label: 'calendar import conflicts',
        key: 'calendarImportConflicts',
        query: supabase
          .from('calendar_import_conflicts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .in('status', ['open', 'acknowledged'])
          .order('created_at', { ascending: false })
          .limit(100),
        normalize: (rows) => rows.map((row) => normalizeCalendarImportConflict(row, nextData.calendarImportFeeds, nextData.calendarImportEvents, properties)),
      },
      {
        label: 'notifications',
        key: 'notifications',
        query: supabase
          .from('notifications')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(100),
        normalize: (rows) => rows.map(normalizeNotification),
      },
      {
        label: 'notification preferences',
        key: 'notificationPreferences',
        query: supabase
          .from('notification_preferences')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', activeSession.user.id)
          .order('event_group', { ascending: true }),
        normalize: (rows) => rows.map(normalizeNotificationPreference),
      },
      {
        label: 'notification provider settings',
        key: 'notificationProviderSettings',
        query: supabase
          .from('notification_provider_settings')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('channel', { ascending: true }),
        normalize: (rows) => rows.map(normalizeNotificationProviderSetting),
      },
      {
        label: 'notification delivery logs',
        key: 'notificationDeliveryLogs',
        query: supabase
          .from('notification_delivery_logs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(50),
        normalize: (rows) => rows.map(normalizeNotificationDeliveryLog),
      },
      {
        label: 'activity logs',
        key: 'activityLogs',
        query: supabase
          .from('activity_logs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(50),
        normalize: (rows) => rows.map(normalizeActivityLog),
      },
      {
        label: 'owner reports',
        key: 'ownerReports',
        query: supabase
          .from('owner_reports')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeReport),
      },
      {
        label: 'expenses',
        key: 'expenses',
        query: supabase
          .from('expenses')
          .select('id, workspace_id, property_id, booking_id, maintenance_work_order_id, cleaning_task_id, contact_id, category, description, vendor_name, expense_date, amount, currency, payment_status, expense_status, receipt_file_id, notes, created_by, created_at, updated_at, archived_at')
          .eq('workspace_id', workspaceId)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeExpense(row, properties)),
      },
      {
        label: 'workspace subscription',
        key: 'subscription',
        query: supabase
          .from('workspace_subscriptions')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle(),
        normalize: (row) => normalizeSubscription(firstResult(row)),
      },
      {
        label: 'billing events',
        key: 'billingEvents',
        query: supabase
          .from('billing_events')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(50),
        normalize: (rows) => rows.map(normalizeBillingEvent),
      },
      {
        label: 'billing plan limits',
        key: 'billingPlanLimits',
        query: supabase
          .from('billing_plan_limits')
          .select('*')
          .order('plan', { ascending: true }),
        normalize: (rows) => rows.map(normalizeBillingPlanLimit),
      },
    ];

    const results = await Promise.all(
      workspaceQueries.map(async (item) => {
        const result = await safeQuery(item.label, item.query);
        return { ...item, ...result };
      }),
    );

    results.forEach((result) => {
      if (result.error) {
        warnings.push(`${result.label}: ${formatSupabaseError(result.error)}`);
        if (['workspace subscription', 'billing events', 'billing plan limits'].includes(result.label) && tableIsMissing(result.error)) {
          console.warn('[PropFlow] Billing tables are not available yet. Apply the billing subscription foundation migration.');
        }
      }
      if (result.key === 'subscription') {
        nextData.subscription = result.error ? null : result.normalize(result.data);
      } else {
        nextData[result.key] = result.error ? [] : result.normalize(asArray(result.data));
      }
    });

    nextData.billingTablesReady = !results.some((result) => ['subscription', 'billingEvents', 'billingPlanLimits'].includes(result.key) && tableIsMissing(result.error));
    nextData.calendarImportTablesReady = !results.some((result) => ['calendarImportFeeds', 'calendarImportEvents', 'calendarImportSyncRuns', 'calendarImportConflicts'].includes(result.key) && tableIsMissing(result.error));
    nextData.billingAccessState = getWorkspaceBillingGate(workspace, nextData.subscription, currentUser);
    nextData.unreadNotificationCount = asArray(nextData.notifications).filter((notification) => isUnreadNotification(notification) && (notification.recipient_user_id || notification.recipientUserId) === activeSession.user.id).length;

    setData(nextData);
    setDataWarnings(warnings);
    setDataLoading(false);

    return {
      ok: warnings.length === 0,
      warnings,
    };
  };

  const loadAccount = async () => {
    if (!supabase) {
      setAuthLoading(false);
      setSession(null);
      setCurrentUser(null);
      setMemberships([]);
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setData(emptyData);
      return {
        session: null,
        currentUser: null,
        memberships: [],
        workspaces: [],
        currentWorkspace: null,
      };
    }

    setAuthLoading(true);
    setError('');

    try {
      const sessionResponse = await supabase.auth.getSession();
      const activeSession = sessionResponse.data?.session || null;
      const user = activeSession?.user || null;

      setSession(activeSession);

      if (!user) {
        setCurrentUser(null);
        setMemberships([]);
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
        setData(emptyData);
        saveWorkspaceId(null);

        return {
          session: null,
          currentUser: null,
          memberships: [],
          workspaces: [],
          currentWorkspace: null,
        };
      }

      let profile = null;

      const profileResponse = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileResponse.error) {
        console.warn('[PropFlow] Could not load profile, using auth user fallback.', profileResponse.error);
      } else {
        profile = profileResponse.data;
      }

      if (!profile) {
        const profilePayload = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.fullName || user.user_metadata?.full_name || user.email || '',
          status: 'active',
          is_propflow_admin: false,
        };

        const upsertResponse = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        profile = upsertResponse.data || profilePayload;
      }

      const membershipResponse = await supabase
        .from('workspace_members')
        .select('*, workspaces(*)')
        .eq('user_id', user.id)
        .neq('status', 'revoked')
        .order('created_at', { ascending: true });

      const membershipRows = membershipResponse.error ? [] : membershipResponse.data || [];
      const normalizedMemberships = membershipRows.map((membership) => ({
        ...membership,
        workspace: normalizeWorkspace(membership.workspaces),
        workspaces: normalizeWorkspace(membership.workspaces),
      }));

      const workspaceRows = normalizedMemberships
        .map((membership) => membership.workspace || membership.workspaces)
        .filter(Boolean);

      const savedWorkspaceId = getSavedWorkspaceId();
      const activeMembership =
        normalizedMemberships.find(
          (membership) =>
            membership.workspace_id === savedWorkspaceId &&
            membership.status === 'active' &&
            membership.workspace,
        ) ||
        normalizedMemberships.find(
          (membership) => membership.status === 'active' && membership.workspace,
        ) ||
        normalizedMemberships.find((membership) => membership.workspace);
      const hasActiveWorkspaceMembership = normalizedMemberships.some((membership) => membership.status === 'active' && membership.workspace);
      const selectedMembershipStatus = activeMembership?.status || 'active';
      const accountStatus = profile?.account_status || profile?.status || 'active';
      const effectiveAccountStatus = accountStatus === 'suspended' || (!hasActiveWorkspaceMembership && selectedMembershipStatus === 'suspended')
        ? 'suspended'
        : accountStatus;

      const activeWorkspace = normalizeWorkspace(activeMembership?.workspace || activeMembership?.workspaces);

      if (activeWorkspace?.id) {
        saveWorkspaceId(activeWorkspace.id);
      }

      const memberRoles = Array.from(
        new Set(normalizedMemberships.filter((membership) => membership.status === 'active').flatMap((membership) => asArray(membership.roles))),
      );

      const userRoles = profile?.is_propflow_admin
        ? [roles.ADMIN, ...memberRoles]
        : memberRoles;

      const accountUser = {
        ...profile,
        id: user.id,
        email: profile?.email || user.email,
        fullName: profile?.full_name || profile?.fullName || user.email,
        full_name: profile?.full_name || profile?.fullName || user.email,
        status: effectiveAccountStatus,
        account_status: effectiveAccountStatus,
        roles: userRoles,
        role: resolvePrimaryRole(userRoles),
        workspaceId: activeWorkspace?.id || null,
        workspace_id: activeWorkspace?.id || null,
        membership: activeMembership || null,
      };

      setCurrentUser(accountUser);
      setMemberships(normalizedMemberships);
      setWorkspaces(workspaceRows);
      setCurrentWorkspaceState(activeWorkspace || null);

      if (activeWorkspace?.id) {
        await refreshWorkspaceData(activeWorkspace, activeSession);
      } else {
        setData(emptyData);
      }

      return {
        session: activeSession,
        currentUser: accountUser,
        memberships: normalizedMemberships,
        workspaces: workspaceRows,
        currentWorkspace: activeWorkspace || null,
      };
    } catch (loadError) {
      console.error('[PropFlow] Account load failed', loadError);
      setError(loadError?.message || 'Could not load account.');
      return {
        session: null,
        currentUser: null,
        memberships: [],
        workspaces: [],
        currentWorkspace: null,
      };
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    loadAccount().catch((loadError) => {
      if (!mounted) return;
      console.error('[PropFlow] Initial account load failed', loadError);
      setError(loadError?.message || 'Could not load PropFlow.');
      setAuthLoading(false);
    });

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession || null);

      window.setTimeout(() => {
        if (mounted) loadAccount();
      }, 0);
    });

    return () => {
      mounted = false;
      subscription?.data?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrentWorkspace = async (workspaceId) => {
    const workspace = workspaces.find((item) => item.id === workspaceId) || null;

    setCurrentWorkspaceState(workspace);
    saveWorkspaceId(workspace?.id || null);

    if (workspace?.id) {
      await refreshWorkspaceData(workspace);
    } else {
      setData(emptyData);
    }

    return workspace;
  };

  const signIn = async (email, password) => {
    const client = requireSupabase();

    const { data: authData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw new Error(formatAuthError(signInError, 'Login failed.'));

    const accountState = await loadAccount();

    return {
      ...authData,
      accountState,
    };
  };

  const signUp = async ({ fullName, email, password }) => {
    const client = requireSupabase();

    const { data: authData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          fullName,
          full_name: fullName,
        },
      },
    });

    if (signUpError) throw new Error(formatAuthError(signUpError, 'Signup failed.'));

    if (authData?.user?.id) {
      const { error: profileError } = await client.from('profiles').upsert(
        {
          id: authData.user.id,
          full_name: fullName,
          email: cleanEmail(email),
          status: 'active',
          is_propflow_admin: false,
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        console.warn('[PropFlow] Signup profile upsert was deferred or blocked by RLS.', profileError);
      }
    }

    if (authData?.session) {
      await loadAccount();
    }

    return authData;
  };

  const signOut = async () => {
    const client = requireSupabase();

    await client.auth.signOut();

    setSession(null);
    setCurrentUser(null);
    setMemberships([]);
    setWorkspaces([]);
    setCurrentWorkspaceState(null);
    setData(emptyData);
    saveWorkspaceId(null);
  };

  const createWorkspace = async (payload) => {
    const client = requireSupabase();

    if (!session?.user?.id) {
      throw new Error('Your session expired. Sign in again before creating a workspace.');
    }

    const name = cleanText(payload.name);

    if (!name) {
      throw new Error('Workspace/business name is required.');
    }

    const defaultCurrency = normalizeWorkspaceCurrency(payload.default_currency || payload.defaultCurrency);

    if (!workspaceCreationCurrencies.includes(defaultCurrency)) {
      throw new Error('Choose a supported launch currency: USD, JMD, CAD, GBP, or EUR.');
    }

    const rpcPayload = {
      p_name: name,
      p_business_type: cleanText(payload.business_type),
      p_country: cleanText(payload.country) || 'United States',
      p_default_currency: defaultCurrency,
      p_business_email: cleanEmail(payload.business_email),
      p_phone: cleanText(payload.phone),
      p_website: cleanText(payload.website),
      p_property_count_estimate: cleanNumber(payload.property_count_estimate),
      p_plan_placeholder: billingPlans.map(([value]) => value).includes(cleanText(payload.plan_placeholder || payload.plan)) ? cleanText(payload.plan_placeholder || payload.plan) : 'starter',
    };

    let rpcResponse;

    try {
      rpcResponse = await client.rpc('create_workspace_with_owner', rpcPayload);
    } catch (rpcError) {
      console.warn('[PropFlow] create_workspace_with_owner network/runtime failure', rpcError);
      throw new Error(formatWorkspaceCreationError(rpcError));
    }

    const { data: workspaceData, error: workspaceError } = rpcResponse;

    if (workspaceError) {
      console.warn('[PropFlow] create_workspace_with_owner failed', workspaceError);
      throw new Error(formatWorkspaceCreationError(workspaceError));
    }

    const workspace = normalizeWorkspace(firstResult(workspaceData));

    if (!workspace?.id) {
      console.warn('[PropFlow] create_workspace_with_owner returned no workspace row', workspaceData);
      throw new Error('Workspace setup could not finish assigning your owner membership. Please try again or contact support.');
    }

    saveWorkspaceId(workspace.id);

    try {
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      await client.from('workspace_subscriptions').insert({
        workspace_id: workspace.id,
        plan: rpcPayload.p_plan_placeholder,
        status: 'trialing',
        billing_provider: 'stripe',
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        metadata: { initialized_from: 'workspace_setup' },
        created_by: session.user.id,
      });
    } catch (billingSetupError) {
      console.warn('[PropFlow] Workspace created but billing trial initialization was skipped. Apply the billing migration if needed.', billingSetupError);
    }

    await loadAccount();

    return workspace;
  };

  const joinWorkspace = async ({ token, code }) => {
    const client = requireSupabase();

    if (!session?.user?.id) {
      throw new Error('Log in before joining a workspace.');
    }

    const value = String(token || code || '').trim();

    if (!value) {
      throw new Error('Enter a valid invite token or company code.');
    }

    const currentEmail = cleanEmail(currentUser?.email || session.user.email);

    if (!currentEmail) {
      throw new Error('Your signed-in account needs an email address before joining a workspace.');
    }

    let inviteQuery = client
      .from('workspace_invites')
      .select('*')
      .eq('status', 'pending')
      .eq('email', currentEmail)
      .limit(1);

    if (token) {
      inviteQuery = inviteQuery.eq('token', value);
    } else {
      inviteQuery = inviteQuery.eq('workspace_code', value);
    }

    const { data: inviteRows, error: inviteError } = await inviteQuery;
    if (inviteError) {
      throw new Error(formatSupabaseError(inviteError, 'Could not validate invite.'));
    }

    const invite = inviteRows?.[0];

    if (!invite) {
      throw new Error('Invite not found, expired, or already used.');
    }

    const invitedEmail = cleanEmail(invite.email);

    if (!invitedEmail || invitedEmail !== currentEmail) {
      throw new Error('This invite was created for a different email address. Log in with the invited email to join.');
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new Error('Invite not found, expired, or already used.');
    }

    const inviteRoles = asArray(invite.roles).filter((role) => inviteRoleOptions.includes(role));

    if (!inviteRoles.length || inviteRoles.length !== asArray(invite.roles).length) {
      throw new Error('This invite contains an unsupported role. Ask the workspace owner to send a new invite.');
    }

    const invitedPropertyIds = asArray(invite.assigned_property_ids).filter(Boolean);
    const requiresAssignedProperties = inviteRoles.some((role) => scopedInviteRoles.includes(role));

    if (requiresAssignedProperties && !invitedPropertyIds.length) {
      throw new Error('This invite is missing required property assignments. Ask the workspace owner to send a new invite.');
    }

    const { error: memberError } = await client.from('workspace_members').upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: session.user.id,
        roles: inviteRoles,
        status: 'active',
        invited_by: invite.invited_by || null,
      },
      { onConflict: 'workspace_id,user_id' },
    );

    if (memberError) {
      console.warn('[PropFlow] Workspace invite membership insert failed', memberError);
      throw new Error(formatSupabaseError(memberError, 'Could not join workspace.'));
    }

    const { error: acceptError } = await client
      .from('workspace_invites')
      .update({
        status: 'accepted',
        accepted_by: session.user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)
      .eq('status', 'pending');

    if (acceptError) {
      console.warn('[PropFlow] Workspace invite status update failed after membership creation', acceptError);
    } else {
      await writeActivityLog('team_invite_accepted', { invite_id: invite.id, roles: inviteRoles, assigned_property_ids: invitedPropertyIds }, invite.workspace_id);
      try {
        const ownerRows = getWorkspaceOwners(data.members, invite.workspace_id);
        await Promise.all(ownerRows.map((member) => safeCreateNotification({
          recipient_user_id: memberUserId(member),
          event_type: 'team_invite_accepted',
          title: 'Team invite accepted',
          body: `${currentEmail} joined the workspace.`,
          priority: 'normal',
          related_invite_id: invite.id,
          action_url: '/team',
        })));
      } catch (notificationError) {
        console.warn('[PropFlow] Invite accepted notification skipped', notificationError);
      }
    }

    saveWorkspaceId(invite.workspace_id);
    await loadAccount();

    return invite;
  };

  const createProperty = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'property');

    const allowed = [
      'name',
      'address',
      'city',
      'state',
      'country',
      'property_type',
      'rental_type',
      'currency',
      'status',
      'nightly_rate',
      'monthly_rent',
      'assigned_owner_id',
      'bedrooms',
      'bathrooms',
      'square_feet',
      'notes',
    ];

    const propertyPayload = stripUnsupportedPayloadKeys(payload, allowed);

    propertyPayload.workspace_id = currentWorkspace.id;
    propertyPayload.created_by = session.user.id;
    propertyPayload.name = cleanText(propertyPayload.name);
    propertyPayload.address = cleanText(propertyPayload.address);

    if (!propertyPayload.name) throw new Error('Property name is required.');
    if (!propertyPayload.address) throw new Error('Address or location is required.');
    propertyPayload.city = cleanText(propertyPayload.city);
    propertyPayload.state = cleanText(propertyPayload.state);
    propertyPayload.country = cleanText(propertyPayload.country) || currentWorkspace.country || 'United States';
    propertyPayload.property_type = propertyPayload.property_type || 'short_term_rental';
    propertyPayload.rental_type = propertyPayload.rental_type || 'short_term';
    propertyPayload.currency = propertyPayload.currency || currentWorkspace.defaultCurrency || 'USD';
    propertyPayload.status = propertyPayload.status || 'active';
    propertyPayload.notes = cleanText(propertyPayload.notes);
    propertyPayload.assigned_owner_id = propertyPayload.assigned_owner_id || null;

    requireAllowedValue(propertyPayload.property_type, propertyTypes, 'property type');
    requireAllowedValue(propertyPayload.rental_type, rentalTypes, 'rental type');
    requireAllowedValue(propertyPayload.currency, currencies, 'currency');
    requireAllowedValue(propertyPayload.status, propertyStatuses, 'property status');
    // Database triggers enforce paid property limits; frontend gating remains UX guidance only.
    assertAssignedOwnerIsWorkspaceMember(memberships, currentWorkspace.id, propertyPayload.assigned_owner_id);
    propertyPayload.nightly_rate = cleanNonNegativeNumber(propertyPayload.nightly_rate, 'Nightly rate');
    propertyPayload.monthly_rent = cleanNonNegativeNumber(propertyPayload.monthly_rent, 'Monthly rent');
    propertyPayload.bedrooms = cleanNonNegativeNumber(propertyPayload.bedrooms, 'Bedrooms');
    propertyPayload.bathrooms = cleanNonNegativeNumber(propertyPayload.bathrooms, 'Bathrooms');
    propertyPayload.square_feet = cleanNonNegativeNumber(propertyPayload.square_feet, 'Square footage');

    const { data: row, error: insertError } = await client
      .from('properties')
      .insert(propertyPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Property could not be saved.'));

    await writeActivityLog('property_created', { property_id: row.id, property_name: row.name, status: row.status });
    await notifyWorkspaceManagers({
      event_type: 'property_created',
      title: 'Property created',
      body: `${row.name || 'A property'} was added to this workspace.`,
      priority: 'normal',
      related_property_id: row.id,
      entity_type: 'property',
      entity_id: row.id,
      action_url: '/properties',
      channels: ['in_app'],
    });
    if (row.assigned_owner_id) {
      await safeCreateNotification({
        recipient_user_id: row.assigned_owner_id,
        event_type: 'property_created',
        title: 'Property assigned',
        body: `${row.name || 'A property'} is assigned to you in PropFlow.`,
        priority: 'normal',
        related_property_id: row.id,
        entity_type: 'property',
        entity_id: row.id,
        action_url: '/owner-dashboard',
        channels: ['in_app'],
      });
    }
    await refreshWorkspaceData();

    return normalizeProperty(row);
  };

  const updateProperty = async (propertyId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'name',
      'address',
      'city',
      'state',
      'country',
      'property_type',
      'rental_type',
      'currency',
      'status',
      'nightly_rate',
      'monthly_rent',
      'assigned_owner_id',
      'bedrooms',
      'bathrooms',
      'square_feet',
      'notes',
      'archived_at',
    ];

    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'property');

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if ('name' in updatePayload) updatePayload.name = cleanText(updatePayload.name);
    if ('address' in updatePayload) updatePayload.address = cleanText(updatePayload.address);
    if ('city' in updatePayload) updatePayload.city = cleanText(updatePayload.city);
    if ('state' in updatePayload) updatePayload.state = cleanText(updatePayload.state);
    if ('country' in updatePayload) updatePayload.country = cleanText(updatePayload.country);
    if ('notes' in updatePayload) updatePayload.notes = cleanText(updatePayload.notes);
    if ('assigned_owner_id' in updatePayload) updatePayload.assigned_owner_id = updatePayload.assigned_owner_id || null;

    if ('name' in updatePayload && !updatePayload.name) throw new Error('Property name is required.');
    if ('address' in updatePayload && !updatePayload.address) throw new Error('Address or location is required.');
    if ('property_type' in updatePayload) requireAllowedValue(updatePayload.property_type, propertyTypes, 'property type');
    if ('rental_type' in updatePayload) requireAllowedValue(updatePayload.rental_type, rentalTypes, 'rental type');
    if ('currency' in updatePayload) requireAllowedValue(updatePayload.currency, currencies, 'currency');
    if ('status' in updatePayload) requireAllowedValue(updatePayload.status, propertyStatuses, 'property status');
    if ('assigned_owner_id' in updatePayload) {
      assertAssignedOwnerIsWorkspaceMember(memberships, currentWorkspace.id, updatePayload.assigned_owner_id);
    }

    const numericLabels = {
      nightly_rate: 'Nightly rate',
      monthly_rent: 'Monthly rent',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      square_feet: 'Square footage',
    };

    ['nightly_rate', 'monthly_rent', 'bedrooms', 'bathrooms', 'square_feet'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNonNegativeNumber(updatePayload[key], numericLabels[key]);
    });

    const { data: row, error: updateError } = await client
      .from('properties')
      .update(updatePayload)
      .eq('id', propertyId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Property could not be updated.'));

    await writeActivityLog(updatePayload.status === 'archived' || updatePayload.archived_at ? 'property_archived' : 'property_updated', {
      property_id: row.id,
      property_name: row.name,
      status: row.status,
      changed_fields: Object.keys(updatePayload),
    });
    await refreshWorkspaceData();

    return normalizeProperty(row);
  };

  const archiveProperty = async (propertyId, archived = true) =>
    updateProperty(propertyId, {
      status: archived ? 'archived' : 'active',
      archived_at: archived ? new Date().toISOString() : null,
    });

  const createOrUpdateContact = async ({
    full_name,
    name,
    email,
    phone,
    contact_type = 'other',
    notes,
  }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    if (!supportedContactTypes.includes(contact_type)) {
      throw new Error('Unsupported contact type.');
    }

    const normalizedContactType = contact_type;
    const action = normalizedContactType === 'owner' ? 'ownerContact' : normalizedContactType === 'guest' ? 'guestContact' : 'contact';
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, action);

    const fullName = cleanText(full_name || name);

    if (!fullName) {
      throw new Error('Contact name is required.');
    }

    const normalizedEmail = cleanEmail(email);
    const normalizedPhone = cleanPhone(phone);
    const normalizedNotes = cleanText(notes);

    const rpcPayload = {
      p_workspace_id: currentWorkspace.id,
      p_full_name: fullName,
      p_email: normalizedEmail,
      p_phone: normalizedPhone,
      p_contact_type: normalizedContactType,
      p_notes: normalizedNotes,
    };

    const rpcResponse = await client.rpc('create_or_update_contact', rpcPayload);

    if (!rpcResponse.error && rpcResponse.data) {
      await refreshWorkspaceData();
      return normalizeContact(firstResult(rpcResponse.data));
    }

    const fallbackPayload = {
      workspace_id: currentWorkspace.id,
      full_name: fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      contact_type: normalizedContactType,
      notes: normalizedNotes,
      created_by: session.user.id,
    };

    let fallbackQuery = client.from('contacts').select('*').eq('workspace_id', currentWorkspace.id).limit(1);

    if (normalizedEmail) {
      fallbackQuery = fallbackQuery.eq('email', normalizedEmail);
    } else if (normalizedPhone) {
      fallbackQuery = fallbackQuery.eq('phone', normalizedPhone).eq('contact_type', normalizedContactType);
    } else {
      fallbackQuery = fallbackQuery.eq('full_name', fullName).eq('contact_type', normalizedContactType);
    }

    const existingResponse = await fallbackQuery.maybeSingle();

    if (existingResponse.error) {
      throw new Error(formatSupabaseError(existingResponse.error, 'Contact could not be checked for duplicates.'));
    }

    const saveResponse = existingResponse.data
      ? await client
          .from('contacts')
          .update({
            full_name: fullName,
            phone: normalizedPhone || existingResponse.data.phone || null,
            contact_type: normalizedContactType,
            notes: normalizedNotes || existingResponse.data.notes || null,
          })
          .eq('id', existingResponse.data.id)
          .eq('workspace_id', currentWorkspace.id)
          .select('*')
          .single()
      : await client
          .from('contacts')
          .insert(fallbackPayload)
          .select('*')
          .single();

    if (saveResponse.error) {
      throw new Error(formatSupabaseError(saveResponse.error, 'Contact could not be saved.'));
    }

    await refreshWorkspaceData();

    return normalizeContact(saveResponse.data);
  };

  const createContact = (payload) => createOrUpdateContact(payload);
  const createOwner = (payload) => createOrUpdateContact({ ...payload, contact_type: 'owner' });
  const createGuest = (payload) => createOrUpdateContact({ ...payload, contact_type: 'guest' });

  const createBooking = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'booking');
    const selectedProperty = requireWorkspaceProperty(data.properties, payload.property_id);
    const checkIn = cleanDateOnly(payload.check_in, 'Check-in date');
    const checkOut = cleanDateOnly(payload.check_out, 'Check-out date');
    const guestCount = cleanPositiveInteger(payload.guest_count, 'Guest count');

    if (!cleanText(payload.guest_name)) throw new Error('Guest name is required.');
    if (checkOut <= checkIn) throw new Error('Check-out must be after check-in.');
    requireAllowedValue(payload.source || 'manual', ['manual', 'direct', 'airbnb', 'booking_com', 'vrbo', 'ical', 'csv', 'other'], 'booking source');
    requireAllowedValue(payload.status || 'confirmed', ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'], 'booking status');
    requireAllowedValue(payload.payment_status || 'unpaid', ['unpaid', 'partially_paid', 'paid', 'refunded', 'failed'], 'payment status');
    requireAllowedValue(payload.currency || selectedProperty.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD', currencies, 'currency');

    const bookingNumbers = {
      total_amount: cleanNonNegativeNumber(payload.total_amount, 'Total amount'),
      cleaning_fee: cleanNonNegativeNumber(payload.cleaning_fee, 'Cleaning fee'),
      taxes_fees: cleanNonNegativeNumber(payload.taxes_fees, 'Taxes / fees'),
      owner_payout: cleanNonNegativeNumber(payload.owner_payout, 'Owner payout'),
    };

    let contact = null;

    if (payload.guest_name || payload.guest_email || payload.guest_phone) {
      contact = await createOrUpdateContact({
        full_name: payload.guest_name,
        email: payload.guest_email,
        phone: payload.guest_phone,
        contact_type: 'guest',
        notes: payload.notes,
      });
    }

    const bookingPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id,
      contact_id: contact?.id || null,
      guest_name: cleanText(payload.guest_name),
      guest_email: cleanEmail(payload.guest_email),
      guest_phone: cleanText(payload.guest_phone),
      check_in: checkIn,
      check_out: checkOut,
      guest_count: guestCount,
      source: payload.source || 'manual',
      status: payload.status || 'confirmed',
      payment_status: payload.payment_status || 'unpaid',
      currency: payload.currency || selectedProperty.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD',
      total_amount: bookingNumbers.total_amount,
      cleaning_fee: bookingNumbers.cleaning_fee,
      taxes_fees: bookingNumbers.taxes_fees,
      owner_payout: bookingNumbers.owner_payout,
      notes: cleanText(payload.notes),
      auto_create_cleaning: payload.auto_create_cleaning ?? true,
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('bookings')
      .insert(bookingPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Booking could not be saved.'));

    await writeActivityLog('booking_created', { booking_id: row.id, property_id: row.property_id, guest_name: row.guest_name, check_in: row.check_in, check_out: row.check_out, status: row.status });
    await notifyWorkspaceManagers({
      event_type: 'booking_created',
      title: 'New booking created',
      body: `${row.guest_name || 'A guest'} is booked from ${row.check_in} to ${row.check_out}.`,
      priority: 'normal',
      related_property_id: row.property_id,
      related_booking_id: row.id,
      entity_type: 'booking',
      entity_id: row.id,
      action_url: '/bookings',
      channels: ['in_app'],
    });
    await refreshWorkspaceData();

    return normalizeBooking(row, data.properties);
  };

  const updateBooking = async (bookingId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'booking');

    const existingBooking = asArray(data.bookings).find((booking) => booking.id === bookingId);

    if (!existingBooking) {
      throw new Error('Select an existing booking in this workspace.');
    }

    const allowed = [
      'property_id',
      'contact_id',
      'guest_name',
      'guest_email',
      'guest_phone',
      'check_in',
      'check_out',
      'guest_count',
      'source',
      'status',
      'payment_status',
      'currency',
      'total_amount',
      'cleaning_fee',
      'taxes_fees',
      'owner_payout',
      'notes',
      'auto_create_cleaning',
      'cancelled_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if ('property_id' in updatePayload) requireWorkspaceProperty(data.properties, updatePayload.property_id);
    if (updatePayload.contact_id && !asArray(data.contacts).some((contact) => contact.id === updatePayload.contact_id)) {
      throw new Error('Selected guest contact must belong to this workspace.');
    }
    if ('guest_name' in updatePayload && !cleanText(updatePayload.guest_name)) throw new Error('Guest name is required.');

    const nextCheckIn = updatePayload.check_in ? cleanDateOnly(updatePayload.check_in, 'Check-in date') : existingBooking.check_in;
    const nextCheckOut = updatePayload.check_out ? cleanDateOnly(updatePayload.check_out, 'Check-out date') : existingBooking.check_out;

    if (nextCheckIn && nextCheckOut && nextCheckOut <= nextCheckIn) {
      throw new Error('Check-out must be after check-in.');
    }

    if ('check_in' in updatePayload) updatePayload.check_in = nextCheckIn;
    if ('check_out' in updatePayload) updatePayload.check_out = nextCheckOut;
    if ('guest_count' in updatePayload) updatePayload.guest_count = cleanPositiveInteger(updatePayload.guest_count, 'Guest count');
    if ('source' in updatePayload) requireAllowedValue(updatePayload.source, ['manual', 'direct', 'airbnb', 'booking_com', 'vrbo', 'ical', 'csv', 'other'], 'booking source');
    if ('status' in updatePayload) requireAllowedValue(updatePayload.status, ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'], 'booking status');
    if ('payment_status' in updatePayload) requireAllowedValue(updatePayload.payment_status, ['unpaid', 'partially_paid', 'paid', 'refunded', 'failed'], 'payment status');
    if ('currency' in updatePayload) requireAllowedValue(updatePayload.currency, currencies, 'currency');

    ['total_amount', 'cleaning_fee', 'taxes_fees', 'owner_payout'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNonNegativeNumber(updatePayload[key], key.replaceAll('_', ' '));
    });

    if (updatePayload.status === 'cancelled' && !updatePayload.cancelled_at) {
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Booking could not be updated.'));

    await writeActivityLog(row.status === 'cancelled' && existingBooking.status !== 'cancelled' ? 'booking_cancelled' : 'booking_updated', {
      booking_id: row.id,
      property_id: row.property_id,
      guest_name: row.guest_name,
      status: row.status,
      changed_fields: Object.keys(updatePayload),
    });
    await refreshWorkspaceData();

    return normalizeBooking(row, data.properties);
  };


  const createOrUpdateDirectBookingPage = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'directBooking');
    // Database triggers enforce direct booking plan access; frontend gating remains UX guidance only.

    const propertyId = payload.property_id || payload.propertyId;
    const property = requireWorkspaceProperty(data.properties, propertyId);
    const rawSlug = payload.slug || property.name || propertyId;
    const slug = String(rawSlug)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) throw new Error('A public booking slug is required.');

    const status = payload.status || 'draft';
    const bookingMode = payload.booking_mode || payload.bookingMode || 'manual_approval';
    const paymentMode = payload.payment_mode || payload.paymentMode || 'none';
    const currency = payload.currency || property.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD';

    requireAllowedValue(status, directBookingPageStatusValues, 'direct booking page status');
    requireAllowedValue(bookingMode, directBookingConfirmationModeValues, 'booking mode');
    requireAllowedValue(paymentMode, directBookingPaymentModeValues, 'payment mode');
    requireAllowedValue(currency, currencies, 'currency');

    const minNights = payload.min_nights ?? payload.minNights ?? 1;
    const maxNights = payload.max_nights ?? payload.maxNights ?? null;
    const cleanMinNights = cleanPositiveInteger(minNights, 'Minimum nights');
    const cleanMaxNights = maxNights === '' || maxNights === null || maxNights === undefined ? null : cleanPositiveInteger(maxNights, 'Maximum nights');

    if (cleanMaxNights && cleanMaxNights < cleanMinNights) {
      throw new Error('Maximum nights must be greater than or equal to minimum nights.');
    }

    const pagePayload = {
      workspace_id: currentWorkspace.id,
      property_id: propertyId,
      slug,
      status,
      page_title: cleanText(payload.page_title || payload.pageTitle),
      headline: cleanText(payload.headline),
      description: cleanText(payload.description),
      house_rules: cleanText(payload.house_rules || payload.houseRules),
      check_in_instructions: cleanText(payload.check_in_instructions || payload.checkInInstructions),
      cancellation_policy: cleanText(payload.cancellation_policy || payload.cancellationPolicy),
      contact_email: cleanEmail(payload.contact_email || payload.contactEmail),
      contact_phone: cleanPhone(payload.contact_phone || payload.contactPhone),
      booking_mode: bookingMode,
      payment_mode: paymentMode,
      allow_inquiries: payload.allow_inquiries ?? payload.allowInquiries ?? true,
      allow_booking_requests: payload.allow_booking_requests ?? payload.allowBookingRequests ?? true,
      require_guest_phone: payload.require_guest_phone ?? payload.requireGuestPhone ?? true,
      require_guest_message: payload.require_guest_message ?? payload.requireGuestMessage ?? false,
      min_nights: cleanMinNights,
      max_nights: cleanMaxNights,
      base_rate: cleanNonNegativeNumber(payload.base_rate ?? payload.baseRate, 'Base rate'),
      cleaning_fee: cleanNonNegativeNumber(payload.cleaning_fee ?? payload.cleaningFee, 'Cleaning fee'),
      currency,
      published_at: status === 'published' ? (payload.published_at || payload.publishedAt || new Date().toISOString()) : null,
      archived_at: status === 'archived' ? (payload.archived_at || payload.archivedAt || new Date().toISOString()) : null,
      created_by: session.user.id,
    };

    const existingId = payload.id || asArray(data.directBookingPages).find((page) => page.propertyId === propertyId || page.property_id === propertyId)?.id;
    const { created_by: _createdBy, ...updatePagePayload } = pagePayload;
    const query = existingId
      ? client.from('direct_booking_pages').update(updatePagePayload).eq('id', existingId).eq('workspace_id', currentWorkspace.id)
      : client.from('direct_booking_pages').insert(pagePayload);

    const { data: row, error: saveError } = await query.select('*').single();

    if (saveError) throw new Error(formatSupabaseError(saveError, 'Direct booking page could not be saved.'));

    await refreshWorkspaceData();
    return normalizeDirectBookingPage(row, data.properties);
  };

  const archiveDirectBookingPage = async (pageId, archived = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'directBooking');

    const existingPage = asArray(data.directBookingPages).find((page) => page.id === pageId);
    if (!existingPage) throw new Error('Select an existing direct booking page in this workspace.');

    const { data: row, error: updateError } = await client
      .from('direct_booking_pages')
      .update({
        status: archived ? 'archived' : 'draft',
        archived_at: archived ? new Date().toISOString() : null,
        published_at: archived ? null : existingPage.published_at || existingPage.publishedAt || null,
      })
      .eq('id', pageId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Direct booking page archive status could not be updated.'));

    await refreshWorkspaceData();
    return normalizeDirectBookingPage(row, data.properties);
  };

  const reviewDirectBookingRequest = async (requestId, status, options = {}) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'directBooking');
    requireAllowedValue(status, ['under_review', 'approved', 'declined', 'converted_to_booking'], 'direct booking request review status');

    const request = asArray(data.directBookingRequests).find((item) => item.id === requestId);
    if (!request) throw new Error('Select an existing direct booking request in this workspace.');

    const declineReason = cleanText(options.decline_reason || options.declineReason);
    if (status === 'declined' && !declineReason) throw new Error('Decline reason is required.');

    const updatePayload = {
      status,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      decline_reason: status === 'declined' ? declineReason : null,
    };

    if (options.converted_booking_id || options.convertedBookingId) {
      updatePayload.converted_booking_id = options.converted_booking_id || options.convertedBookingId;
    }

    const { data: row, error: updateError } = await client
      .from('direct_booking_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Direct booking request could not be reviewed.'));

    try {
      await createNotification({
        recipient_user_id: session.user.id,
        event_type: 'workspace_activity',
        title: `Direct booking request ${status.replaceAll('_', ' ')}`,
        body: `${request.guestName || request.guest_name} for ${request.property || 'a property'} was marked ${status.replaceAll('_', ' ')}.`,
        priority: status === 'declined' ? 'normal' : 'high',
        related_property_id: request.propertyId || request.property_id,
        action_url: '/direct-bookings',
      });
    } catch (notificationError) {
      console.warn('[PropFlow] Direct booking review notification skipped', notificationError);
    }

    await refreshWorkspaceData();
    return normalizeDirectBookingRequest(row, data.properties);
  };

  const convertDirectBookingRequestToBooking = async (requestId) => {
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'directBooking');

    const request = asArray(data.directBookingRequests).find((item) => item.id === requestId);
    if (!request) throw new Error('Select an existing direct booking request in this workspace.');
    if (!['approved', 'under_review'].includes(request.status)) {
      throw new Error('Only approved or under-review direct booking requests can be converted.');
    }

    const propertyId = request.propertyId || request.property_id;
    const property = requireWorkspaceProperty(data.properties, propertyId);
    const checkIn = cleanDateOnly(request.checkIn || request.check_in, 'Check-in date');
    const checkOut = cleanDateOnly(request.checkOut || request.check_out, 'Check-out date');

    if (checkOut <= checkIn) throw new Error('Check-out must be after check-in.');

    const overlaps = asArray(data.bookings).some((booking) => {
      if ((booking.propertyId || booking.property_id) !== propertyId) return false;
      if (String(booking.status || '').toLowerCase() === 'cancelled') return false;
      const existingStart = booking.checkIn || booking.check_in;
      const existingEnd = booking.checkOut || booking.check_out;
      return existingStart && existingEnd && checkIn < existingEnd && checkOut > existingStart;
    });

    if (overlaps) throw new Error('This request overlaps an existing active booking.');

    const booking = await createBooking({
      property_id: propertyId,
      guest_name: request.guestName || request.guest_name,
      guest_email: request.guestEmail || request.guest_email,
      guest_phone: request.guestPhone || request.guest_phone,
      check_in: checkIn,
      check_out: checkOut,
      guest_count: request.guestCount || request.guest_count || 1,
      source: 'direct',
      status: 'pending',
      payment_status: 'unpaid',
      currency: request.currency || property.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD',
      total_amount: request.quotedTotal ?? request.quoted_total ?? null,
      cleaning_fee: request.quotedCleaningFee ?? request.quoted_cleaning_fee ?? null,
      taxes_fees: null,
      owner_payout: null,
      notes: `Converted from direct booking request ${request.id}. ${request.message || ''}`.trim(),
      auto_create_cleaning: false,
    });

    const reviewed = await reviewDirectBookingRequest(requestId, 'converted_to_booking', {
      converted_booking_id: booking.id,
    });

    try {
      await createNotification({
        recipient_user_id: session.user.id,
        event_type: 'workspace_activity',
        title: 'Direct booking converted',
        body: `${request.guestName || request.guest_name} was converted into an internal pending booking. Payment status remains unpaid.`,
        priority: 'high',
        related_property_id: propertyId,
        related_booking_id: booking.id,
        action_url: '/bookings',
      });
    } catch (notificationError) {
      console.warn('[PropFlow] Direct booking conversion notification skipped', notificationError);
    }

    await refreshWorkspaceData();
    return { request: reviewed, booking };
  };

  const validateLeasePropertyContactAndFile = (payload, propertyId) => {
    const property = requireWorkspaceProperty(data.properties, propertyId);

    const tenantContactId = payload.tenant_contact_id || payload.tenantContactId || payload.contact_id || payload.contactId;
    if (tenantContactId) {
      const contact = requireWorkspaceScopedRecord(data.contacts, tenantContactId, 'tenant contact');
      const contactType = contact.contact_type || contact.contactType;
      if (!['tenant', 'guest', 'other'].includes(contactType)) {
        throw new Error('Selected contact must be a tenant, guest, or general contact in this workspace.');
      }
    }

    const leaseDocumentFileId = payload.lease_document_file_id || payload.leaseDocumentFileId;
    if (leaseDocumentFileId) {
      const file = requireWorkspaceScopedRecord(data.fileUploads, leaseDocumentFileId, 'lease document', propertyId);
      const category = file.fileCategory || file.file_category || file.category;
      if (!['lease', 'contract', 'general_document', 'property_document'].includes(category)) {
        throw new Error('Lease document must be a private lease, contract, or general document file.');
      }
      if ((file.visibility || 'private') !== 'private') {
        throw new Error('Lease documents must stay private.');
      }
    }

    return property;
  };

  const cleanLeasePayload = (payload = {}, existingLease = null) => {
    const source = payload || {};
    const propertyId = source.property_id || source.propertyId || existingLease?.propertyId || existingLease?.property_id;
    if (!propertyId) throw new Error('Select a property before saving the lease.');

    const property = validateLeasePropertyContactAndFile(source, propertyId);
    const tenantName = cleanText(source.tenant_name || source.tenantName || existingLease?.tenantName || existingLease?.tenant_name);
    if (!tenantName) throw new Error('Tenant name is required.');

    const leaseStart = source.lease_start || source.leaseStart || existingLease?.leaseStart || existingLease?.lease_start;
    const cleanStart = cleanDateOnly(leaseStart, 'Lease start');
    const cleanEnd = cleanOptionalDateOnly(source.lease_end || source.leaseEnd || null, 'Lease end');
    if (cleanEnd && cleanEnd <= cleanStart) throw new Error('Lease end must be after lease start.');

    const rentAmount = cleanNonNegativeNumber(source.rent_amount ?? source.rentAmount ?? source.monthly_rent ?? source.monthlyRent ?? 0, 'Rent amount') ?? 0;
    const securityDepositAmount = cleanNonNegativeNumber(source.security_deposit_amount ?? source.securityDepositAmount ?? source.security_deposit ?? source.securityDeposit, 'Security deposit');
    const lateFeeAmount = cleanNonNegativeNumber(source.late_fee_amount ?? source.lateFeeAmount, 'Late fee amount');

    const dueDay = source.due_day ?? source.dueDay;
    const cleanDueDay = dueDay === '' || dueDay === null || dueDay === undefined ? null : Number(dueDay);
    if (cleanDueDay !== null && (!Number.isInteger(cleanDueDay) || cleanDueDay < 1 || cleanDueDay > 31)) {
      throw new Error('Due day must be between 1 and 31.');
    }

    const gracePeriodDays = source.grace_period_days ?? source.gracePeriodDays ?? 0;
    const cleanGracePeriodDays = gracePeriodDays === '' || gracePeriodDays === null || gracePeriodDays === undefined ? 0 : Number(gracePeriodDays);
    if (!Number.isInteger(cleanGracePeriodDays) || cleanGracePeriodDays < 0) {
      throw new Error('Grace period days must be 0 or more.');
    }

    const leaseType = source.lease_type || source.leaseType || 'fixed_term';
    const rawLeaseStatus = source.lease_status || source.leaseStatus || 'draft';
    const leaseStatus = { ending_soon: 'expiring_soon', expired: 'ended', cancelled: 'terminated' }[rawLeaseStatus] || rawLeaseStatus;
    const rentFrequency = source.rent_frequency || source.rentFrequency || 'monthly';
    const rawPaymentStatus = source.payment_status || source.paymentStatus || source.rent_payment_status || source.rentPaymentStatus || 'not_tracked';
    const paymentStatus = { unknown: 'not_tracked', paid_ahead: 'paid' }[rawPaymentStatus] || rawPaymentStatus;
    const depositStatus = source.deposit_status || source.depositStatus || 'not_tracked';
    const currency = normalizeWorkspaceCurrency(source.currency || property.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD');

    requireAllowedValue(leaseType, leaseTypeValues, 'lease type');
    requireAllowedValue(leaseStatus, leaseStatusValues, 'lease status');
    requireAllowedValue(rentFrequency, rentFrequencyValues, 'rent frequency');
    requireAllowedValue(paymentStatus, leasePaymentStatusValues, 'payment status');
    requireAllowedValue(depositStatus, leasePaymentStatusValues, 'deposit status');
    requireAllowedValue(currency, workspaceCreationCurrencies, 'currency');

    return {
      property_id: propertyId,
      tenant_contact_id: source.tenant_contact_id || source.tenantContactId || source.contact_id || source.contactId || null,
      lease_type: leaseType,
      lease_status: leaseStatus,
      tenant_name: tenantName,
      tenant_email: cleanEmail(source.tenant_email || source.tenantEmail),
      tenant_phone: cleanPhone(source.tenant_phone || source.tenantPhone),
      lease_start: cleanStart,
      lease_end: cleanEnd,
      rent_amount: rentAmount,
      rent_frequency: rentFrequency,
      security_deposit_amount: securityDepositAmount,
      deposit_status: depositStatus,
      payment_status: paymentStatus,
      currency,
      due_day: cleanDueDay,
      grace_period_days: cleanGracePeriodDays,
      late_fee_amount: lateFeeAmount,
      lease_document_file_id: source.lease_document_file_id || source.leaseDocumentFileId || null,
      move_in_notes: cleanText(source.move_in_notes || source.moveInNotes),
      move_out_notes: cleanText(source.move_out_notes || source.moveOutNotes),
      internal_notes: cleanText(source.internal_notes || source.internalNotes || source.notes),
    };
  };

  const notifyLeaseManagers = async (notificationPayload) => {
    const managers = getWorkspaceManagers(data.members, currentWorkspace.id);
    const recipients = managers.length ? managers : [{ user_id: session.user.id }];
    await Promise.allSettled(
      recipients.map((member) =>
        createNotification({
          recipient_user_id: memberUserId(member),
          ...notificationPayload,
        }),
      ),
    );
  };

  const createLease = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'lease');

    let leasePayload = cleanLeasePayload(payload);

    if (!leasePayload.tenant_contact_id && (leasePayload.tenant_name || leasePayload.tenant_email)) {
      const contact = await createOrUpdateContact({
        full_name: leasePayload.tenant_name,
        email: leasePayload.tenant_email,
        phone: leasePayload.tenant_phone,
        contact_type: 'tenant',
        notes: 'Tenant contact created from a manual long-term lease record.',
      });
      leasePayload = { ...leasePayload, tenant_contact_id: contact?.id || null };
    }

    const { data: row, error: insertError } = await client
      .from('leases')
      .insert({
        ...leasePayload,
        workspace_id: currentWorkspace.id,
        created_by: session.user.id,
        updated_by: session.user.id,
      })
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Lease could not be saved.'));

    await notifyLeaseManagers({
      event_type: 'lease_created',
      title: 'Lease created',
      body: `${leasePayload.tenant_name} was added as a manual long-term lease.`,
      priority: 'normal',
      related_property_id: leasePayload.property_id,
      action_url: '/leases',
    });

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const updateLease = async (leaseId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'lease');

    const existingLease = asArray(data.leases).find((lease) => lease.id === leaseId);
    if (!existingLease) throw new Error('Select an existing lease in this workspace.');
    if (existingLease.archivedAt || existingLease.archived_at || existingLease.leaseStatus === 'archived' || existingLease.lease_status === 'archived') {
      throw new Error('Archived leases cannot be edited. Restore the lease before making changes.');
    }

    const merged = { ...existingLease, ...payload };
    const updatePayload = cleanLeasePayload(merged, existingLease);
    delete updatePayload.workspace_id;
    delete updatePayload.workspaceId;

    const { data: row, error: updateError } = await client
      .from('leases')
      .update({ ...updatePayload, updated_by: session.user.id })
      .eq('id', leaseId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Lease could not be updated.'));

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const archiveLease = async (leaseId, archived = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'lease');

    const existingLease = asArray(data.leases).find((lease) => lease.id === leaseId);
    if (!existingLease) throw new Error('Select an existing lease in this workspace.');

    const todayValue = new Date().toISOString().slice(0, 10);
    const restoredStatus = existingLease.leaseStart && existingLease.leaseStart <= todayValue && (!existingLease.leaseEnd || existingLease.leaseEnd >= todayValue) ? 'active' : 'draft';
    const updatePayload = archived
      ? { archived_at: new Date().toISOString(), lease_status: 'archived', updated_by: session.user.id }
      : { archived_at: null, lease_status: restoredStatus, updated_by: session.user.id };

    const { data: row, error: updateError } = await client
      .from('leases')
      .update(updatePayload)
      .eq('id', leaseId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Lease archive status could not be updated.'));

    if (archived) {
      await notifyLeaseManagers({
        event_type: 'lease_archived',
        title: 'Lease archived',
        body: `${existingLease.tenantName || existingLease.tenant_name || 'A lease'} was archived manually.`,
        priority: 'normal',
        related_property_id: existingLease.propertyId || existingLease.property_id,
        action_url: '/leases',
      });
    }

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const linkLeaseDocument = async (leaseId, fileUploadId) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'lease');

    const lease = asArray(data.leases).find((item) => item.id === leaseId);
    if (!lease) throw new Error('Select an existing lease in this workspace.');
    const propertyId = lease.propertyId || lease.property_id;
    const file = requireWorkspaceScopedRecord(data.fileUploads, fileUploadId, 'lease document', propertyId);
    const category = file.fileCategory || file.file_category || file.category;
    if (!['lease', 'contract', 'general_document', 'property_document'].includes(category)) {
      throw new Error('Lease document must be uploaded as a private lease, contract, or general document file.');
    }
    if ((file.visibility || 'private') !== 'private') throw new Error('Lease documents must stay private.');

    const { data: row, error: updateError } = await client
      .from('leases')
      .update({ lease_document_file_id: fileUploadId, updated_by: session.user.id })
      .eq('id', leaseId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Lease document could not be linked.'));

    await notifyLeaseManagers({
      event_type: 'lease_document_linked',
      title: 'Lease document linked',
      body: `A private lease document was linked for ${lease.tenantName || lease.tenant_name || 'a tenant'}.`,
      priority: 'normal',
      related_property_id: propertyId,
      related_file_upload_id: fileUploadId,
      action_url: '/leases',
    });

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const createCleaningTask = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'cleaning');

    const allowed = [
      'property_id',
      'booking_id',
      'assigned_cleaner_id',
      'scheduled_for',
      'status',
      'checklist_items',
      'checklist',
      'cleaner_notes',
      'supplies_used',
    ];
    const cleanPayload = stripUnsupportedPayloadKeys(payload, allowed);

    requireWorkspaceProperty(data.properties, cleanPayload.property_id);

    if (!cleanPayload.scheduled_for) throw new Error('Cleaning date is required.');
    requireAllowedValue(cleanPayload.status || 'scheduled', ['scheduled', 'in_progress', 'needs_inspection', 'completed', 'guest_ready', 'missed'], 'cleaning status');
    if (cleanPayload.assigned_cleaner_id) {
      requireActiveWorkspaceMemberWithRole(data.members, cleanPayload.assigned_cleaner_id, roles.CLEANER, 'Assigned cleaner');
    }

    if (cleanPayload.booking_id) {
      const linkedBooking = asArray(data.bookings).find((booking) => booking.id === cleanPayload.booking_id);
      if (!linkedBooking || linkedBooking.property_id !== cleanPayload.property_id) {
        throw new Error('Related booking must belong to the selected property in this workspace.');
      }
    }

    const cleaningPayload = {
      workspace_id: currentWorkspace.id,
      property_id: cleanPayload.property_id,
      booking_id: cleanPayload.booking_id || null,
      assigned_cleaner_id: cleanPayload.assigned_cleaner_id || null,
      scheduled_for: makeDateTimeFromDate(cleanPayload.scheduled_for),
      status: cleanPayload.status || 'scheduled',
      checklist_items: normalizeChecklistItems(cleanPayload.checklist_items || cleanPayload.checklist),
      cleaner_notes: cleanText(cleanPayload.cleaner_notes),
      supplies_used: cleanText(cleanPayload.supplies_used),
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('cleaning_tasks')
      .insert(cleaningPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Cleaning task could not be saved.'));

    await writeActivityLog('cleaning_task_created', { cleaning_task_id: row.id, property_id: row.property_id, booking_id: row.booking_id, assigned_cleaner_id: row.assigned_cleaner_id, scheduled_for: row.scheduled_for, status: row.status });

    if (row.assigned_cleaner_id) {
      await safeCreateNotification({
        recipient_user_id: row.assigned_cleaner_id,
        event_type: 'cleaning_task_assigned',
        title: 'Cleaning task assigned',
        body: `You have a cleaning task scheduled for ${new Date(row.scheduled_for).toLocaleDateString()}.`,
        priority: 'normal',
        related_property_id: row.property_id,
        related_booking_id: row.booking_id,
        related_cleaning_task_id: row.id,
        entity_type: 'cleaning_task',
        entity_id: row.id,
        action_url: '/cleaning',
        channels: ['in_app'],
      });
    }

    await refreshWorkspaceData();

    return normalizeCleaning(row, data.properties);
  };

  const updateCleaningTask = async (taskId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const currentTask = asArray(data.cleaningTasks).find((task) => task.id === taskId);
    if (!currentTask) throw new Error('Cleaning task was not found in the current workspace.');

    const isManager = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace).some((role) => workspaceActionRoles.cleaning.includes(role));
    const isAssignedCleaner = currentTask.assigned_cleaner_id === session.user.id;
    const closedTask = ['completed', 'guest_ready', 'cancelled'].includes(currentTask.status);

    if (!isManager && !isAssignedCleaner) {
      throw new Error('You can only update assigned cleaning tasks.');
    }

    if (closedTask) {
      throw new Error('Completed, guest-ready, and cancelled cleaning tasks are read-only.');
    }

    const managerAllowed = [
      'property_id',
      'booking_id',
      'assigned_cleaner_id',
      'scheduled_for',
      'status',
      'checklist_items',
      'cleaner_notes',
      'supplies_used',
      'low_supplies_reported',
      'issue_reported',
      'started_at',
      'completed_at',
    ];
    const cleanerAllowed = [
      'status',
      'cleaner_notes',
      'supplies_used',
      'low_supplies_reported',
      'issue_reported',
      'started_at',
      'completed_at',
    ];
    const updatePayload = stripUnsupportedPayloadKeys(payload, isManager ? managerAllowed : cleanerAllowed);

    const nextPropertyId = updatePayload.property_id || currentTask.property_id;
    if ('property_id' in updatePayload) requireWorkspaceProperty(data.properties, updatePayload.property_id);

    if ('booking_id' in updatePayload && updatePayload.booking_id) {
      const linkedBooking = asArray(data.bookings).find((booking) => booking.id === updatePayload.booking_id);
      if (!linkedBooking || linkedBooking.property_id !== nextPropertyId) {
        throw new Error('Related booking must belong to the selected property in this workspace.');
      }
    }

    if ('assigned_cleaner_id' in updatePayload && updatePayload.assigned_cleaner_id) {
      requireActiveWorkspaceMemberWithRole(data.members, updatePayload.assigned_cleaner_id, roles.CLEANER, 'Assigned cleaner');
    }

    if ('status' in updatePayload) {
      requireAllowedValue(updatePayload.status, ['scheduled', 'in_progress', 'needs_inspection', 'completed', 'guest_ready', 'missed'], 'cleaning status');
    }

    if ('checklist_items' in updatePayload) {
      updatePayload.checklist_items = normalizeChecklistItems(updatePayload.checklist_items);
    }

    if ('cleaner_notes' in updatePayload) updatePayload.cleaner_notes = cleanText(updatePayload.cleaner_notes);
    if ('supplies_used' in updatePayload) updatePayload.supplies_used = cleanText(updatePayload.supplies_used);

    if (updatePayload.scheduled_for) {
      updatePayload.scheduled_for = makeDateTimeFromDate(updatePayload.scheduled_for);
    }

    if (['completed', 'guest_ready'].includes(updatePayload.status) && !updatePayload.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    if (updatePayload.status === 'in_progress' && !updatePayload.started_at) {
      updatePayload.started_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('cleaning_tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Cleaning task could not be updated.'));

    const cleaningAction = row.issue_reported && !currentTask.issue_reported
      ? 'cleaning_issue_reported'
      : row.status === 'in_progress' && currentTask.status !== 'in_progress'
        ? 'cleaning_task_started'
        : ['completed', 'guest_ready'].includes(row.status) && currentTask.status !== row.status
          ? 'cleaning_task_completed'
          : 'cleaning_task_updated';
    await writeActivityLog(cleaningAction, {
      cleaning_task_id: row.id,
      property_id: row.property_id,
      booking_id: row.booking_id,
      assigned_cleaner_id: row.assigned_cleaner_id,
      status: row.status,
      changed_fields: Object.keys(updatePayload),
    });

    if (['completed', 'guest_ready'].includes(row.status) && currentTask.status !== row.status) {
      await notifyWorkspaceManagers({
        event_type: 'cleaning_task_completed',
        title: row.status === 'guest_ready' ? 'Cleaning marked guest-ready' : 'Cleaning task completed',
        body: 'A cleaning task was completed and is ready for manager review.',
        priority: 'normal',
        related_property_id: row.property_id,
        related_booking_id: row.booking_id,
        related_cleaning_task_id: row.id,
        entity_type: 'cleaning_task',
        entity_id: row.id,
        action_url: '/cleaning',
        channels: ['in_app'],
      });
    }

    if (row.issue_reported && !currentTask.issue_reported) {
      await notifyWorkspaceManagers({
        event_type: 'cleaning_task_issue_reported',
        title: 'Cleaning issue reported',
        body: 'A cleaner reported an issue on an assigned task.',
        priority: 'high',
        related_property_id: row.property_id,
        related_booking_id: row.booking_id,
        related_cleaning_task_id: row.id,
        entity_type: 'cleaning_task',
        entity_id: row.id,
        action_url: '/cleaning',
        channels: ['in_app'],
      });
    }

    await refreshWorkspaceData();

    return normalizeCleaning(row, data.properties);
  };

  const createMaintenanceWorkOrder = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'maintenance');

    const allowed = [
      'property_id',
      'assigned_maintenance_id',
      'title',
      'description',
      'issue_description',
      'priority',
      'status',
      'estimated_cost',
      'actual_cost',
      'parts_needed',
      'due_date',
      'notes',
    ];
    const cleanPayload = stripUnsupportedPayloadKeys(payload, allowed);
    requireWorkspaceProperty(data.properties, cleanPayload.property_id);

    if (cleanPayload.assigned_maintenance_id) {
      requireActiveWorkspaceMemberWithRole(data.members, cleanPayload.assigned_maintenance_id, roles.MAINTENANCE, 'Assigned maintenance person');
    }

    if (!cleanText(cleanPayload.title)) throw new Error('Issue title is required.');
    const priority = cleanPayload.priority || 'medium';
    const status = normalizeMaintenanceStatus(cleanPayload.status);
    requireAllowedValue(priority, maintenancePriorities, 'priority');
    requireAllowedValue(status, maintenanceStatuses, 'maintenance status');

    const description = cleanText(cleanPayload.description || cleanPayload.issue_description) || 'No description provided.';

    const workOrderPayload = {
      workspace_id: currentWorkspace.id,
      property_id: cleanPayload.property_id,
      reported_by_user_id: session.user.id,
      assigned_maintenance_id: cleanPayload.assigned_maintenance_id || null,
      title: cleanText(cleanPayload.title),
      description,
      priority,
      status,
      estimated_cost: cleanNonNegativeMoney(cleanPayload.estimated_cost, 'Estimated cost'),
      actual_cost: cleanNonNegativeMoney(cleanPayload.actual_cost, 'Actual cost'),
      parts_needed: cleanText(cleanPayload.parts_needed),
      due_date: cleanOptionalDateOnly(cleanPayload.due_date, 'Due date'),
      notes: cleanText(cleanPayload.notes),
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('maintenance_work_orders')
      .insert(workOrderPayload)
      .select('*')
      .single();

    if (insertError) {
      throw new Error(formatSupabaseError(insertError, 'Maintenance work order could not be saved.'));
    }

    await writeActivityLog('maintenance_work_order_created', { maintenance_work_order_id: row.id, property_id: row.property_id, assigned_maintenance_id: row.assigned_maintenance_id, title: row.title, priority: row.priority, status: row.status });

    await notifyWorkspaceManagers({
      event_type: 'maintenance_work_order_created',
      title: 'Maintenance work order created',
      body: row.title || 'A maintenance work order was created.',
      priority: row.priority === 'urgent' ? 'urgent' : row.priority === 'high' ? 'high' : 'normal',
      related_property_id: row.property_id,
      related_maintenance_work_order_id: row.id,
      entity_type: 'maintenance_work_order',
      entity_id: row.id,
      action_url: '/maintenance',
      channels: ['in_app'],
    });

    if (row.assigned_maintenance_id) {
      await safeCreateNotification({
        recipient_user_id: row.assigned_maintenance_id,
        event_type: row.priority === 'urgent' ? 'maintenance_work_order_urgent' : 'maintenance_work_order_assigned',
        title: row.priority === 'urgent' ? 'Urgent maintenance work order assigned' : 'Maintenance work order assigned',
        body: row.title || 'A maintenance work order has been assigned to you.',
        priority: row.priority === 'urgent' ? 'urgent' : row.priority === 'high' ? 'high' : 'normal',
        related_property_id: row.property_id,
        related_maintenance_work_order_id: row.id,
        entity_type: 'maintenance_work_order',
        entity_id: row.id,
        action_url: '/maintenance',
        channels: ['in_app'],
      });
    }

    await refreshWorkspaceData();

    return normalizeMaintenance(row, data.properties);
  };

  const updateMaintenanceWorkOrder = async (workOrderId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const currentWorkOrder = asArray(data.maintenanceWorkOrders).find((workOrder) => workOrder.id === workOrderId);
    if (!currentWorkOrder) throw new Error('Maintenance work order was not found in the current workspace.');

    const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);
    const isManager = activeRoles.some((role) => workspaceActionRoles.maintenance.includes(role));
    const isAssignedMaintenance = currentWorkOrder.assigned_maintenance_id === session.user.id;

    if (!isManager && !isAssignedMaintenance) {
      throw new Error('You can only update assigned maintenance work orders.');
    }

    if (maintenanceClosedStatuses.includes(currentWorkOrder.status)) {
      throw new Error('Completed and cancelled maintenance work orders are read-only.');
    }

    const managerAllowed = [
      'property_id',
      'assigned_maintenance_id',
      'title',
      'description',
      'issue_description',
      'priority',
      'status',
      'estimated_cost',
      'actual_cost',
      'parts_needed',
      'due_date',
      'notes',
    ];
    const maintenanceAllowed = ['status', 'actual_cost', 'parts_needed', 'notes'];

    const updatePayload = stripUnsupportedPayloadKeys(payload, isManager ? managerAllowed : maintenanceAllowed);

    if ('issue_description' in updatePayload) {
      updatePayload.description = cleanText(updatePayload.issue_description);
      delete updatePayload.issue_description;
    }

    if ('description' in updatePayload) updatePayload.description = cleanText(updatePayload.description) || 'No description provided.';
    if ('title' in updatePayload) {
      updatePayload.title = cleanText(updatePayload.title);
      if (!updatePayload.title) throw new Error('Issue title is required.');
    }

    if ('property_id' in updatePayload) requireWorkspaceProperty(data.properties, updatePayload.property_id);
    if ('assigned_maintenance_id' in updatePayload && updatePayload.assigned_maintenance_id) {
      requireActiveWorkspaceMemberWithRole(data.members, updatePayload.assigned_maintenance_id, roles.MAINTENANCE, 'Assigned maintenance person');
    }

    if ('status' in updatePayload) {
      updatePayload.status = normalizeMaintenanceStatus(updatePayload.status);
      requireAllowedValue(updatePayload.status, maintenanceStatuses, 'maintenance status');
    }

    if ('priority' in updatePayload) requireAllowedValue(updatePayload.priority, maintenancePriorities, 'priority');
    if ('estimated_cost' in updatePayload) updatePayload.estimated_cost = cleanNonNegativeMoney(updatePayload.estimated_cost, 'Estimated cost');
    if ('actual_cost' in updatePayload) updatePayload.actual_cost = cleanNonNegativeMoney(updatePayload.actual_cost, 'Actual cost');
    if ('parts_needed' in updatePayload) updatePayload.parts_needed = cleanText(updatePayload.parts_needed);
    if ('notes' in updatePayload) updatePayload.notes = cleanText(updatePayload.notes);
    if ('due_date' in updatePayload) updatePayload.due_date = cleanOptionalDateOnly(updatePayload.due_date, 'Due date');

    if (updatePayload.status === 'completed' && !updatePayload.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('maintenance_work_orders')
      .update(updatePayload)
      .eq('id', workOrderId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Maintenance work order could not be updated.'));
    }

    await writeActivityLog(row.status === 'completed' && currentWorkOrder.status !== 'completed' ? 'maintenance_work_order_completed' : 'maintenance_work_order_updated', {
      maintenance_work_order_id: row.id,
      property_id: row.property_id,
      assigned_maintenance_id: row.assigned_maintenance_id,
      title: row.title,
      priority: row.priority,
      status: row.status,
      changed_fields: Object.keys(updatePayload),
    });

    if (row.status === 'completed' && currentWorkOrder.status !== 'completed') {
      await notifyWorkspaceManagers({
        event_type: 'maintenance_work_order_completed',
        title: 'Maintenance work order completed',
        body: row.title || 'A maintenance work order was completed.',
        priority: 'normal',
        related_property_id: row.property_id,
        related_maintenance_work_order_id: row.id,
        entity_type: 'maintenance_work_order',
        entity_id: row.id,
        action_url: '/maintenance',
        channels: ['in_app'],
      });
    }

    await refreshWorkspaceData();

    return normalizeMaintenance(row, data.properties);
  };

  const createSupply = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'inventory');

    const propertyId = payload.property_id || payload.propertyId || null;
    const selectedProperty = optionalWorkspaceProperty(data.properties, propertyId, 'property');
    const itemName = cleanText(payload.item_name || payload.itemName);
    const currentQuantity = cleanNonNegativeNumber(payload.current_quantity ?? payload.currentQuantity ?? 0, 'Current quantity') ?? 0;
    const lowStockThreshold = cleanNonNegativeNumber(payload.low_stock_threshold ?? payload.lowStockThreshold ?? 0, 'Low-stock threshold') ?? 0;
    const estimatedUnitCost = cleanNonNegativeMoney(payload.estimated_unit_cost ?? payload.estimatedUnitCost, 'Estimated unit cost');
    const currency = normalizeWorkspaceCurrency(
      payload.currency || selectedProperty?.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD',
    );

    if (!itemName) throw new Error('Item name is required.');
    requireAllowedValue(currency, workspaceCreationCurrencies, 'currency');

    const supplyPayload = {
      workspace_id: currentWorkspace.id,
      property_id: propertyId,
      item_name: itemName,
      category: cleanText(payload.category),
      current_quantity: currentQuantity,
      low_stock_threshold: lowStockThreshold,
      unit: cleanText(payload.unit) || 'unit',
      supplier_name: cleanText(payload.supplier_name || payload.supplierName),
      supplier_contact: cleanText(payload.supplier_contact || payload.supplierContact),
      estimated_unit_cost: estimatedUnitCost,
      currency,
      notes: cleanText(payload.notes),
      archived_at: null,
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('supplies')
      .insert(supplyPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Supply could not be saved.'));

    await refreshWorkspaceData();

    return normalizeSupply(row, data.properties);
  };

  const updateSupply = async (supplyId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'inventory');

    const allowed = [
      'property_id',
      'item_name',
      'category',
      'current_quantity',
      'low_stock_threshold',
      'unit',
      'supplier_name',
      'supplier_contact',
      'estimated_unit_cost',
      'currency',
      'notes',
      'archived_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if ('property_id' in updatePayload) {
      updatePayload.property_id = updatePayload.property_id || null;
      optionalWorkspaceProperty(data.properties, updatePayload.property_id, 'property');
    }

    if ('item_name' in updatePayload) {
      updatePayload.item_name = cleanText(updatePayload.item_name);
      if (!updatePayload.item_name) throw new Error('Item name is required.');
    }

    if ('category' in updatePayload) updatePayload.category = cleanText(updatePayload.category);
    if ('unit' in updatePayload) updatePayload.unit = cleanText(updatePayload.unit) || 'unit';
    if ('supplier_name' in updatePayload) updatePayload.supplier_name = cleanText(updatePayload.supplier_name);
    if ('supplier_contact' in updatePayload) updatePayload.supplier_contact = cleanText(updatePayload.supplier_contact);
    if ('notes' in updatePayload) updatePayload.notes = cleanText(updatePayload.notes);

    if ('current_quantity' in updatePayload) {
      updatePayload.current_quantity = cleanNonNegativeNumber(updatePayload.current_quantity, 'Current quantity') ?? 0;
    }

    if ('low_stock_threshold' in updatePayload) {
      updatePayload.low_stock_threshold = cleanNonNegativeNumber(updatePayload.low_stock_threshold, 'Low-stock threshold') ?? 0;
    }

    if ('estimated_unit_cost' in updatePayload) {
      updatePayload.estimated_unit_cost = cleanNonNegativeMoney(updatePayload.estimated_unit_cost, 'Estimated unit cost');
    }

    if ('currency' in updatePayload) {
      updatePayload.currency = normalizeWorkspaceCurrency(updatePayload.currency);
      requireAllowedValue(updatePayload.currency, workspaceCreationCurrencies, 'currency');
    }

    const { data: row, error: updateError } = await client
      .from('supplies')
      .update(updatePayload)
      .eq('id', supplyId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Supply could not be updated.'));

    await refreshWorkspaceData();

    return normalizeSupply(row, data.properties);
  };

  const archiveSupply = async (supplyId, archived = true) =>
    updateSupply(supplyId, {
      archived_at: archived ? new Date().toISOString() : null,
    });

  const writeActivityLog = async (action, metadata = {}, workspaceId = currentWorkspace?.id) =>
    logActivity({
      supabase,
      workspaceId,
      actorUserId: session?.user?.id,
      action,
      metadata,
    });

  const createInvite = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'invite');
    // Database triggers enforce team member and pending invite limits; frontend gating remains UX guidance only.

    const email = cleanEmail(payload.email);
    const rawInviteRoles = Array.isArray(payload.roles || payload.role) ? payload.roles || payload.role : [payload.roles || payload.role];
    const roleList = cleanRoleArray(rawInviteRoles, inviteRoleOptions);
    const permissionLevel = payload.permission_level || payload.permissionLevel || 'standard';
    const expiresValue = payload.expires_at || payload.expiresAt || null;

    if (!email || !isValidEmail(email)) throw new Error('Enter a valid invitee email address.');
    if (!roleList.length) throw new Error('Select at least one valid customer workspace role for this invite.');
    if (roleList.length !== rawInviteRoles.filter(Boolean).length) throw new Error('Remove duplicate roles before creating the invite.');
    requireAllowedValue(permissionLevel, invitePermissionLevels, 'permission level');

    let expiresAt = null;
    if (expiresValue) {
      const parsedDate = new Date(expiresValue);
      if (Number.isNaN(parsedDate.getTime())) throw new Error('Select a valid invite expiration date.');
      parsedDate.setHours(23, 59, 59, 999);
      if (parsedDate.getTime() <= Date.now()) throw new Error('Invite expiration date must be in the future.');
      expiresAt = parsedDate.toISOString();
    }

    const requestedPropertyIds = [
      payload.assigned_property_id,
      payload.assignedPropertyId,
      payload.property_id,
      payload.propertyId,
      ...asArray(payload.assigned_property_ids),
      ...asArray(payload.assignedPropertyIds),
    ].filter(Boolean);
    const uniquePropertyIds = Array.from(new Set(requestedPropertyIds));
    const needsPropertyScope = roleList.some((role) => scopedInviteRoles.includes(role));
    const assignedPropertyIds = uniquePropertyIds.filter((propertyId) =>
      asArray(data.properties).some((property) => property.id === propertyId && property.workspace_id === currentWorkspace.id),
    );

    if (uniquePropertyIds.length !== assignedPropertyIds.length) {
      throw new Error('Assigned properties must be existing properties in this workspace.');
    }

    if (needsPropertyScope && !assignedPropertyIds.length) {
      throw new Error('Property Owner, Cleaner, and Maintenance invites require at least one assigned property.');
    }

    if (!needsPropertyScope && assignedPropertyIds.length) {
      throw new Error('Assigned properties are only supported for Property Owner, Cleaner, and Maintenance invites.');
    }

    const { data: duplicateRows, error: duplicateError } = await client
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('email', email)
      .eq('status', 'pending')
      .limit(1);

    if (duplicateError) throw new Error(formatSupabaseError(duplicateError, 'Could not check existing invites.'));
    if (duplicateRows?.length) {
      throw new Error('This email already has a pending invite for this workspace. Revoke it before sending a new one.');
    }

    const invitePayload = {
      workspace_id: currentWorkspace.id,
      email,
      roles: roleList,
      assigned_property_ids: assignedPropertyIds,
      token: inviteToken(),
      workspace_code: getWorkspaceCode(currentWorkspace),
      message: cleanText(payload.message)?.slice(0, 1000) || null,
      status: 'pending',
      expires_at: expiresAt,
      invited_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('workspace_invites')
      .insert(invitePayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Invite could not be created.'));

    await writeActivityLog('team_invite_created', { invite_id: row.id, email, roles: roleList });
    await notifyWorkspaceManagers({
      event_type: 'team_member_invited',
      title: 'Team invite created',
      body: `An invite was created for ${email}.`,
      priority: 'normal',
      related_invite_id: row.id,
      entity_type: 'workspace_invite',
      entity_id: row.id,
      action_url: '/team',
      channels: ['in_app'],
    });
    await refreshWorkspaceData();

    return row;
  };

  const createWorkspaceInvite = createInvite;
  const inviteTeamMember = createInvite;

  const updateWorkspaceMemberStatus = async (memberId, nextStatus) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'teamLifecycle');
    requireAllowedValue(nextStatus, ['active', 'suspended', 'revoked'], 'member status');

    const member = asArray(data.members).find((item) => item.id === memberId && item.workspace_id === currentWorkspace.id);
    if (!member) throw new Error('Workspace member was not found in the current workspace.');

    const memberRoles = cleanRoleArray(member.roles, inviteRoleOptions);
    const isOwnerAdmin = memberRoles.includes(roles.OWNER_ADMIN);
    const activeOwners = asArray(data.members).filter(
      (item) => item.workspace_id === currentWorkspace.id && item.status === 'active' && asArray(item.roles).includes(roles.OWNER_ADMIN),
    );

    if (isOwnerAdmin && nextStatus !== 'active' && activeOwners.length <= 1) {
      throw new Error('You cannot suspend or revoke the last active Workspace Owner / Company Admin.');
    }

    if (member.user_id === session.user.id && nextStatus !== 'active') {
      throw new Error('You cannot suspend or revoke your own workspace access from Settings.');
    }

    const { data: row, error: updateError } = await client
      .from('workspace_members')
      .update({ status: nextStatus })
      .eq('id', memberId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Member status could not be updated.'));

    const lifecycleAction = nextStatus === 'suspended'
      ? 'team_member_suspended'
      : nextStatus === 'active'
        ? 'team_member_reactivated'
        : 'team_member_revoked';

    await writeActivityLog(lifecycleAction, { member_id: memberId, user_id: member.user_id, status: nextStatus });
    if (nextStatus === 'active') member.status = 'active';
    if (nextStatus === 'suspended' || nextStatus === 'active') {
      await safeCreateNotification({
        recipient_user_id: member.user_id,
        event_type: nextStatus === 'suspended' ? 'member_suspended' : 'member_reactivated',
        title: nextStatus === 'suspended' ? 'Workspace access suspended' : 'Workspace access reactivated',
        body: nextStatus === 'suspended'
          ? 'Your workspace access has been suspended by a Workspace Owner.'
          : 'Your workspace access has been reactivated by a Workspace Owner.',
        priority: 'normal',
        action_url: nextStatus === 'suspended' ? '/suspended' : '/login/redirect',
      });
    }
    await refreshWorkspaceData();

    return normalizeMember(row);
  };

  const revokeWorkspaceInvite = async (inviteId) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'invite');

    const invite = asArray(data.invites).find((item) => item.id === inviteId && item.workspace_id === currentWorkspace.id);
    if (!invite) throw new Error('Invite was not found in the current workspace.');
    if (invite.status !== 'pending') throw new Error('Only pending invites can be revoked.');

    const { data: row, error: updateError } = await client
      .from('workspace_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('workspace_id', currentWorkspace.id)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Invite could not be revoked.'));

    await writeActivityLog('team_invite_revoked', { invite_id: inviteId, email: invite.email });
    await refreshWorkspaceData();

    return row;
  };

  const createPropertyAssignment = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'propertyAssignment');

    const propertyId = payload.property_id || payload.propertyId;
    const userId = payload.user_id || payload.userId;
    const assignmentRole = payload.assignment_role || payload.assignmentRole;

    requireAllowedValue(assignmentRole, propertyAssignmentRoleOptions, 'assignment role');
    const property = requireWorkspaceProperty(data.properties, propertyId);
    if (property.workspace_id !== currentWorkspace.id) throw new Error('Selected property must belong to the current workspace.');

    const member = asArray(data.members).find((item) => item.workspace_id === currentWorkspace.id && memberUserId(item) === userId);
    if (!member || member.status !== 'active') throw new Error('Assigned user must be an active member of this workspace.');
    if (!asArray(member.roles).includes(assignmentRole)) {
      throw new Error('Assignment role must match one of the active member roles. Update the member role in a future role-management release before assigning this access.');
    }

    const { data: row, error: upsertError } = await client.from('property_assignments').upsert(
      {
        workspace_id: currentWorkspace.id,
        property_id: propertyId,
        user_id: userId,
        assignment_role: assignmentRole,
        created_by: session.user.id,
      },
      { onConflict: 'property_id,user_id,assignment_role' },
    ).select('*').maybeSingle();

    if (upsertError) throw new Error(formatSupabaseError(upsertError, 'Property assignment could not be saved.'));

    await writeActivityLog('property_assignment.created', { assignment_id: row?.id, property_id: propertyId, user_id: userId, assignment_role: assignmentRole });
    await refreshWorkspaceData();

    return row;
  };

  const removePropertyAssignment = async (assignmentId) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'propertyAssignment');

    const assignment = asArray(data.propertyAssignments).find((item) => item.id === assignmentId && item.workspace_id === currentWorkspace.id);
    if (!assignment) throw new Error('Property assignment was not found in the current workspace.');

    const { error: deleteError } = await client
      .from('property_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('workspace_id', currentWorkspace.id);

    if (deleteError) throw new Error(formatSupabaseError(deleteError, 'Property assignment could not be removed.'));

    await writeActivityLog('property_assignment.removed', { assignment_id: assignmentId, property_id: assignment.property_id, user_id: assignment.user_id, assignment_role: assignment.assignment_role });
    await refreshWorkspaceData();

    return assignment;
  };

  const createReport = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'report');

    const reportType = payload.report_type || 'owner_report';
    const status = payload.status || 'draft';
    requireAllowedValue(reportType, reportTypes, 'report type');
    requireAllowedValue(status, reportStatuses, 'report status');

    const startDate = cleanDateOnly(payload.start_date, 'Start date');
    const endDate = cleanDateOnly(payload.end_date, 'End date');

    if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
      throw new Error('End date must be on or after start date.');
    }

    const propertyId = payload.property_id || null;
    if (propertyId) requireWorkspaceProperty(data.properties, propertyId);

    const ownerId = payload.owner_id || null;
    assertAssignedOwnerIsWorkspaceMember(data.members, currentWorkspace.id, ownerId);

    const contactId = payload.contact_id || null;
    assertOwnerContactIsWorkspaceOwner(data.contacts, contactId);

    const reportPayload = stripUnsupportedPayloadKeys(
      {
        workspace_id: currentWorkspace.id,
        property_id: propertyId,
        owner_id: ownerId,
        contact_id: contactId,
        title: cleanText(payload.title) || 'Owner report',
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
        summary: cleanText(payload.summary),
        notes: cleanText(payload.notes),
        status,
        created_by: session.user.id,
        generated_by: session.user.id,
        file_id: payload.file_id || null,
        summary_data: payload.summary_data && typeof payload.summary_data === 'object' ? payload.summary_data : {},
      },
      [
        'workspace_id',
        'property_id',
        'owner_id',
        'contact_id',
        'title',
        'report_type',
        'start_date',
        'end_date',
        'summary',
        'notes',
        'status',
        'created_by',
        'generated_by',
        'file_id',
        'summary_data',
      ],
    );

    const { data: row, error: insertError } = await client
      .from('owner_reports')
      .insert(reportPayload)
      .select('*')
      .single();

    if (insertError) {
      throw new Error(formatSupabaseError(insertError, 'Report could not be saved. Confirm the owner_reports columns exist.'));
    }

    await writeActivityLog('owner_report_created', { report_id: row.id, report_type: row.report_type, title: row.title, property_id: row.property_id, owner_id: row.owner_id, start_date: row.start_date, end_date: row.end_date, status: row.status });
    if (['ready', 'released', 'published'].includes(row.status)) {
      await safeCreateNotification({
        recipient_user_id: row.owner_id || null,
        recipient_role: row.owner_id ? null : roles.OWNER,
        event_type: 'owner_report_ready',
        title: 'Owner report ready',
        body: `${row.title || 'An owner report'} is ready to review.`,
        priority: 'normal',
        related_property_id: row.property_id,
        related_report_id: row.id,
        entity_type: 'owner_report',
        entity_id: row.id,
        action_url: '/reports',
        channels: ['in_app'],
      });
    }
    await refreshWorkspaceData();

    return normalizeReport(row);
  };

  const createOwnerReport = createReport;

  const buildExpensePayload = (payload, { partial = false } = {}) => {
    const allowed = [
      'property_id',
      'booking_id',
      'maintenance_work_order_id',
      'cleaning_task_id',
      'contact_id',
      'category',
      'description',
      'vendor_name',
      'expense_date',
      'amount',
      'currency',
      'payment_status',
      'expense_status',
      'notes',
      'archived_at',
    ];

    const expensePayload = stripUnsupportedPayloadKeys(payload || {}, allowed);
    const propertyId = expensePayload.property_id || null;
    let property = null;

    if (propertyId) {
      property = requireWorkspaceProperty(data.properties, propertyId);
      expensePayload.property_id = propertyId;
    } else if ('property_id' in expensePayload) {
      expensePayload.property_id = null;
    }

    if ('booking_id' in expensePayload) {
      expensePayload.booking_id = expensePayload.booking_id || null;
      requireWorkspaceScopedRecord(data.bookings, expensePayload.booking_id, 'booking', propertyId);
    }

    if ('cleaning_task_id' in expensePayload) {
      expensePayload.cleaning_task_id = expensePayload.cleaning_task_id || null;
      requireWorkspaceScopedRecord(data.cleaningTasks, expensePayload.cleaning_task_id, 'cleaning task', propertyId);
    }

    if ('maintenance_work_order_id' in expensePayload) {
      expensePayload.maintenance_work_order_id = expensePayload.maintenance_work_order_id || null;
      requireWorkspaceScopedRecord(data.maintenanceWorkOrders, expensePayload.maintenance_work_order_id, 'maintenance work order', propertyId);
    }

    if ('contact_id' in expensePayload) {
      expensePayload.contact_id = expensePayload.contact_id || null;
      requireWorkspaceScopedRecord(data.contacts, expensePayload.contact_id, 'contact');
    }

    if (!partial || 'description' in expensePayload) {
      expensePayload.description = cleanText(expensePayload.description);
      if (!expensePayload.description) throw new Error('Expense description is required.');
    }

    if (!partial || 'category' in expensePayload) {
      expensePayload.category = expensePayload.category || 'other';
      requireAllowedValue(expensePayload.category, expenseCategoryValues, 'expense category');

      const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);
      if (activeRoles.includes(roles.HOST) && !activeRoles.some((role) => [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER].includes(role)) && sensitiveHostExpenseCategories.includes(expensePayload.category)) {
        throw new Error('Your role cannot create or edit this sensitive expense category.');
      }
    }

    if (!partial || 'expense_date' in expensePayload) {
      expensePayload.expense_date = cleanDateOnly(expensePayload.expense_date, 'Expense date');
    }

    if (!partial || 'amount' in expensePayload) {
      expensePayload.amount = cleanExpenseAmount(expensePayload.amount);
    }

    if (!partial || 'currency' in expensePayload) {
      expensePayload.currency = expensePayload.currency || property?.currency || currentWorkspace.defaultCurrency || 'USD';
      requireAllowedValue(expensePayload.currency, workspaceCreationCurrencies, 'currency');
    }

    if (!partial || 'payment_status' in expensePayload) {
      expensePayload.payment_status = expensePayload.payment_status || 'unpaid';
      requireAllowedValue(expensePayload.payment_status, expensePaymentStatusValues, 'payment status');
    }

    if (!partial || 'expense_status' in expensePayload) {
      expensePayload.expense_status = expensePayload.expense_status || 'active';
      requireAllowedValue(expensePayload.expense_status, expenseStatusValues, 'expense status');
    }

    if ('vendor_name' in expensePayload) expensePayload.vendor_name = cleanText(expensePayload.vendor_name);
    if ('notes' in expensePayload) expensePayload.notes = cleanText(expensePayload.notes);

    return expensePayload;
  };

  const createExpense = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'expense');

    const expensePayload = buildExpensePayload(payload, { partial: false });
    expensePayload.workspace_id = currentWorkspace.id;
    expensePayload.created_by = session.user.id;

    const { data: row, error: insertError } = await client
      .from('expenses')
      .insert(expensePayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Expense could not be saved.'));

    await refreshWorkspaceData();

    return normalizeExpense(row, data.properties);
  };

  const updateExpense = async (expenseId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'expense');

    const existingExpense = asArray(data.expenses).find((expense) => expense.id === expenseId);
    if (!existingExpense) throw new Error('Expense was not found in the current workspace.');
    if (existingExpense.expense_status === 'archived' && payload?.expense_status !== 'active' && !('archived_at' in (payload || {}))) {
      throw new Error('Archived expenses must be restored before editing details.');
    }

    const updatePayload = buildExpensePayload(payload, { partial: true });

    const { data: row, error: updateError } = await client
      .from('expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Expense could not be updated.'));

    await refreshWorkspaceData();

    return normalizeExpense(row, data.properties);
  };

  const archiveExpense = async (expenseId, archived = true) =>
    updateExpense(expenseId, {
      archived_at: archived ? new Date().toISOString() : null,
      expense_status: archived ? 'archived' : 'active',
    });

  const createWorkspaceExpense = createExpense;

  const validateFileUploadContext = (normalizedContext) => {
    const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);
    const fileCategory = normalizedContext.fileCategory;

    if (normalizedContext.propertyId) {
      requireWorkspaceProperty(data.properties, normalizedContext.propertyId);
    }

    const booking = requireWorkspaceScopedRecord(data.bookings, normalizedContext.bookingId, 'booking', normalizedContext.propertyId);
    const cleaningTask = requireWorkspaceScopedRecord(data.cleaningTasks, normalizedContext.cleaningTaskId, 'cleaning task', normalizedContext.propertyId);
    const workOrder = requireWorkspaceScopedRecord(data.maintenanceWorkOrders, normalizedContext.maintenanceWorkOrderId, 'maintenance work order', normalizedContext.propertyId);
    const expense = requireWorkspaceScopedRecord(data.expenses, normalizedContext.expenseId, 'expense', normalizedContext.propertyId);
    const report = requireWorkspaceScopedRecord(data.ownerReports, normalizedContext.reportId, 'owner report', normalizedContext.propertyId);
    requireWorkspaceScopedRecord(data.contacts, normalizedContext.contactId, 'contact');

    if (booking && normalizedContext.propertyId && getRecordPropertyId(booking) !== normalizedContext.propertyId) {
      throw new Error('Selected booking must match the selected property.');
    }

    if (cleanerFileCategories.includes(fileCategory)) {
      if (!cleaningTask) throw new Error('Cleaning photos must be linked to a visible cleaning task.');
      if (['completed', 'guest_ready', 'cancelled'].includes(cleaningTask.status)) {
        throw new Error('Completed, guest-ready, and cancelled cleaning tasks cannot receive new photos.');
      }
      const isManager = workspaceActionRoles.cleaning.some((role) => activeRoles.includes(role));
      const isAssignedCleaner = cleaningTask.assigned_cleaner_id === session.user.id || cleaningTask.assignedCleanerId === session.user.id;
      if (!isManager && !isAssignedCleaner) {
        throw new Error('You can only upload cleaning photos for assigned cleaning tasks.');
      }
      return;
    }

    if (maintenanceFileCategories.includes(fileCategory)) {
      if (!workOrder) throw new Error('Maintenance files must be linked to a visible maintenance work order.');
      if (maintenanceClosedStatuses.includes(workOrder.status)) {
        throw new Error('Completed and cancelled maintenance work orders cannot receive new files.');
      }
      const isManager = workspaceActionRoles.maintenance.some((role) => activeRoles.includes(role));
      const isAssignedMaintenance = workOrder.assigned_maintenance_id === session.user.id || workOrder.assignedMaintenanceId === session.user.id;
      if (!isManager && !isAssignedMaintenance) {
        throw new Error('You can only upload maintenance files for assigned work orders.');
      }
      return;
    }

    if (fileManagerRoles.some((role) => activeRoles.includes(role))) return;

    if (activeRoles.includes(roles.HOST) && hostFileCategories.includes(fileCategory)) return;

    if (activeRoles.includes(roles.ACCOUNTANT) && accountantFileCategories.includes(fileCategory)) {
      if (fileCategory === 'receipt' && !expense) throw new Error('Receipt uploads must be linked to a workspace expense.');
      if (fileCategory === 'report_file' && !report) throw new Error('Report uploads must be linked to an owner report record.');
      return;
    }

    throw new Error('Your current workspace role cannot upload this file category.');
  };

  const uploadWorkspaceFile = async (fileOrOptions, maybeContext = {}) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const options = fileOrOptions?.file ? fileOrOptions : { file: fileOrOptions, ...maybeContext };
    const file = options.file;

    if (!file) {
      throw new Error('Choose a file before uploading.');
    }

    const normalizedContext = {
      fileCategory: normalizeFileCategory(options.fileCategory || options.file_category || options.category),
      propertyId: options.propertyId || options.property_id || null,
      bookingId: options.bookingId || options.booking_id || null,
      cleaningTaskId: options.cleaningTaskId || options.cleaning_task_id || (options.relatedTable === 'cleaning_tasks' ? options.relatedId : null) || null,
      maintenanceWorkOrderId: options.maintenanceWorkOrderId || options.maintenance_work_order_id || (options.relatedTable === 'maintenance_work_orders' ? options.relatedId : null) || null,
      expenseId: options.expenseId || options.expense_id || null,
      reportId: options.reportId || options.report_id || null,
      contactId: options.contactId || options.contact_id || null,
      notes: cleanText(options.notes),
    };

    assertFileTypeAndSize(file, normalizedContext.fileCategory);
    validateFileUploadContext(normalizedContext);

    const storagePath = buildWorkspaceFilePath(currentWorkspace.id, normalizedContext, file);

    const entityContext = getEntityContext(normalizedContext);

    const filePayload = {
      workspace_id: currentWorkspace.id,
      property_id: normalizedContext.propertyId,
      booking_id: normalizedContext.bookingId,
      cleaning_task_id: normalizedContext.cleaningTaskId,
      maintenance_work_order_id: normalizedContext.maintenanceWorkOrderId,
      expense_id: normalizedContext.expenseId,
      report_id: normalizedContext.reportId,
      contact_id: normalizedContext.contactId,
      file_category: normalizedContext.fileCategory,
      file_path: storagePath,
      entity_type: entityContext.entityType,
      entity_id: entityContext.entityId === 'workspace' ? currentWorkspace.id : entityContext.entityId,
      visibility: 'private',
      uploaded_by: session.user.id,
      notes: normalizedContext.notes,
      metadata: { source: 'propflow_web_app' },
    };

    let row;
    try {
      row = await uploadPrivateWorkspaceFile({
        supabase: client,
        file,
        metadata: filePayload,
        bucket: workspaceFileBucket,
      });
    } catch (uploadError) {
      throw new Error(formatSupabaseError(uploadError, uploadError?.code ? 'File record could not be saved. The uploaded object was cleaned up when possible.' : 'File upload failed. Confirm the private workspace-files bucket and storage policies are applied.'));
    }

    const normalizedFile = normalizeFileUpload(row);

    const notificationTitleByCategory = {
      property_photo: 'Property photo uploaded',
      cleaning_before_photo: 'Cleaning proof photo uploaded',
      cleaning_after_photo: 'Cleaning proof photo uploaded',
      maintenance_issue_photo: 'Maintenance issue photo uploaded',
      maintenance_completion_photo: 'Maintenance completion photo uploaded',
      receipt: 'Receipt uploaded',
      invoice: 'Invoice uploaded',
      lease: 'Document uploaded',
      contract: 'Document uploaded',
      report_file: 'Document uploaded',
      general_document: 'Document uploaded',
    };

    Promise.resolve().then(async () => {
      await writeActivityLog('file_uploaded', {
        file_upload_id: normalizedFile.id,
        file_category: normalizedFile.fileCategory,
        property_id: normalizedFile.propertyId,
        cleaning_task_id: normalizedFile.cleaningTaskId,
        maintenance_work_order_id: normalizedFile.maintenanceWorkOrderId,
        expense_id: normalizedFile.expenseId,
        report_id: normalizedFile.reportId,
        mime_type: normalizedFile.mimeType,
        size_bytes: normalizedFile.fileSize,
      });

      await notifyWorkspaceManagers({
        event_type: 'file_uploaded',
        title: notificationTitleByCategory[normalizedFile.fileCategory] || 'Private file uploaded',
        body: `${normalizedFile.fileName || 'A private file'} was uploaded to PropFlow private storage.`,
        priority: 'normal',
        related_property_id: normalizedFile.propertyId,
        related_cleaning_task_id: normalizedFile.cleaningTaskId,
        related_maintenance_work_order_id: normalizedFile.maintenanceWorkOrderId,
        related_expense_id: normalizedFile.expenseId,
        related_report_id: normalizedFile.reportId,
        related_file_upload_id: normalizedFile.id,
        entity_type: 'file_upload',
        entity_id: normalizedFile.id,
        metadata: { file_category: normalizedFile.fileCategory },
      });
    }).catch((notificationError) => {
      console.warn('[PropFlow] File upload activity/notification skipped', notificationError);
    });

    await refreshWorkspaceData();

    return normalizedFile;
  };

  const getFileSignedUrl = async (fileUploadOrId, expiresIn = 300) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const fileId = typeof fileUploadOrId === 'string' ? fileUploadOrId : fileUploadOrId?.id;
    let fileUpload = typeof fileUploadOrId === 'object' ? fileUploadOrId : null;

    if (!fileId && !fileUpload?.filePath) throw new Error('Select a file to view.');

    if (!fileUpload || fileUpload.workspaceId !== currentWorkspace.id) {
      const { data: row, error: lookupError } = await client
        .from('file_uploads')
        .select('*')
        .eq('id', fileId)
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (lookupError) throw new Error(formatSupabaseError(lookupError, 'File record could not be loaded.'));
      if (!row) throw new Error('File is not available in this workspace.');
      fileUpload = normalizeFileUpload(row);
    }

    const bucketName = fileUpload.bucketName || fileUpload.bucket_name || workspaceFileBucket;
    const filePath = fileUpload.filePath || fileUpload.file_path || fileUpload.path;

    if (bucketName !== workspaceFileBucket || !filePath) {
      throw new Error('This file is not stored in the private workspace file bucket.');
    }

    const { data: signedData, error: signedError } = await client.storage
      .from(workspaceFileBucket)
      .createSignedUrl(filePath, expiresIn);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(formatSupabaseError(signedError, 'Signed file link could not be created.'));
    }

    return signedData.signedUrl;
  };

  const archiveFileUpload = async (fileUploadId, archived = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    if (!fileUploadId) throw new Error('Select a file to update.');

    const { data: row, error: updateError } = await client
      .from('file_uploads')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', fileUploadId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'File archive status could not be updated.'));
    }

    await refreshWorkspaceData();

    return normalizeFileUpload(row);
  };


  const canCreateLimitedOperationalNotification = (payload = {}) => {
    const eventType = cleanText(payload.event_type || payload.eventType);
    if (!limitedOperationalNotificationTypes.includes(eventType)) return false;

    if (eventType.startsWith('cleaning_')) {
      const taskId = payload.related_cleaning_task_id || payload.relatedCleaningTaskId;
      const task = asArray(data.cleaningTasks).find((item) => item.id === taskId);
      return Boolean(task && task.assigned_cleaner_id === session?.user?.id);
    }

    if (eventType.startsWith('maintenance_')) {
      const workOrderId = payload.related_maintenance_work_order_id || payload.relatedMaintenanceWorkOrderId;
      const workOrder = asArray(data.maintenanceWorkOrders).find((item) => item.id === workOrderId);
      return Boolean(workOrder && workOrder.assigned_maintenance_id === session?.user?.id);
    }

    return false;
  };

  const requireNotificationManagerRole = (payload = {}) => {
    const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);
    if (notificationManagerRoles.some((role) => activeRoles.includes(role)) || canCreateLimitedOperationalNotification(payload)) {
      return;
    }
    throw new Error('Your current workspace role cannot create workspace notifications.');
  };

  const requireProviderManagerRole = () => {
    const activeRoles = getActiveWorkspaceRoles(currentUser, memberships, currentWorkspace);
    if (!providerManagerRoles.some((role) => activeRoles.includes(role))) {
      throw new Error('Only Workspace Owners / Company Admins can update notification provider settings.');
    }
  };

  const requireActiveNotificationRecipient = (recipientUserId) => {
    if (!recipientUserId) return null;

    const member = getActiveWorkspaceMembers(data.members, currentWorkspace.id).find((item) => memberUserId(item) === recipientUserId);
    if (!member) throw new Error('Notification recipient must be an active member of this workspace.');
    if (asArray(member.roles).includes(roles.ADMIN)) {
      throw new Error('PropFlow Admin is platform-level only and cannot be targeted as a customer workspace recipient.');
    }

    return member;
  };

  const validateNotificationRelatedRecords = (payload) => {
    if (payload.related_property_id) requireWorkspaceProperty(data.properties, payload.related_property_id);
    if (payload.related_booking_id) requireWorkspaceScopedRecord(data.bookings, payload.related_booking_id, 'booking', payload.related_property_id);
    if (payload.related_cleaning_task_id) requireWorkspaceScopedRecord(data.cleaningTasks, payload.related_cleaning_task_id, 'cleaning task', payload.related_property_id);
    if (payload.related_maintenance_work_order_id) requireWorkspaceScopedRecord(data.maintenanceWorkOrders, payload.related_maintenance_work_order_id, 'maintenance work order', payload.related_property_id);
    if (payload.related_expense_id) requireWorkspaceScopedRecord(data.expenses, payload.related_expense_id, 'expense', payload.related_property_id);
    if (payload.related_report_id) requireWorkspaceScopedRecord(data.ownerReports, payload.related_report_id, 'owner report', payload.related_property_id);
    if (payload.related_file_upload_id) requireWorkspaceScopedRecord(data.fileUploads, payload.related_file_upload_id, 'file upload', payload.related_property_id);
    if (payload.related_invite_id) requireWorkspaceScopedRecord(data.invites, payload.related_invite_id, 'workspace invite');
  };

  const getPreferenceForEventType = (recipientUserId, eventType) => {
    const eventGroup = getNotificationEventGroup(eventType);
    if (recipientUserId !== session?.user?.id) {
      return {
        eventGroup,
        in_app_enabled: true,
        email_enabled: false,
        sms_enabled: false,
        whatsapp_enabled: false,
      };
    }

    const preference = asArray(data.notificationPreferences).find((item) => (item.event_group || item.eventGroup) === eventGroup);
    return preference || {
      eventGroup,
      in_app_enabled: true,
      email_enabled: false,
      sms_enabled: false,
      whatsapp_enabled: false,
    };
  };

  const getProviderSettingForChannel = (channel) => {
    const provider = channel === 'email' ? 'resend' : 'twilio';
    return asArray(data.notificationProviderSettings).find((item) => item.channel === channel && item.provider === provider) || {
      provider,
      channel,
      enabled: false,
      configured: false,
    };
  };

  const createDeliveryLogsForNotification = async (client, notification, channels = null) => {
    const preference = getPreferenceForEventType(notification.recipient_user_id, notification.event_type);
    const requestedChannels = Array.isArray(channels) && channels.length ? channels : notificationChannelValues;
    const logs = requestedChannels
      .filter((channel) => notificationChannelValues.includes(channel))
      .map((channel) => {
        const enabled = channel === 'in_app'
          ? preference.in_app_enabled !== false && preference.inAppEnabled !== false
          : Boolean(preference[`${channel}_enabled`] ?? preference[`${channel}Enabled`]);
        const providerSetting = channel === 'in_app' ? { provider: 'internal', enabled: true, configured: true } : getProviderSettingForChannel(channel);
        const status = !enabled
          ? 'skipped'
          : channel === 'in_app'
            ? 'sent'
            : providerSetting.enabled && providerSetting.configured
              ? 'queued'
              : 'provider_not_configured';

        return {
          workspace_id: currentWorkspace.id,
          notification_id: notification.id,
          channel,
          provider: providerSetting.provider,
          recipient_user_id: notification.recipient_user_id,
          recipient_address: null,
          status,
          error_message: status === 'provider_not_configured' ? 'Provider setup required before external delivery can send.' : null,
          attempted_at: channel === 'in_app' ? new Date().toISOString() : null,
          sent_at: channel === 'in_app' && status === 'sent' ? new Date().toISOString() : null,
        };
      })
      .filter((log) => deliveryStatusValues.includes(log.status));

    if (!logs.length) return;

    const { error: logError } = await client.from('notification_delivery_logs').insert(logs);
    if (logError) console.warn('[PropFlow] Notification delivery log insert failed', logError);
  };

  const createNotification = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    requireNotificationManagerRole(payload);

    const allowed = [
      'recipient_user_id',
      'recipientUserId',
      'recipient_role',
      'recipientRole',
      'actor_user_id',
      'actorUserId',
      'event_type',
      'eventType',
      'title',
      'body',
      'message',
      'priority',
      'related_property_id',
      'relatedPropertyId',
      'related_booking_id',
      'relatedBookingId',
      'related_cleaning_task_id',
      'relatedCleaningTaskId',
      'related_maintenance_work_order_id',
      'relatedMaintenanceWorkOrderId',
      'related_expense_id',
      'relatedExpenseId',
      'related_report_id',
      'relatedReportId',
      'related_file_upload_id',
      'relatedFileUploadId',
      'related_invite_id',
      'relatedInviteId',
      'entity_type',
      'entityType',
      'entity_id',
      'entityId',
      'action_url',
      'actionUrl',
      'metadata',
      'channels',
    ];
    const cleanPayload = stripUnsupportedPayloadKeys(payload || {}, allowed);
    const eventType = cleanText(cleanPayload.event_type || cleanPayload.eventType);
    const title = cleanText(cleanPayload.title);
    const body = cleanText(cleanPayload.body || cleanPayload.message);
    const priority = cleanPayload.priority || 'normal';
    const recipientUserId = cleanPayload.recipient_user_id || cleanPayload.recipientUserId;

    requireActiveNotificationRecipient(recipientUserId);
    requireAllowedValue(eventType, notificationEventTypeValues, 'notification event type');
    requireAllowedValue(priority, notificationPriorities, 'notification priority');
    if (!title || title.length > 160) throw new Error('Notification title is required and must be 160 characters or less.');
    if (body && body.length > 1000) throw new Error('Notification body must be 1,000 characters or less.');

    const notificationPayload = {
      workspace_id: currentWorkspace.id,
      recipient_user_id: recipientUserId,
      recipient_role: cleanPayload.recipient_role || cleanPayload.recipientRole || null,
      actor_user_id: cleanPayload.actor_user_id || cleanPayload.actorUserId || session.user.id,
      created_by: cleanPayload.actor_user_id || cleanPayload.actorUserId || session.user.id,
      event_type: eventType,
      type: eventType,
      title,
      body,
      message: body || title,
      status: 'unread',
      priority,
      related_property_id: cleanPayload.related_property_id || cleanPayload.relatedPropertyId || null,
      related_booking_id: cleanPayload.related_booking_id || cleanPayload.relatedBookingId || null,
      related_cleaning_task_id: cleanPayload.related_cleaning_task_id || cleanPayload.relatedCleaningTaskId || null,
      related_maintenance_work_order_id: cleanPayload.related_maintenance_work_order_id || cleanPayload.relatedMaintenanceWorkOrderId || null,
      related_expense_id: cleanPayload.related_expense_id || cleanPayload.relatedExpenseId || null,
      related_report_id: cleanPayload.related_report_id || cleanPayload.relatedReportId || null,
      related_file_upload_id: cleanPayload.related_file_upload_id || cleanPayload.relatedFileUploadId || null,
      related_invite_id: cleanPayload.related_invite_id || cleanPayload.relatedInviteId || null,
      entity_type: cleanPayload.entity_type || cleanPayload.entityType || null,
      entity_id: cleanPayload.entity_id || cleanPayload.entityId || null,
      action_url: cleanPayload.action_url || cleanPayload.actionUrl || null,
      metadata: cleanPayload.metadata && typeof cleanPayload.metadata === 'object' ? cleanPayload.metadata : {},
    };

    // Database RLS and scoped-record checks validate related ids. Avoid blocking the
    // primary workflow when the local cache has not refreshed with the new record yet.

    const { data: row, error: insertError } = await client
      .from('notifications')
      .insert(notificationPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Notification could not be created.'));

    await createDeliveryLogsForNotification(client, row, cleanPayload.channels);
    await refreshWorkspaceData();

    return normalizeNotification(row);
  };

  const safeCreateNotification = async (payload) => {
    try {
      return await createNotification(payload);
    } catch (notificationError) {
      console.warn('[PropFlow] Notification hook skipped', notificationError);
      return null;
    }
  };

  const notifyWorkspaceManagers = async (payload, { ownersOnly = false } = {}) => {
    const recipients = ownersOnly ? getWorkspaceOwners(data.members, currentWorkspace.id) : getWorkspaceManagers(data.members, currentWorkspace.id);
    await Promise.all(
      recipients
        .map(memberUserId)
        .filter(Boolean)
        .filter((userId, index, list) => list.indexOf(userId) === index)
        .map((recipientUserId) => safeCreateNotification({ ...payload, recipient_user_id: recipientUserId })),
    );
  };


  const requireCalendarImportManager = () => {
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'calendarImport');
  };

  const cleanCalendarImportUrl = (value) => {
    const text = cleanText(value);
    if (!text) throw new Error('Feed URL is required.');

    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error('Feed URL must be a valid https:// URL.');
    }

    if (url.protocol !== 'https:') {
      throw new Error('Feed URL must start with https://.');
    }

    if (url.username || url.password) {
      throw new Error('Feed URL must not include embedded credentials.');
    }

    return url.toString();
  };

  const createCalendarImportFeed = async (payload = {}) => {
    const client = requireSupabase();
    requireCalendarImportManager();
    const selectedProperty = requireWorkspaceProperty(data.properties, payload.property_id || payload.propertyId);
    const providerType = payload.provider_type || payload.providerType || 'other_ical';
    const status = payload.status || 'active';
    const importAs = payload.import_as || payload.importAs || 'booking_block';
    const name = cleanText(payload.name);

    if (!name) throw new Error('Feed name is required.');
    requireAllowedValue(providerType, calendarImportProviderTypeValues, 'calendar import provider');
    requireAllowedValue(status, calendarImportStatusValues, 'calendar import status');
    requireAllowedValue(importAs, calendarImportedEventTypeValues, 'calendar import event type');

    const { data: row, error } = await client
      .from('calendar_import_feeds')
      .insert({
        workspace_id: currentWorkspace.id,
        property_id: selectedProperty.id,
        provider_type: providerType,
        name,
        feed_url: cleanCalendarImportUrl(payload.feed_url || payload.feedUrl),
        status,
        timezone: cleanText(payload.timezone),
        import_as: importAs,
        auto_create_bookings: false,
        auto_create_cleaning_tasks: false,
        created_by: session.user.id,
      })
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error, 'Calendar import feed could not be created.'));

    await writeActivityLog('ical_feed_added', { feedId: row.id, propertyId: row.property_id, providerType: row.provider_type });
    await refreshWorkspaceData();
    return normalizeCalendarImportFeed(row, data.properties);
  };

  const updateCalendarImportFeed = async (feedId, payload = {}) => {
    const client = requireSupabase();
    requireCalendarImportManager();
    const existing = asArray(data.calendarImportFeeds).find((feed) => feed.id === feedId);
    if (!existing) throw new Error('Calendar import feed was not found in this workspace.');

    const allowed = ['property_id', 'propertyId', 'provider_type', 'providerType', 'name', 'feed_url', 'feedUrl', 'status', 'timezone', 'import_as', 'importAs'];
    const cleanPayload = stripUnsupportedPayloadKeys(payload, allowed);
    const updates = {};

    if ('property_id' in cleanPayload || 'propertyId' in cleanPayload) {
      updates.property_id = requireWorkspaceProperty(data.properties, cleanPayload.property_id || cleanPayload.propertyId).id;
    }
    if ('provider_type' in cleanPayload || 'providerType' in cleanPayload) {
      updates.provider_type = cleanPayload.provider_type || cleanPayload.providerType;
      requireAllowedValue(updates.provider_type, calendarImportProviderTypeValues, 'calendar import provider');
    }
    if ('status' in cleanPayload) {
      updates.status = cleanPayload.status;
      requireAllowedValue(updates.status, calendarImportStatusValues, 'calendar import status');
    }
    if ('import_as' in cleanPayload || 'importAs' in cleanPayload) {
      updates.import_as = cleanPayload.import_as || cleanPayload.importAs;
      requireAllowedValue(updates.import_as, calendarImportedEventTypeValues, 'calendar import event type');
    }
    if ('name' in cleanPayload) {
      updates.name = cleanText(cleanPayload.name);
      if (!updates.name) throw new Error('Feed name is required.');
    }
    if ('feed_url' in cleanPayload || 'feedUrl' in cleanPayload) updates.feed_url = cleanCalendarImportUrl(cleanPayload.feed_url || cleanPayload.feedUrl);
    if ('timezone' in cleanPayload) updates.timezone = cleanText(cleanPayload.timezone);

    const { data: row, error } = await client
      .from('calendar_import_feeds')
      .update(updates)
      .eq('id', feedId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error, 'Calendar import feed could not be updated.'));

    if (updates.status === 'paused') {
      await notifyWorkspaceManagers({
        event_type: 'ical_feed_paused',
        title: 'iCal feed paused',
        body: `${row.name} was paused and will not sync until reactivated.`,
        priority: 'normal',
        related_property_id: row.property_id,
        action_url: '/calendar-imports',
        metadata: { feedId: row.id },
      });
    }

    await refreshWorkspaceData();
    return normalizeCalendarImportFeed(row, data.properties);
  };

  const archiveCalendarImportFeed = async (feedId, archived = true) => {
    const client = requireSupabase();
    requireCalendarImportManager();
    const existing = asArray(data.calendarImportFeeds).find((feed) => feed.id === feedId);
    if (!existing) throw new Error('Calendar import feed was not found in this workspace.');

    const updates = archived
      ? { status: 'archived', archived_at: new Date().toISOString() }
      : { status: 'active', archived_at: null };

    const { data: row, error } = await client
      .from('calendar_import_feeds')
      .update(updates)
      .eq('id', feedId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error, 'Calendar import feed archive status could not be updated.'));

    if (archived) {
      await writeActivityLog('ical_feed_archived', { feedId: row.id, propertyId: row.property_id, providerType: row.provider_type });
      await notifyWorkspaceManagers({
        event_type: 'ical_feed_archived',
        title: 'iCal feed archived',
        body: `${row.name} was archived and hidden from default calendar import views.`,
        priority: 'normal',
        related_property_id: row.property_id,
        action_url: '/calendar-imports',
        metadata: { feedId: row.id },
      });
    }

    await refreshWorkspaceData();
    return normalizeCalendarImportFeed(row, data.properties);
  };

  const syncCalendarImportFeed = async (feedId) => {
    requireCalendarImportManager();
    const feed = asArray(data.calendarImportFeeds).find((item) => item.id === feedId);
    if (!feed) throw new Error('Calendar import feed was not found in this workspace.');
    if (feed.status !== 'active' || feed.archivedAt || feed.archived_at) {
      throw new Error('Paused or archived feeds cannot be synced.');
    }

    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('Your session expired. Sign in again before syncing.');

    const response = await fetch('/api/import-ical-feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ feedId }),
    });

    const result = await response.json().catch(() => ({}));
    await refreshWorkspaceData();

    await writeActivityLog(response.ok ? 'ical_import_run' : 'ical_import_failed', { feedId, status: result.status || result.code, eventsCreated: result.eventsCreated, eventsUpdated: result.eventsUpdated, conflictsFound: result.conflictsFound });

    if (!response.ok) {
      await notifyWorkspaceManagers({
        event_type: 'ical_sync_failed',
        title: 'iCal sync failed',
        body: result.message || 'Calendar feed sync failed. Review the feed URL and latest sync run.',
        priority: 'high',
        related_property_id: feed.propertyId || feed.property_id,
        action_url: '/calendar-imports',
        metadata: { feedId, code: result.code },
      });
      throw new Error(result.message || 'Calendar import sync failed.');
    }

    if (Number(result.conflictsFound || result.conflicts_found || 0) > 0) {
      await notifyWorkspaceManagers({
        event_type: 'ical_sync_conflicts_found',
        title: 'iCal sync found conflicts',
        body: `${result.conflictsFound || result.conflicts_found} imported calendar conflict(s) need review.`,
        priority: 'high',
        related_property_id: feed.propertyId || feed.property_id,
        action_url: '/calendar-imports',
        metadata: { feedId, ...result },
      });
    }

    return result;
  };

  const acknowledgeCalendarImportConflict = async (conflictId, status = 'acknowledged') => {
    const client = requireSupabase();
    requireCalendarImportManager();
    requireAllowedValue(status, ['acknowledged', 'resolved', 'ignored'], 'calendar import conflict status');
    const conflict = asArray(data.calendarImportConflicts).find((item) => item.id === conflictId);
    if (!conflict) throw new Error('Calendar import conflict was not found in this workspace.');

    const { data: row, error } = await client
      .from('calendar_import_conflicts')
      .update({ status, resolved_by: session.user.id, resolved_at: new Date().toISOString() })
      .eq('id', conflictId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (error) throw new Error(formatSupabaseError(error, 'Calendar import conflict could not be updated.'));

    await refreshWorkspaceData();
    return normalizeCalendarImportConflict(row, data.calendarImportFeeds, data.calendarImportEvents, data.properties);
  };

  const convertImportedEventToBooking = async (importedEventId) => {
    const client = requireSupabase();
    requireCalendarImportManager();
    const importedEvent = asArray(data.calendarImportEvents).find((item) => item.id === importedEventId);
    if (!importedEvent) throw new Error('Imported calendar event was not found in this workspace.');
    if (importedEvent.importedBookingId || importedEvent.imported_booking_id) throw new Error('This imported event is already linked to a booking.');
    const selectedProperty = requireWorkspaceProperty(data.properties, importedEvent.propertyId || importedEvent.property_id);

    const checkIn = String(importedEvent.startsAt || importedEvent.starts_at || '').slice(0, 10);
    const checkOut = String(importedEvent.endsAt || importedEvent.ends_at || '').slice(0, 10);
    if (!checkIn || !checkOut || checkOut <= checkIn) throw new Error('Imported event dates are not valid for booking conversion.');

    const { data: booking, error: bookingError } = await client
      .from('bookings')
      .insert({
        workspace_id: currentWorkspace.id,
        property_id: selectedProperty.id,
        guest_name: 'Imported calendar block',
        check_in: checkIn,
        check_out: checkOut,
        guest_count: 1,
        source: 'ical',
        status: 'confirmed',
        payment_status: 'unpaid',
        currency: selectedProperty.currency || currentWorkspace.defaultCurrency || currentWorkspace.default_currency || 'USD',
        total_amount: 0,
        cleaning_fee: 0,
        taxes_fees: 0,
        owner_payout: 0,
        notes: 'Created from an imported iCal block. No payment or guest private details were imported.',
        auto_create_cleaning: false,
        created_by: session.user.id,
      })
      .select('*')
      .single();

    if (bookingError) throw new Error(formatSupabaseError(bookingError, 'Imported event could not be converted to a booking.'));

    const { error: updateError } = await client
      .from('calendar_import_events')
      .update({ imported_booking_id: booking.id })
      .eq('id', importedEventId)
      .eq('workspace_id', currentWorkspace.id);

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Imported event booking link could not be saved.'));

    await notifyWorkspaceManagers({
      event_type: 'ical_import_converted_to_booking',
      title: 'Imported iCal block converted',
      body: 'An imported calendar block was converted to an internal unpaid booking.',
      priority: 'normal',
      related_property_id: selectedProperty.id,
      related_booking_id: booking.id,
      action_url: '/bookings',
      metadata: { importedEventId },
    });

    await refreshWorkspaceData();
    return normalizeBooking(booking, data.properties);
  };




  const getPlatformAdminErrorMessage = (rpcName, rpcError) => {
    const code = String(rpcError?.code || '');
    const combined = getErrorText(rpcError);

    if (code === 'PGRST202' || code === '42883' || combined.includes('could not find the function') || combined.includes('schema cache')) {
      return `Platform admin setup required: apply the platform admin foundation migration so ${rpcName} is available.`;
    }

    if (code === '42501' || combined.includes('platform_admin_required') || combined.includes('permission denied')) {
      return 'Platform admin access denied. Only trusted PropFlow Admin profiles can load founder operations data.';
    }

    return rpcError?.message || 'Platform admin request failed.';
  };

  const callPlatformRpc = async (rpcName, params = {}) => {
    const client = requireSupabase();

    if (!canAccessPlatformAdmin(currentUser)) {
      throw new Error('Platform admin access denied.');
    }

    const { data: rpcData, error: rpcError } = await client.rpc(rpcName, params);

    if (rpcError) {
      throw new Error(getPlatformAdminErrorMessage(rpcName, rpcError));
    }

    return rpcData;
  };

  const mergePlatformAdminData = (patch) => {
    setData((previous) => ({ ...previous, ...patch }));
  };

  const loadPlatformAdminData = async () => {
    if (!supabase || !canAccessPlatformAdmin(currentUser)) {
      return { ok: false, skipped: true };
    }

    try {
      const [overview, platformWorkspaces, platformUsers, platformHealthReport] = await Promise.all([
        callPlatformRpc('get_platform_admin_overview'),
        callPlatformRpc('get_platform_workspaces'),
        callPlatformRpc('get_platform_users'),
        callPlatformRpc('get_platform_health_report'),
      ]);

      const nextOverview = overview || null;
      mergePlatformAdminData({
        platformOverview: nextOverview,
        platformWorkspaces: asArray(platformWorkspaces),
        platformUsers: asArray(platformUsers),
        platformHealthReport: platformHealthReport || null,
        platformAdminAuditLogs: asArray(nextOverview?.recent_audit_logs),
        platformAdminNotes: asArray(nextOverview?.recent_admin_notes),
        platformAdminSetupRequired: false,
        platformAdminError: '',
      });

      return { ok: true };
    } catch (adminError) {
      const message = adminError?.message || 'Platform admin data could not load.';
      mergePlatformAdminData({
        platformAdminSetupRequired: message.toLowerCase().includes('setup required'),
        platformAdminError: message,
      });
      return { ok: false, error: message };
    }
  };

  const loadPlatformWorkspaceDetail = async (workspaceId) => {
    if (!workspaceId) throw new Error('Workspace is required.');
    const detail = await callPlatformRpc('get_platform_workspace_detail', { p_workspace_id: workspaceId });
    mergePlatformAdminData({ platformWorkspaceDetail: detail || null, platformAdminError: '' });
    return detail;
  };

  const refreshPlatformHealthReport = async () => {
    const platformHealthReport = await callPlatformRpc('get_platform_health_report');
    mergePlatformAdminData({ platformHealthReport: platformHealthReport || null, platformAdminError: '' });
    return platformHealthReport;
  };

  const updatePlatformWorkspaceStatus = async (workspaceId, status, reason = '') => {
    if (!workspaceId) throw new Error('Workspace is required.');
    await callPlatformRpc('platform_admin_update_workspace_status', {
      p_workspace_id: workspaceId,
      p_status: status,
      p_reason: reason || null,
    });
    await loadPlatformAdminData();
    return loadPlatformWorkspaceDetail(workspaceId);
  };

  const updatePlatformUserStatus = async (userId, status, reason = '') => {
    if (!userId) throw new Error('User is required.');
    const result = await callPlatformRpc('platform_admin_update_user_status', {
      p_user_id: userId,
      p_status: status,
      p_reason: reason || null,
    });
    await loadPlatformAdminData();
    return result;
  };

  const createPlatformAdminNote = async (payload = {}) => {
    const note = await callPlatformRpc('platform_admin_create_note', {
      p_workspace_id: payload.workspaceId || payload.workspace_id || null,
      p_user_id: payload.userId || payload.user_id || null,
      p_subscription_id: payload.subscriptionId || payload.subscription_id || null,
      p_note_type: payload.noteType || payload.note_type || 'general',
      p_severity: payload.severity || 'info',
      p_title: payload.title || '',
      p_body: payload.body || null,
    });
    await loadPlatformAdminData();
    if (payload.workspaceId || payload.workspace_id) {
      await loadPlatformWorkspaceDetail(payload.workspaceId || payload.workspace_id);
    }
    return note;
  };

  const getBillingAccessState = () => getWorkspaceBillingGate(currentWorkspace, data.subscription, currentUser);

  const requireBillingRole = (allowedRoles, message) => {
    requireWorkspaceSession(currentWorkspace, session);
    if (!userHasAnyWorkspaceRole(currentUser, memberships, currentWorkspace, allowedRoles)) {
      throw new Error(message);
    }
  };

  const writeBillingEvent = async (eventType, message, metadata = {}) => {
    try {
      const client = requireSupabase();
      requireWorkspaceSession(currentWorkspace, session);
      requireAllowedValue(eventType, billingEventTypes, 'billing event type');
      const safeMetadata = metadata && typeof metadata === 'object'
        ? Object.fromEntries(Object.entries(metadata).filter(([key]) => !/secret|token|api.?key|service.?role/i.test(key)))
        : {};

      const { error: insertError } = await client.from('billing_events').insert({
        workspace_id: currentWorkspace.id,
        subscription_id: data.subscription?.id || null,
        actor_user_id: session.user.id,
        event_type: eventType,
        provider: 'stripe',
        status: 'recorded',
        message,
        metadata: safeMetadata,
      });

      if (insertError) console.warn('[PropFlow] Billing event insert skipped', insertError);
    } catch (eventError) {
      console.warn('[PropFlow] Billing event hook skipped', eventError);
    }
  };

  const notifyBillingRoles = async (payload) => {
    const billingRecipients = getActiveWorkspaceMembers(data.members, currentWorkspace?.id)
      .filter((member) => asArray(member.roles).some((role) => [roles.OWNER_ADMIN, roles.ACCOUNTANT].includes(role)));

    await Promise.all(
      billingRecipients
        .map(memberUserId)
        .filter(Boolean)
        .filter((userId, index, list) => list.indexOf(userId) === index)
        .map((recipientUserId) => safeCreateNotification({ ...payload, recipient_user_id: recipientUserId })),
    );
  };

  const ensureWorkspaceSubscription = async (preferredPlan = 'starter') => {
    const client = requireSupabase();
    requireBillingRole(billingManageRoles, 'Only Workspace Owners can initialize workspace billing.');

    if (data.subscription?.id) return data.subscription;

    const plan = String(preferredPlan || currentWorkspace?.selected_plan || currentWorkspace?.plan || 'starter').toLowerCase();
    requireAllowedValue(plan, billingPlans.map(([value]) => value), 'billing plan');

    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const { data: row, error: insertError } = await client
      .from('workspace_subscriptions')
      .insert({
        workspace_id: currentWorkspace.id,
        plan,
        status: 'trialing',
        billing_provider: 'stripe',
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        metadata: { initialized_from: 'frontend_trial_setup' },
        created_by: session.user.id,
      })
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Trial subscription could not be initialized. Apply the billing migration and try again.'));

    await writeBillingEvent('trial_started', '14-day workspace billing trial initialized.', { plan });
    await notifyBillingRoles({
      event_type: 'billing_trial_ending',
      title: 'Workspace trial initialized',
      body: 'A 14-day PropFlow trial subscription record was created for this workspace.',
      priority: 'normal',
      action_url: '/billing',
      channels: ['in_app'],
    });
    await refreshWorkspaceData();

    return normalizeSubscription(row);
  };

  const callBillingEndpoint = async (url, payload) => {
    if (!session?.access_token) throw new Error('Your session expired. Sign in again before managing billing.');

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Stripe billing is not configured yet.');
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.code === 'provider_not_configured') {
      throw new Error(body?.message || 'Stripe billing is not configured yet.');
    }

    return body;
  };

  const startCheckout = async (plan) => {
    requireBillingRole(billingManageRoles, 'Only Workspace Owners can change billing plans.');
    const normalizedPlan = String(plan || '').toLowerCase();
    requireAllowedValue(normalizedPlan, billingPlans.map(([value]) => value), 'billing plan');

    await writeBillingEvent('checkout_started', 'Checkout requested from Billing page.', { plan: normalizedPlan });

    try {
      const result = await callBillingEndpoint('/api/create-stripe-checkout-session', { workspaceId: currentWorkspace.id, plan: normalizedPlan });
      if (result?.url) {
        window.location.assign(result.url);
        return result;
      }
      throw new Error('Stripe checkout is not configured yet.');
    } catch (checkoutError) {
      await writeBillingEvent('provider_not_configured', 'Stripe checkout is not configured yet.', { action: 'checkout', plan: normalizedPlan });
      await notifyBillingRoles({
        event_type: 'billing_provider_not_configured',
        title: 'Stripe checkout not configured',
        body: 'Checkout was requested, but the secure Stripe backend endpoint is not configured yet.',
        priority: 'normal',
        action_url: '/billing',
        channels: ['in_app'],
      });
      await refreshWorkspaceData();
      throw checkoutError;
    }
  };

  const openBillingPortal = async (action = 'manage_billing') => {
    requireBillingRole([roles.OWNER_ADMIN], 'Only Workspace Owners can manage Stripe billing.');

    try {
      const result = await callBillingEndpoint('/api/create-stripe-customer-portal-session', {
        workspaceId: currentWorkspace.id,
        returnUrl: `${window.location.origin}/settings?tab=billing`,
        action,
      });
      if (result?.url) {
        window.location.assign(result.url);
        return result;
      }
      throw new Error('Stripe billing is not configured yet.');
    } catch (portalError) {
      await refreshWorkspaceData();
      throw portalError;
    }
  };

  const refreshBillingStatus = async () => {
    const result = await refreshWorkspaceData();
    if (!data.billingTablesReady) {
      await writeBillingEvent('provider_not_configured', 'Billing tables or Stripe provider configuration are not ready.', { action: 'refresh' });
    }
    return result;
  };

  const markNotificationRead = async (notificationId, read = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const status = read ? 'read' : 'unread';
    requireAllowedValue(status, notificationStatusValues, 'notification status');

    const { data: row, error: updateError } = await client
      .from('notifications')
      .update({ status, read_at: read ? new Date().toISOString() : null })
      .eq('id', notificationId)
      .eq('workspace_id', currentWorkspace.id)
      .eq('recipient_user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Notification could not be updated.'));
    }

    if (read) {
      await writeActivityLog('notification_marked_read', { notification_id: row.id, event_type: row.event_type || row.type, status: row.status });
    }
    await refreshWorkspaceData();

    return normalizeNotification(row);
  };

  const archiveNotification = async (notificationId, archived = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const { data: row, error: updateError } = await client
      .from('notifications')
      .update({
        status: archived ? 'archived' : 'unread',
        archived_at: archived ? new Date().toISOString() : null,
        read_at: archived ? new Date().toISOString() : null,
      })
      .eq('id', notificationId)
      .eq('workspace_id', currentWorkspace.id)
      .eq('recipient_user_id', session.user.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Notification archive status could not be updated.'));
    }

    if (archived) {
      await writeActivityLog('notification_archived', { notification_id: row.id, event_type: row.event_type || row.type, status: row.status });
    }
    await refreshWorkspaceData();

    return normalizeNotification(row);
  };


  const markAllNotificationsRead = async () => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const { error: updateError } = await client
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('workspace_id', currentWorkspace.id)
      .eq('recipient_user_id', session.user.id)
      .eq('status', 'unread')
      .is('archived_at', null);

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Notifications could not be marked as read.'));
    }

    await writeActivityLog('notification_marked_read', { bulk: true });
    await refreshWorkspaceData();

    return true;
  };

  const updateNotificationPreference = async (eventGroup, channels = {}) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    requireAllowedValue(eventGroup, notificationPreferenceGroupValues, 'notification preference group');

    const preferencePayload = {
      workspace_id: currentWorkspace.id,
      user_id: session.user.id,
      event_group: eventGroup,
      in_app_enabled: channels.in_app_enabled ?? channels.inAppEnabled ?? channels.in_app ?? channels.inApp ?? true,
      email_enabled: Boolean(channels.email_enabled ?? channels.emailEnabled ?? channels.email),
      sms_enabled: Boolean(channels.sms_enabled ?? channels.smsEnabled ?? channels.sms),
      whatsapp_enabled: Boolean(channels.whatsapp_enabled ?? channels.whatsappEnabled ?? channels.whatsapp),
    };

    const { data: row, error: upsertError } = await client
      .from('notification_preferences')
      .upsert(preferencePayload, { onConflict: 'workspace_id,user_id,event_group' })
      .select('*')
      .single();

    if (upsertError) {
      throw new Error(formatSupabaseError(upsertError, 'Notification preference could not be saved.'));
    }

    await refreshWorkspaceData();

    return normalizeNotificationPreference(row);
  };

  const updateNotificationProviderSetting = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    requireProviderManagerRole();

    const hasBlockedSecretKey = Object.keys(payload || {}).some((key) => blockedProviderSettingKeys.includes(key) || /secret|token|api.?key|service.?role/i.test(key));
    if (hasBlockedSecretKey) throw new Error('Provider secrets must stay server-side and cannot be saved in PropFlow frontend settings.');

    const provider = cleanText(payload.provider);
    const channel = cleanText(payload.channel);
    const allowedProviders = channel === 'email' ? ['resend'] : ['twilio'];

    requireAllowedValue(channel, externalNotificationChannels, 'provider channel');
    requireAllowedValue(provider, allowedProviders, 'provider');

    const settingPayload = {
      workspace_id: currentWorkspace.id,
      provider,
      channel,
      enabled: Boolean(payload.enabled),
      configured: Boolean(payload.configured),
      from_name: cleanText(payload.from_name || payload.fromName),
      from_email: cleanEmail(payload.from_email || payload.fromEmail),
      reply_to: cleanEmail(payload.reply_to || payload.replyTo),
      sender_phone_label: cleanText(payload.sender_phone_label || payload.senderPhoneLabel),
      notes: cleanText(payload.notes),
    };

    const { data: row, error: upsertError } = await client
      .from('notification_provider_settings')
      .upsert(settingPayload, { onConflict: 'workspace_id,provider,channel' })
      .select('*')
      .single();

    if (upsertError) throw new Error(formatSupabaseError(upsertError, 'Notification provider setting could not be saved.'));

    await refreshWorkspaceData();

    return normalizeNotificationProviderSetting(row);
  };


  const contextValue = useMemo(
    () => ({
      isSupabaseConfigured,
      session,
      authLoading,
      loading: authLoading,
      currentUser,
      memberships,
      workspaces,
      currentWorkspace,
      data,
      dataLoading,
      dataWarnings,
      error,
      loadAccount,
      refreshWorkspaceData,
      setCurrentWorkspace,
      signIn,
      signUp,
      signOut,
      createWorkspace,
      joinWorkspace,
      createProperty,
      updateProperty,
      archiveProperty,
      createBooking,
      updateBooking,
      createOrUpdateDirectBookingPage,
      archiveDirectBookingPage,
      reviewDirectBookingRequest,
      convertDirectBookingRequestToBooking,
      createCalendarImportFeed,
      updateCalendarImportFeed,
      archiveCalendarImportFeed,
      syncCalendarImportFeed,
      acknowledgeCalendarImportConflict,
      convertImportedEventToBooking,
      createLease,
      updateLease,
      archiveLease,
      linkLeaseDocument,
      createCleaningTask,
      updateCleaningTask,
      createMaintenanceWorkOrder,
      updateMaintenanceWorkOrder,
      createContact,
      createOwner,
      createGuest,
      createInvite,
      createWorkspaceInvite,
      inviteTeamMember,
      updateWorkspaceMemberStatus,
      revokeWorkspaceInvite,
      createPropertyAssignment,
      removePropertyAssignment,
      createSupply,
      updateSupply,
      archiveSupply,
      createReport,
      createOwnerReport,
      createExpense,
      updateExpense,
      archiveExpense,
      createWorkspaceExpense,
      uploadWorkspaceFile,
      getFileSignedUrl,
      archiveFileUpload,
      createNotification,
      createInAppNotification: safeCreateNotification,
      listNotifications: () => asArray(data.notifications).filter((notification) => !currentWorkspace?.id || notification.workspace_id === currentWorkspace.id || notification.workspaceId === currentWorkspace.id),
      getUnreadNotificationCount: () => asArray(data.notifications).filter((notification) => notification.status === 'unread' && !notification.read_at && !notification.readAt && !notification.archived_at && !notification.archivedAt && (notification.recipient_user_id || notification.recipientUserId) === session?.user?.id).length,
      markNotificationRead,
      archiveNotification,
      markAllNotificationsRead,
      updateNotificationPreference,
      updateNotificationProviderSetting,
      ensureWorkspaceSubscription,
      startCheckout,
      openBillingPortal,
      refreshBillingStatus,
      getBillingAccessState,
      loadPlatformAdminData,
      loadPlatformWorkspaceDetail,
      updatePlatformWorkspaceStatus,
      updatePlatformUserStatus,
      createPlatformAdminNote,
      refreshPlatformHealthReport,
    }),
    [
      session,
      authLoading,
      currentUser,
      memberships,
      workspaces,
      currentWorkspace,
      data,
      dataLoading,
      dataWarnings,
      error,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used inside AppProvider.');
  }

  return context;
}
