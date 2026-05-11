import { buildEmailTemplate, isApprovedTemplateKey } from './emailTemplates.js';
import { buildProviderNotConfiguredResult, sendResendEmail } from './resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_STATUSES = new Set(['queued', 'skipped', 'provider_not_configured', 'sent', 'failed']);

export function isValidRecipientEmail(email) {
  return EMAIL_RE.test(String(email || '').trim().toLowerCase());
}

function safeMetadata(metadata = {}) {
  const allowed = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (!/^[a-z0-9_]{1,60}$/i.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) allowed[key] = String(value).slice(0, 300);
  }
  return allowed;
}

function buildDeliveryPayload({ workspaceId, notificationId, recipientUserId, recipientEmail, templateKey, subject, status = 'queued', metadata = {}, idempotencyKey }) {
  return {
    workspace_id: workspaceId || null,
    notification_id: notificationId || null,
    recipient_user_id: recipientUserId || null,
    recipient_address: recipientEmail,
    recipient_email: recipientEmail,
    channel: 'email',
    provider: 'resend',
    template_key: templateKey,
    subject,
    status: SAFE_STATUSES.has(status) ? status : 'queued',
    metadata: safeMetadata({ ...metadata, idempotency_key: idempotencyKey }),
  };
}

async function hasDuplicateDelivery(supabaseAdmin, { workspaceId, templateKey, recipientEmail, idempotencyKey }) {
  if (!idempotencyKey) return false;
  const { data, error } = await supabaseAdmin
    .from('notification_delivery_logs')
    .select('id,status')
    .eq('workspace_id', workspaceId)
    .eq('channel', 'email')
    .eq('provider', 'resend')
    .eq('template_key', templateKey)
    .eq('recipient_address', recipientEmail)
    .eq('metadata->>idempotency_key', idempotencyKey)
    .in('status', ['queued', 'provider_not_configured', 'sent'])
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
}

async function insertDeliveryLog(supabaseAdmin, payload) {
  const { data, error } = await supabaseAdmin
    .from('notification_delivery_logs')
    .insert(payload)
    .select('id,status')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateDeliveryLog(supabaseAdmin, id, patch) {
  if (!id) return;
  await supabaseAdmin
    .from('notification_delivery_logs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function sendTransactionalEmail({
  supabaseAdmin,
  workspaceId,
  notificationId = null,
  recipientUserId = null,
  recipientEmail,
  templateKey,
  context = {},
  metadata = {},
  idempotencyKey = null,
  replyTo = null,
} = {}) {
  if (!supabaseAdmin) return { ok: false, status: 'failed', message: 'Email could not be sent, but the main action completed.' };
  if (!isApprovedTemplateKey(templateKey)) return { ok: false, status: 'skipped', message: 'Email could not be sent, but the main action completed.' };

  const email = String(recipientEmail || '').trim().toLowerCase();
  if (!isValidRecipientEmail(email)) {
    const template = buildEmailTemplate(templateKey, context);
    await insertDeliveryLog(supabaseAdmin, buildDeliveryPayload({
      workspaceId,
      notificationId,
      recipientUserId,
      recipientEmail: 'missing-recipient@example.invalid',
      templateKey,
      subject: template.subject,
      status: 'skipped',
      metadata: { ...metadata, skipped_reason: 'missing_recipient_email' },
      idempotencyKey,
    })).catch(() => null);
    return { ok: true, status: 'skipped', message: 'Recipient email is missing.' };
  }

  const template = buildEmailTemplate(templateKey, { ...context, appUrl: context.appUrl || process.env.APP_URL || process.env.VITE_APP_URL });

  if (await hasDuplicateDelivery(supabaseAdmin, { workspaceId, templateKey, recipientEmail: email, idempotencyKey })) {
    return { ok: true, status: 'skipped', duplicate: true, message: 'Email queued.' };
  }

  const delivery = await insertDeliveryLog(supabaseAdmin, buildDeliveryPayload({
    workspaceId,
    notificationId,
    recipientUserId,
    recipientEmail: email,
    templateKey,
    subject: template.subject,
    status: 'queued',
    metadata,
    idempotencyKey,
  }));

  const result = await sendResendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo,
    tags: [
      { name: 'template', value: templateKey },
      { name: 'workspace_id', value: workspaceId || 'platform' },
    ],
  });

  if (result.status === 'provider_not_configured') {
    const providerResult = buildProviderNotConfiguredResult();
    await updateDeliveryLog(supabaseAdmin, delivery?.id, {
      status: 'provider_not_configured',
      error_message: providerResult.message,
      provider_error_code: 'provider_not_configured',
      provider_error_message: providerResult.message,
      attempted_at: new Date().toISOString(),
    });
    return providerResult;
  }

  if (result.ok) {
    await updateDeliveryLog(supabaseAdmin, delivery?.id, {
      status: 'sent',
      provider_message_id: result.providerMessageId,
      attempted_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });
    return { ok: true, status: 'sent', message: 'Email sent.' };
  }

  await updateDeliveryLog(supabaseAdmin, delivery?.id, {
    status: 'failed',
    error_message: result.message,
    provider_error_code: result.code || 'send_failed',
    provider_error_message: result.providerErrorMessage || result.message,
    attempted_at: new Date().toISOString(),
    failed_at: new Date().toISOString(),
  });
  return { ok: false, status: 'failed', message: 'Email could not be sent, but the main action completed.' };
}
