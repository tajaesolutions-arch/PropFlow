import { getServerEnv } from './env.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const NON_PRODUCTION_VALUES = new Set(['development', 'test', 'preview', 'demo', 'local']);

function cleanEnv(value) {
  return String(value || '').trim();
}

function isNonProductionRuntime() {
  const nodeEnv = cleanEnv(process.env.NODE_ENV).toLowerCase();
  const vercelEnv = cleanEnv(process.env.VERCEL_ENV).toLowerCase();
  const appMode = cleanEnv(process.env.APP_MODE || process.env.VITE_APP_MODE).toLowerCase();
  const appUrl = cleanEnv(process.env.APP_URL || process.env.VITE_APP_URL).toLowerCase();
  const isLocalUrl = appUrl.includes('localhost') || appUrl.includes('127.0.0.1') || appUrl.includes('.local');
  const isVercelProduction = vercelEnv === 'production';
  return isLocalUrl || (!isVercelProduction && [nodeEnv, vercelEnv, appMode].some((value) => NON_PRODUCTION_VALUES.has(value)));
}

export function isResendConfigured() {
  const apiKey = getServerEnv('RESEND_API_KEY');
  const fromEmail = getServerEnv('RESEND_FROM_EMAIL');
  const allowNonProductionSends = cleanEnv(process.env.RESEND_ALLOW_NON_PRODUCTION_SENDS).toLowerCase() === 'true';

  return Boolean(apiKey && fromEmail && (!isNonProductionRuntime() || allowNonProductionSends));
}

export function buildProviderNotConfiguredResult() {
  return {
    ok: true,
    status: 'provider_not_configured',
    code: 'provider_not_configured',
    message: 'Email provider is not configured yet.',
    providerMessageId: null,
  };
}

export function normalizeResendError(error) {
  const code = String(error?.code || error?.name || 'resend_send_failed').slice(0, 80);
  const message = String(error?.message || 'Email could not be sent, but the main action completed.').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
  return {
    code,
    message,
    safeMessage: 'Email could not be sent, but the main action completed.',
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return undefined;
  return tags
    .map((tag) => ({ name: String(tag?.name || '').slice(0, 40), value: String(tag?.value || '').slice(0, 120) }))
    .filter((tag) => tag.name && tag.value)
    .slice(0, 10);
}

export async function sendResendEmail({ to, subject, html, text, replyTo, tags } = {}) {
  if (!isResendConfigured()) return buildProviderNotConfiguredResult();

  const apiKey = getServerEnv('RESEND_API_KEY');
  const from = getServerEnv('RESEND_FROM_EMAIL');
  const defaultReplyTo = getServerEnv('RESEND_REPLY_TO_EMAIL');
  const normalizedReplyTo = cleanEnv(replyTo) || defaultReplyTo || undefined;

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        reply_to: normalizedReplyTo,
        tags: normalizeTags(tags),
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.message || `Resend request failed with status ${response.status}`);
      error.code = body?.name || body?.code || `resend_${response.status}`;
      throw error;
    }

    return {
      ok: true,
      status: 'sent',
      providerMessageId: body?.id || null,
      message: 'Email sent.',
    };
  } catch (error) {
    const normalized = normalizeResendError(error);
    return {
      ok: false,
      status: 'failed',
      providerMessageId: null,
      code: normalized.code,
      message: normalized.safeMessage,
      providerErrorMessage: normalized.message,
    };
  }
}
