import crypto from 'node:crypto';

import { getServerEnv } from './env.js';

export const CHECKOUT_PLANS = Object.freeze({
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
  business: 'STRIPE_PRICE_BUSINESS',
});

export function getStripeSecretKey() {
  return getServerEnv('STRIPE_SECRET_KEY');
}

export function getStripeWebhookSecret() {
  return getServerEnv('STRIPE_WEBHOOK_SECRET');
}

export function getPlanPriceId(planId) {
  const normalizedPlan = String(planId || '').trim().toLowerCase();
  const envName = CHECKOUT_PLANS[normalizedPlan];
  if (!envName) return { plan: normalizedPlan, envName: '', priceId: '' };
  return { plan: normalizedPlan, envName, priceId: getServerEnv(envName) };
}

export function getAppUrl(request) {
  const configured = getServerEnv('APP_URL', ['VITE_APP_URL']);
  if (configured) return configured.replace(/\/$/, '');

  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  return host ? `${protocol}://${host}` : 'http://localhost:5173';
}

export async function stripeRequest(path, { method = 'GET', body, secretKey = getStripeSecretKey() } = {}) {
  if (!secretKey) {
    const error = new Error('Stripe billing is not configured yet.');
    error.code = 'provider_not_configured';
    throw error;
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Stripe request failed.');
    error.code = payload?.error?.code || 'stripe_request_failed';
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export function appendStripeParam(params, key, value) {
  if (value === undefined || value === null || value === '') return;
  params[key] = String(value);
}

export async function readRawBody(request, { maxBytes = 1024 * 1024 } = {}) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body, 'utf8');

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      const error = new Error('request_body_too_large');
      error.code = 'request_body_too_large';
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((part) => part.split('='))
      .filter(([key, value]) => key && value),
  );
  const timestamp = parts.t;
  const signatures = String(signatureHeader)
    .split(',')
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (!timestamp || !signatures.length) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  return signatures.some((signature) => {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  });
}

export function normalizeStripeTimestamp(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) && numericValue > 0 ? new Date(numericValue * 1000).toISOString() : null;
}

export function mapStripeSubscriptionStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'active') return 'active';
  if (normalized === 'past_due') return 'grace_period';
  if (normalized === 'unpaid') return 'unpaid';
  if (normalized === 'canceled') return 'canceled';
  if (normalized === 'incomplete' || normalized === 'incomplete_expired') return 'incomplete';
  if (normalized === 'paused') return 'restricted';
  return normalized || 'incomplete';
}

export function planFromPriceId(priceId) {
  const price = String(priceId || '');
  return Object.entries(CHECKOUT_PLANS).find(([, envName]) => getServerEnv(envName) === price)?.[0] || null;
}
