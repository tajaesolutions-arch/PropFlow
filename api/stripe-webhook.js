import { json, requireMethod, safeErrorMessage } from './_utils/http.js';
import { getSupabaseAdminClient } from './_utils/supabaseAdmin.js';
import {
  getStripeSecretKey,
  getStripeWebhookSecret,
  mapStripeSubscriptionStatus,
  normalizeStripeTimestamp,
  planFromPriceId,
  readRawBody,
  stripeRequest,
  verifyStripeSignature,
} from './_utils/stripe.js';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
]);

const BILLING_EVENT_BY_STRIPE_EVENT = {
  'checkout.session.completed': 'checkout_completed',
  'customer.subscription.created': 'subscription_created',
  'customer.subscription.updated': 'subscription_updated',
  'customer.subscription.deleted': 'subscription_canceled',
  'invoice.payment_failed': 'payment_failed',
  'invoice.payment_succeeded': 'payment_succeeded',
};

function providerNotConfigured(request, response, requiredServerEnv = []) {
  return json(request, response, 501, {
    code: 'provider_not_configured',
    message: 'Stripe billing is not configured yet.',
    requiredServerEnv,
  });
}

function asId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function firstSubscriptionItem(subscription) {
  return subscription?.items?.data?.[0] || null;
}

function subscriptionPriceId(subscription) {
  return firstSubscriptionItem(subscription)?.price?.id || subscription?.plan?.id || null;
}

function subscriptionPeriodStart(subscription) {
  return subscription?.current_period_start || firstSubscriptionItem(subscription)?.current_period_start || null;
}

function subscriptionPeriodEnd(subscription) {
  return subscription?.current_period_end || firstSubscriptionItem(subscription)?.current_period_end || null;
}

function subscriptionTrialEnd(subscription) {
  return subscription?.trial_end || firstSubscriptionItem(subscription)?.trial_end || null;
}

async function retrieveSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

async function findSubscriptionRow(supabaseAdmin, { workspaceId, stripeCustomerId, stripeSubscriptionId }) {
  if (workspaceId) {
    const { data, error } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (stripeSubscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (stripeCustomerId) {
    const { data, error } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function ensureSubscriptionRow(supabaseAdmin, workspaceId, fallbackPlan = 'starter') {
  if (!workspaceId) return null;
  const existing = await findSubscriptionRow(supabaseAdmin, { workspaceId });
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .insert({
      workspace_id: workspaceId,
      plan: fallbackPlan,
      status: 'incomplete',
      billing_provider: 'stripe',
      metadata: { initialized_from: 'stripe_webhook' },
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function logActivity(supabaseAdmin, workspaceId, action, metadata = {}) {
  if (!workspaceId) return;
  await supabaseAdmin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: null,
    action,
    metadata,
  });
}


async function hasRecordedStripeEvent(supabaseAdmin, stripeEventId) {
  if (!stripeEventId) return false;
  const { data, error } = await supabaseAdmin
    .from('billing_events')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_event_id', stripeEventId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function recordBillingEvent(supabaseAdmin, { workspaceId, subscriptionId, eventType, stripeEventId, message, metadata = {} }) {
  if (!workspaceId || !eventType) return { inserted: false };
  const { error } = await supabaseAdmin.from('billing_events').insert({
    workspace_id: workspaceId,
    subscription_id: subscriptionId || null,
    actor_user_id: null,
    event_type: eventType,
    provider: 'stripe',
    provider_event_id: stripeEventId || null,
    status: 'recorded',
    message,
    metadata,
  });

  if (error?.code === '23505') return { inserted: false, duplicate: true };
  if (error) throw error;
  return { inserted: true };
}

async function notifyBillingMembers(supabaseAdmin, workspaceId, eventType, title, body, metadata = {}) {
  if (!workspaceId || !['billing_payment_failed', 'billing_grace_period_warning'].includes(eventType)) return;

  const { data: members, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, roles, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;

  const recipients = (members || [])
    .filter((member) => Array.isArray(member.roles) && member.roles.some((role) => ['workspace_owner', 'accountant'].includes(role)))
    .map((member) => member.user_id)
    .filter(Boolean)
    .filter((userId, index, list) => list.indexOf(userId) === index);

  if (!recipients.length) return;

  await supabaseAdmin.from('notifications').insert(
    recipients.map((recipientUserId) => ({
      workspace_id: workspaceId,
      recipient_user_id: recipientUserId,
      actor_user_id: null,
      event_type: eventType,
      type: eventType,
      title,
      body,
      message: body,
      priority: eventType === 'billing_payment_failed' ? 'urgent' : 'high',
      action_url: '/settings',
      metadata,
      status: 'unread',
    })),
  );
}

function buildSubscriptionPatch(subscription, { status, plan, stripeCustomerId, stripeSubscriptionId, stripePriceId, stripeEventId } = {}) {
  const mappedStatus = status || mapStripeSubscriptionStatus(subscription?.status);
  const canceledAt = mappedStatus === 'canceled' ? normalizeStripeTimestamp(subscription?.canceled_at) || new Date().toISOString() : null;

  return {
    plan: plan || planFromPriceId(stripePriceId) || subscription?.metadata?.plan_id || undefined,
    status: mappedStatus,
    stripe_customer_id: stripeCustomerId || asId(subscription?.customer) || undefined,
    stripe_subscription_id: stripeSubscriptionId || subscription?.id || undefined,
    stripe_price_id: stripePriceId || subscriptionPriceId(subscription) || undefined,
    current_period_start: normalizeStripeTimestamp(subscriptionPeriodStart(subscription)),
    current_period_end: normalizeStripeTimestamp(subscriptionPeriodEnd(subscription)),
    trial_ends_at: normalizeStripeTimestamp(subscriptionTrialEnd(subscription)),
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    canceled_at: canceledAt,
    last_webhook_event_id: stripeEventId || undefined,
    last_stripe_event_id: stripeEventId || undefined,
    updated_at: new Date().toISOString(),
  };
}

function cleanPatch(patch) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

async function updateSubscription(supabaseAdmin, row, patch) {
  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update(cleanPatch(patch))
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function processCheckoutCompleted(supabaseAdmin, event) {
  const session = event.data.object;
  const workspaceId = session.metadata?.workspace_id || session.client_reference_id || null;
  const plan = session.metadata?.plan_id || null;
  const stripeCustomerId = asId(session.customer);
  const stripeSubscriptionId = asId(session.subscription);
  const subscription = await retrieveSubscription(stripeSubscriptionId);
  const stripePriceId = subscriptionPriceId(subscription);
  const row = await ensureSubscriptionRow(supabaseAdmin, workspaceId, plan || planFromPriceId(stripePriceId) || 'starter');
  if (!row) return { workspaceId: null, subscriptionId: null };

  const updated = await updateSubscription(supabaseAdmin, row, buildSubscriptionPatch(subscription, {
    plan: plan || planFromPriceId(stripePriceId),
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    stripeEventId: event.id,
  }));

  await logActivity(supabaseAdmin, updated.workspace_id, 'subscription_checkout_completed', { plan: updated.plan, stripe_event_id: event.id });
  return { workspaceId: updated.workspace_id, subscriptionId: updated.id, plan: updated.plan };
}

async function processSubscriptionEvent(supabaseAdmin, event) {
  const subscription = event.data.object;
  const workspaceId = subscription.metadata?.workspace_id || null;
  const stripeCustomerId = asId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const stripePriceId = subscriptionPriceId(subscription);
  const plan = subscription.metadata?.plan_id || planFromPriceId(stripePriceId) || undefined;
  const existing = await findSubscriptionRow(supabaseAdmin, { workspaceId, stripeCustomerId, stripeSubscriptionId });
  const row = existing || (workspaceId ? await ensureSubscriptionRow(supabaseAdmin, workspaceId, plan || 'starter') : null);
  if (!row) return { workspaceId: null, subscriptionId: null };

  const updated = await updateSubscription(supabaseAdmin, row, buildSubscriptionPatch(subscription, {
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    stripeEventId: event.id,
  }));

  const action = event.type === 'customer.subscription.deleted' ? 'subscription_canceled' : 'subscription_status_updated';
  await logActivity(supabaseAdmin, updated.workspace_id, action, { plan: updated.plan, status: updated.status, stripe_event_id: event.id });
  return { workspaceId: updated.workspace_id, subscriptionId: updated.id, plan: updated.plan, status: updated.status };
}

async function processInvoiceEvent(supabaseAdmin, event) {
  const invoice = event.data.object;
  const stripeCustomerId = asId(invoice.customer);
  const stripeSubscriptionId = asId(invoice.subscription) || asId(invoice.parent?.subscription_details?.subscription);
  const subscription = await retrieveSubscription(stripeSubscriptionId);
  const workspaceId = invoice.metadata?.workspace_id || subscription?.metadata?.workspace_id || null;
  const stripePriceId = subscriptionPriceId(subscription);
  const row = await findSubscriptionRow(supabaseAdmin, { workspaceId, stripeCustomerId, stripeSubscriptionId });
  if (!row) return { workspaceId: null, subscriptionId: null };

  const now = new Date();
  const graceEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const isFailed = event.type === 'invoice.payment_failed';
  const patch = buildSubscriptionPatch(subscription, {
    status: isFailed ? 'grace_period' : 'active',
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    stripeEventId: event.id,
  });

  if (isFailed) {
    patch.payment_failed_at = now.toISOString();
    patch.grace_period_started_at = now.toISOString();
    patch.grace_period_ends_at = graceEndsAt;
  } else {
    patch.payment_failed_at = null;
    patch.grace_period_started_at = null;
    patch.grace_period_ends_at = null;
    patch.restricted_at = null;
    patch.restored_at = now.toISOString();
  }

  const updated = await updateSubscription(supabaseAdmin, row, patch);
  const action = isFailed ? 'billing_payment_failed' : 'billing_payment_succeeded';
  await logActivity(supabaseAdmin, updated.workspace_id, action, { plan: updated.plan, status: updated.status, stripe_event_id: event.id });

  if (isFailed) {
    await notifyBillingMembers(
      supabaseAdmin,
      updated.workspace_id,
      'billing_payment_failed',
      'Billing payment failed',
      'A Stripe subscription payment failed. The workspace has entered a 7-day billing grace period.',
      { grace_period_ends_at: graceEndsAt },
    );
    await notifyBillingMembers(
      supabaseAdmin,
      updated.workspace_id,
      'billing_grace_period_warning',
      'Billing grace period started',
      'Resolve the failed payment before the grace period ends to avoid workspace access restrictions.',
      { grace_period_ends_at: graceEndsAt },
    );
  }

  return { workspaceId: updated.workspace_id, subscriptionId: updated.id, plan: updated.plan, status: updated.status };
}

async function processEvent(supabaseAdmin, event) {
  if (event.type === 'checkout.session.completed') return processCheckoutCompleted(supabaseAdmin, event);
  if (event.type.startsWith('customer.subscription.')) return processSubscriptionEvent(supabaseAdmin, event);
  if (event.type.startsWith('invoice.payment_')) return processInvoiceEvent(supabaseAdmin, event);
  return { workspaceId: null, subscriptionId: null };
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) return providerNotConfigured(request, response, ['STRIPE_WEBHOOK_SECRET']);
  if (!getStripeSecretKey()) return providerNotConfigured(request, response, ['STRIPE_SECRET_KEY']);

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) return providerNotConfigured(request, response, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

  try {
    const rawBody = await readRawBody(request);
    const signature = request.headers['stripe-signature'];
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return json(request, response, 400, { code: 'invalid_signature', message: 'Invalid Stripe webhook signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (!HANDLED_EVENTS.has(event.type)) {
      return json(request, response, 200, { received: true, ignored: true });
    }

    if (await hasRecordedStripeEvent(supabaseAdmin, event.id)) {
      return json(request, response, 200, { received: true, duplicate: true });
    }

    const result = await processEvent(supabaseAdmin, event);
    const billingEventType = BILLING_EVENT_BY_STRIPE_EVENT[event.type];
    const recordResult = await recordBillingEvent(supabaseAdmin, {
      workspaceId: result.workspaceId,
      subscriptionId: result.subscriptionId,
      eventType: billingEventType,
      stripeEventId: event.id,
      message: `Stripe ${event.type} processed.`,
      metadata: { plan: result.plan || null, status: result.status || null },
    });

    return json(request, response, 200, {
      received: true,
      processed: Boolean(result.workspaceId),
      duplicate: Boolean(recordResult.duplicate),
    });
  } catch (error) {
    return json(request, response, 500, {
      code: error?.code || 'stripe_webhook_failed',
      message: safeErrorMessage(error, 'Stripe webhook could not be processed.'),
    });
  }
}
