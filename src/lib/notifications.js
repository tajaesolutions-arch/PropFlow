import { isSupabaseConfigured, supabase } from './supabase.js';

const NOTIFICATION_FIELDS = ['event_type','title','body','message','channel','status','priority','recipient_user_id','recipient_role','entity_type','entity_id','related_property_id','related_booking_id','related_cleaning_task_id','related_maintenance_work_order_id','related_expense_id','related_report_id','related_file_upload_id','related_invite_id','action_url','metadata','archived_at'];
const STATUS_VALUES = new Set(['unread','read','archived','sent','failed','pending']);
const PRIORITY_VALUES = new Set(['low','normal','high','urgent']);
const EVENT_TYPE_VALUES = new Set(['booking_created','booking_reminder','cleaning_task_assigned','cleaning_task_due','cleaning_completed','maintenance_issue_reported','maintenance_assigned','maintenance_completed','owner_report_ready','supply_low','payment_failed','invite_sent','team_member_joined','file_uploaded']);

const asText = (v) => { const t = String(v ?? '').trim(); return t || null; };
const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function requireWorkspaceId(workspaceId) {
  const id = asText(workspaceId);
  if (!id) return { ok: false, result: { data: [], error: 'Select an active workspace before loading notifications.', code: 'missing_workspace_id' } };
  return { ok: true, workspaceId: id };
}

function notConfiguredResult(data = []) {
  return { data, error: null, code: 'supabase_not_configured', notConfigured: true, unreadCount: 0 };
}

function normalizeEnum(value, allowed, fallback) {
  const raw = asText(value)?.toLowerCase();
  if (!raw) return fallback;
  return allowed.has(raw) ? raw : fallback;
}

export function normalizeNotification(row = null) {
  if (!row) return null;
  const eventType = normalizeEnum(row.event_type ?? row.eventType ?? row.type, EVENT_TYPE_VALUES, 'booking_created');
  const status = normalizeEnum(row.status, STATUS_VALUES, row.read_at || row.readAt ? 'read' : 'unread');
  const priority = normalizeEnum(row.priority, PRIORITY_VALUES, 'normal');
  const normalized = {
    ...row,
    workspace_id: row.workspace_id ?? row.workspaceId,
    recipient_user_id: row.recipient_user_id ?? row.recipientUserId ?? null,
    event_type: eventType,
    status,
    priority,
    title: asText(row.title) || 'Workspace notification',
    message: asText(row.message) || asText(row.body) || 'Workspace notification',
    body: asText(row.body) || asText(row.message) || null,
    channel: asText(row.channel) || 'in_app',
    entity_type: asText(row.entity_type ?? row.entityType),
    entity_id: asText(row.entity_id ?? row.entityId),
    metadata: asObject(row.metadata),
    created_at: row.created_at ?? row.createdAt ?? null,
  };
  return { ...normalized, workspaceId: normalized.workspace_id, recipientUserId: normalized.recipient_user_id, eventType: normalized.event_type, createdAt: normalized.created_at, readAt: normalized.read_at ?? row.readAt ?? null, archivedAt: normalized.archived_at ?? row.archivedAt ?? null };
}

export function normalizeNotificationPreference(row = null) { if (!row) return null; return { ...row, workspaceId: row.workspace_id, userId: row.user_id, eventGroup: row.event_group, inAppEnabled: row.in_app_enabled, emailEnabled: row.email_enabled, smsEnabled: row.sms_enabled, whatsappEnabled: row.whatsapp_enabled }; }
export function normalizeNotificationDeliveryLog(row = null) { if (!row) return null; return { ...row, workspaceId: row.workspace_id, notificationId: row.notification_id, recipientUserId: row.recipient_user_id, createdAt: row.created_at }; }

export function buildNotificationPayload(values = {}) {
  const payload = {};
  for (const key of NOTIFICATION_FIELDS) if (Object.prototype.hasOwnProperty.call(values, key)) payload[key] = values[key];
  if ('eventType' in values && !('event_type' in payload)) payload.event_type = values.eventType;
  if ('recipientUserId' in values && !('recipient_user_id' in payload)) payload.recipient_user_id = values.recipientUserId;
  if ('entityType' in values && !('entity_type' in payload)) payload.entity_type = values.entityType;
  if ('entityId' in values && !('entity_id' in payload)) payload.entity_id = values.entityId;
  payload.title = asText(payload.title);
  payload.body = asText(payload.body);
  payload.message = asText(payload.message) || payload.body;
  payload.channel = asText(payload.channel) || 'in_app';
  payload.event_type = normalizeEnum(payload.event_type, EVENT_TYPE_VALUES, 'booking_created');
  payload.status = normalizeEnum(payload.status, STATUS_VALUES, 'unread');
  payload.priority = normalizeEnum(payload.priority, PRIORITY_VALUES, 'normal');
  payload.recipient_user_id = asText(payload.recipient_user_id);
  payload.entity_type = asText(payload.entity_type);
  payload.entity_id = asText(payload.entity_id);
  payload.metadata = asObject(payload.metadata);
  Object.keys(payload).forEach((k)=>{ if (payload[k] === '') payload[k] = null; });
  return payload;
}

export async function listNotifications({ workspaceId, userId, filters = {} } = {}) { const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result; if (!isSupabaseConfigured || !supabase) return notConfiguredResult([]); let q = supabase.from('notifications').select('*').eq('workspace_id', w.workspaceId).order('created_at',{ascending:false}); if (asText(userId)) q = q.or(`recipient_user_id.eq.${asText(userId)},recipient_user_id.is.null`); if (filters.status) q = q.eq('status', filters.status); if (filters.limit) q = q.limit(Number(filters.limit)); const {data,error}= await q; if (error) return {data:[],error:error.message,code:error.code||'notifications_load_failed'}; const rows=(data||[]).map(normalizeNotification); return {data:rows,error:null,code:'ok',unreadCount:rows.filter((n)=>n.status==='unread'&&!n.readAt&&!n.archivedAt).length}; }
export async function getNotificationById({ workspaceId, notificationId } = {}) { const w = requireWorkspaceId(workspaceId); if (!w.ok) return {...w.result,data:null}; const id = asText(notificationId); if(!id) return {data:null,error:'Select a notification first.',code:'missing_notification_id'}; if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null); const {data,error}=await supabase.from('notifications').select('*').eq('workspace_id',w.workspaceId).eq('id',id).single(); if(error) return {data:null,error:error.message,code:error.code||'notification_load_failed'}; return {data:normalizeNotification(data),error:null,code:'ok'}; }
export async function createNotification({ workspaceId, userId, values } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return {...w.result,data:null}; if(!isSupabaseConfigured||!supabase) return notConfiguredResult(null); const payload=buildNotificationPayload({ ...values, recipient_user_id: values?.recipient_user_id ?? userId ?? values?.recipientUserId }); const {data,error}=await supabase.from('notifications').insert({ ...payload, workspace_id:w.workspaceId }).select('*').single(); if(error) return {data:null,error:error.message,code:error.code||'notification_create_failed'}; return {data:normalizeNotification(data),error:null,code:'ok'}; }
export async function markNotificationRead({ workspaceId, notificationId, userId } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return {...w.result,data:null}; const id=asText(notificationId); const uid=asText(userId); if(!id||!uid) return {data:null,error:'Notification and recipient are required.',code:'missing_notification_identifiers'}; if(!isSupabaseConfigured||!supabase) return notConfiguredResult(null); const {data,error}=await supabase.from('notifications').update({status:'read',read_at:new Date().toISOString()}).eq('workspace_id',w.workspaceId).eq('id',id).eq('recipient_user_id',uid).select('*').single(); if(error) return {data:null,error:error.message,code:error.code||'notification_update_failed'}; return {data:normalizeNotification(data),error:null,code:'ok'}; }
export async function markAllNotificationsRead({ workspaceId, userId } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return {...w.result,data:null}; const uid=asText(userId); if(!uid) return {data:null,error:'Recipient user is required.',code:'missing_user_id'}; if(!isSupabaseConfigured||!supabase) return notConfiguredResult(true); const {error}=await supabase.from('notifications').update({status:'read',read_at:new Date().toISOString()}).eq('workspace_id',w.workspaceId).eq('recipient_user_id',uid).eq('status','unread').is('archived_at',null); if(error) return {data:null,error:error.message,code:error.code||'notification_bulk_update_failed'}; return {data:true,error:null,code:'ok'}; }
export async function archiveNotification({ workspaceId, notificationId, userId } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return {...w.result,data:null}; const id=asText(notificationId); const uid=asText(userId); if(!id||!uid) return {data:null,error:'Notification and recipient are required.',code:'missing_notification_identifiers'}; if(!isSupabaseConfigured||!supabase) return notConfiguredResult(null); const now=new Date().toISOString(); const {data,error}=await supabase.from('notifications').update({status:'archived',archived_at:now,read_at:now}).eq('workspace_id',w.workspaceId).eq('id',id).eq('recipient_user_id',uid).select('*').single(); if(error) return {data:null,error:error.message,code:error.code||'notification_archive_failed'}; return {data:normalizeNotification(data),error:null,code:'ok'}; }
export async function listNotificationPreferences({ workspaceId, userId } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return w.result; if(!isSupabaseConfigured||!supabase) return notConfiguredResult([]); let q=supabase.from('notification_preferences').select('*').eq('workspace_id',w.workspaceId).order('event_group',{ascending:true}); if(asText(userId)) q=q.eq('user_id',asText(userId)); const {data,error}=await q; if(error) return {data:[],error:error.message,code:error.code||'notification_preferences_load_failed'}; return {data:(data||[]).map(normalizeNotificationPreference),error:null,code:'ok'}; }
export async function updateNotificationPreferences({ workspaceId, userId, values } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return {...w.result,data:null}; const uid=asText(userId); if(!uid) return {data:null,error:'Recipient user is required.',code:'missing_user_id'}; if(!isSupabaseConfigured||!supabase) return notConfiguredResult(null); const payload={ workspace_id:w.workspaceId, user_id:uid, event_group:asText(values?.event_group??values?.eventGroup) || 'workspace_activity', in_app_enabled:Boolean(values?.in_app_enabled ?? values?.inAppEnabled ?? true), email_enabled:Boolean(values?.email_enabled ?? values?.emailEnabled), sms_enabled:Boolean(values?.sms_enabled ?? values?.smsEnabled), whatsapp_enabled:Boolean(values?.whatsapp_enabled ?? values?.whatsappEnabled)}; const {data,error}=await supabase.from('notification_preferences').upsert(payload,{onConflict:'workspace_id,user_id,event_group'}).select('*').single(); if(error) return {data:null,error:error.message,code:error.code||'notification_preferences_update_failed'}; return {data:normalizeNotificationPreference(data),error:null,code:'ok'}; }
export async function listNotificationDeliveryLogs({ workspaceId, notificationId } = {}) { const w=requireWorkspaceId(workspaceId); if(!w.ok) return w.result; if(!isSupabaseConfigured||!supabase) return notConfiguredResult([]); let q=supabase.from('notification_delivery_logs').select('*').eq('workspace_id',w.workspaceId).order('created_at',{ascending:false}); if(asText(notificationId)) q=q.eq('notification_id',asText(notificationId)); const {data,error}=await q.limit(50); if(error) return {data:[],error:error.message,code:error.code||'notification_logs_load_failed'}; return {data:(data||[]).map(normalizeNotificationDeliveryLog),error:null,code:'ok'}; }
