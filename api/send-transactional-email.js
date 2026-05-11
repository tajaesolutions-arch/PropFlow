import { json, readJsonBody, requireJsonContentType, requireMethod } from './_utils/http.js';
import { approvedTemplateKeys } from './_utils/emailTemplates.js';
import { getAuthenticatedUser, getSupabaseAdminClient } from './_utils/supabaseAdmin.js';
import { sendTransactionalEmail } from './_utils/transactionalEmail.js';

const MANAGER_ROLES = ['workspace_owner', 'property_manager', 'host'];
const OWNER_ROLES = ['workspace_owner'];
const TEMPLATE_KEYS = new Set(approvedTemplateKeys());

function bearerToken(request) {
  const header = String(request.headers.authorization || request.headers.Authorization || '');
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function clean(value, max = 500) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function hasAnyRole(member, allowedRoles) {
  const roles = Array.isArray(member?.roles) ? member.roles : [];
  return member?.status === 'active' && roles.some((role) => allowedRoles.includes(role));
}

async function getMembership(supabaseAdmin, workspaceId, userId) {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, user_id, roles, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function profileForUser(supabaseAdmin, userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email').eq('id', userId).maybeSingle();
  return data || null;
}

function roleLabel(roles = []) {
  return roles.map((role) => role.replace(/_/g, ' ')).join(', ');
}

function checklistSummary(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  return list.map((item) => clean(item?.label || item?.name || item, 80)).filter(Boolean).slice(0, 3).join(', ');
}

async function workspaceManagers(supabaseAdmin, workspaceId) {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, roles, status, profiles:profiles!workspace_members_user_id_fkey(full_name, email)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;
  return (data || []).filter((member) => hasAnyRole(member, MANAGER_ROLES));
}

async function buildEmailRequest(supabaseAdmin, { templateKey, workspaceId, entityId, actor }) {
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (templateKey === 'team_invite') {
    const { data: invite, error } = await supabaseAdmin
      .from('workspace_invites')
      .select('*, workspaces:workspaces!workspace_invites_workspace_id_fkey(name, company_code)')
      .eq('id', entityId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return null;
    const inviter = await profileForUser(supabaseAdmin, invite.invited_by || actor.id);
    return {
      recipientEmail: invite.email,
      recipientUserId: null,
      context: {
        appUrl,
        workspaceName: invite.workspaces?.name,
        workspaceCode: invite.workspace_code || invite.workspaces?.company_code,
        inviterName: inviter?.full_name || inviter?.email || 'A workspace admin',
        roleLabel: roleLabel(invite.roles),
        invitePath: `/login/redirect?invite=${encodeURIComponent(invite.token || '')}`,
      },
      metadata: { entity_type: 'workspace_invite', entity_id: invite.id },
      idempotencyKey: `team_invite:${invite.id}`,
    };
  }

  if (templateKey === 'cleaning_task_assigned') {
    const { data: task, error } = await supabaseAdmin
      .from('cleaning_tasks')
      .select('id, workspace_id, property_id, assigned_cleaner_id, scheduled_for, checklist_items, properties:properties!cleaning_tasks_property_id_fkey(name)')
      .eq('id', entityId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!task?.assigned_cleaner_id) return null;
    const recipient = await profileForUser(supabaseAdmin, task.assigned_cleaner_id);
    return {
      recipientEmail: recipient?.email,
      recipientUserId: task.assigned_cleaner_id,
      context: { appUrl, propertyName: task.properties?.name, scheduledFor: task.scheduled_for, checklistSummary: checklistSummary(task.checklist_items) },
      metadata: { entity_type: 'cleaning_task', entity_id: task.id, property_id: task.property_id },
      idempotencyKey: `cleaning_task_assigned:${task.id}:${task.assigned_cleaner_id}`,
    };
  }

  if (templateKey === 'maintenance_work_order_assigned') {
    const { data: order, error } = await supabaseAdmin
      .from('maintenance_work_orders')
      .select('id, workspace_id, property_id, assigned_maintenance_id, title, priority, due_date, properties:properties!maintenance_work_orders_property_id_fkey(name)')
      .eq('id', entityId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!order?.assigned_maintenance_id) return null;
    const recipient = await profileForUser(supabaseAdmin, order.assigned_maintenance_id);
    return {
      recipientEmail: recipient?.email,
      recipientUserId: order.assigned_maintenance_id,
      context: { appUrl, propertyName: order.properties?.name, issueTitle: order.title, priority: order.priority, dueDate: order.due_date },
      metadata: { entity_type: 'maintenance_work_order', entity_id: order.id, property_id: order.property_id },
      idempotencyKey: `maintenance_assigned:${order.id}:${order.assigned_maintenance_id}`,
    };
  }

  if (templateKey === 'owner_report_ready') {
    const { data: report, error } = await supabaseAdmin
      .from('owner_reports')
      .select('id, workspace_id, property_id, owner_id, contact_id, title, start_date, end_date, status, properties:properties!owner_reports_property_id_fkey(name)')
      .eq('id', entityId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!report || !['ready', 'released', 'published'].includes(report.status)) return null;
    const recipient = await profileForUser(supabaseAdmin, report.owner_id);
    return {
      recipientEmail: recipient?.email,
      recipientUserId: report.owner_id,
      context: { appUrl, reportTitle: report.title, propertyName: report.properties?.name, startDate: report.start_date, endDate: report.end_date },
      metadata: { entity_type: 'owner_report', entity_id: report.id, property_id: report.property_id },
      idempotencyKey: `owner_report_ready:${report.id}:${report.owner_id || 'role'}`,
    };
  }

  return null;
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  if (!requireJsonContentType(request, response)) return;

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return json(request, response, 501, { code: 'provider_not_configured', message: 'Email provider is not configured yet.' });

  try {
    const user = await getAuthenticatedUser(supabaseAdmin, bearerToken(request));
    if (!user?.id) return json(request, response, 401, { code: 'unauthorized', message: 'Sign in before sending transactional email.' });

    const body = await readJsonBody(request);
    const templateKey = clean(body.template_key || body.templateKey, 120);
    const workspaceId = clean(body.workspace_id || body.workspaceId, 80);
    const entityId = clean(body.entity_id || body.entityId, 80);

    if (!TEMPLATE_KEYS.has(templateKey)) return json(request, response, 400, { code: 'unsupported_template', message: 'Email could not be sent, but the main action completed.' });
    if (!workspaceId || !entityId) return json(request, response, 400, { code: 'invalid_request', message: 'Email could not be sent, but the main action completed.' });

    const membership = await getMembership(supabaseAdmin, workspaceId, user.id);
    const ownerOnly = ['billing_payment_failed', 'subscription_billing_warning'].includes(templateKey);
    if (!hasAnyRole(membership, ownerOnly ? OWNER_ROLES : MANAGER_ROLES)) {
      return json(request, response, 403, { code: 'forbidden', message: 'Your workspace role cannot send this transactional email.' });
    }

    const emailRequest = await buildEmailRequest(supabaseAdmin, { templateKey, workspaceId, entityId, actor: user });
    if (!emailRequest) return json(request, response, 200, { ok: true, status: 'skipped', message: 'Email queued.' });
    const result = await sendTransactionalEmail({ supabaseAdmin, workspaceId, templateKey, ...emailRequest });
    return json(request, response, 200, { ok: true, status: result.status, message: result.message || 'Email queued.' });
  } catch {
    return json(request, response, 200, { ok: true, status: 'failed', message: 'Email could not be sent, but the main action completed.' });
  }
}
