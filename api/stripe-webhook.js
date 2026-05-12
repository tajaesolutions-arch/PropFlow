import { json, requireMethod } from './_utils/http.js';
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
import { sendTransactionalEmail } from './_utils/transactionalEmail.js';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'payment_intent.payment_failed',
]);

const BILLING_EVENT_BY_STRIPE_EVENT = {
  'checkout.session.completed': 'checkout_completed',
  'checkout.session.expired': 'checkout_expired',
  'customer.subscription.created': 'subscription_created',
  'customer.subscription.updated': 'subscription_updated',
  'customer.subscription.deleted': 'subscription_canceled',
  'invoice.payment_failed': 'payment_failed',
  'invoice.payment_succeeded': 'payment_succeeded',
  'payment_intent.payment_failed': 'payment_failed',
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



async function workspaceMembersWithProfiles(supabaseAdmin, workspaceId, roles) {
  if (!workspaceId) return [];
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, roles, status, profiles:profiles!workspace_members_user_id_fkey(full_name, email)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;
  return (data || []).filter((member) => Array.isArray(member.roles) && member.roles.some((role) => roles.includes(role)));
}

async function workspaceName(supabaseAdmin, workspaceId) {
  const { data } = await supabaseAdmin.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
  return data?.name || 'Workspace';
}

async function directBookingEmailContext(supabaseAdmin, directRequest) {
  const { data: property } = await supabaseAdmin.from('properties').select('name').eq('id', directRequest.property_id).maybeSingle();
  return {
    appUrl: process.env.APP_URL || process.env.VITE_APP_URL,
    guestName: directRequest.guest_name,
    propertyName: property?.name || 'Property',
    amount: directRequest.quoted_total,
    currency: directRequest.currency,
  };
}

async function sendDirectBookingPaymentEmails(supabaseAdmin, directRequest, event, succeeded) {
  const templateKey = succeeded ? 'direct_booking_payment_succeeded' : 'direct_booking_payment_failed';
  const context = await directBookingEmailContext(supabaseAdmin, directRequest);
  const metadata = { entity_type: 'direct_booking_request', entity_id: directRequest.id, property_id: directRequest.property_id, stripe_event_id: event.id };

  await sendTransactionalEmail({
    supabaseAdmin,
    workspaceId: directRequest.workspace_id,
    recipientEmail: directRequest.guest_email,
    templateKey,
    context,
    metadata,
    idempotencyKey: `${templateKey}:${event.id}:guest`,
  }).catch(() => null);

  const managers = await workspaceMembersWithProfiles(supabaseAdmin, directRequest.workspace_id, ['workspace_owner', 'property_manager', 'host']);
  await Promise.allSettled(managers.slice(0, 10).map((manager) => sendTransactionalEmail({
    supabaseAdmin,
    workspaceId: directRequest.workspace_id,
    recipientUserId: manager.user_id,
    recipientEmail: manager.profiles?.email,
    templateKey,
    context,
    metadata,
    idempotencyKey: `${templateKey}:${event.id}:${manager.user_id}`,
  })));
}

async function sendBillingEmails(supabaseAdmin, workspaceId, event, graceEndsAt) {
  const recipients = await workspaceMembersWithProfiles(supabaseAdmin, workspaceId, ['workspace_owner', 'accountant']);
  const name = await workspaceName(supabaseAdmin, workspaceId);
  await Promise.allSettled(recipients.slice(0, 10).map((member) => sendTransactionalEmail({
    supabaseAdmin,
    workspaceId,
    recipientUserId: member.user_id,
    recipientEmail: member.profiles?.email,
    templateKey: 'billing_payment_failed',
    context: { appUrl: process.env.APP_URL || process.env.VITE_APP_URL, workspaceName: name, gracePeriodEndsAt: graceEndsAt },
    metadata: { entity_type: 'workspace_subscription', stripe_event_id: event.id },
    idempotencyKey: `billing_payment_failed:${event.id}:${member.user_id}`,
  })));
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


async function notifyWorkspaceManagers(supabaseAdmin, workspaceId, eventType, title, body, metadata = {}) {
  if (!workspaceId) return;
  const { data: members, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, roles, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;

  const recipients = (members || [])
    .filter((member) => Array.isArray(member.roles) && member.roles.some((role) => ['workspace_owner', 'property_manager', 'host'].includes(role)))
    .map((member) => member.user_id)
    .filter(Boolean);
  if (!recipients.length) return;

  await supabaseAdmin.from('notifications').insert(recipients.map((recipientUserId) => ({
    workspace_id: workspaceId,
    recipient_user_id: recipientUserId,
    actor_user_id: null,
    event_type: eventType,
    type: 'workspace_activity',
    title,
    body,
    message: body,
    priority: eventType.includes('failed') ? 'high' : 'normal',
    action_url: '/direct-bookings',
    metadata,
    status: 'unread',
  })));
}

async function updateDirectBookingPayment(supabaseAdmin, event, paymentStatus) {
  const object = event.data.object;
  const metadata = object.metadata || {};
  const requestId = metadata.direct_booking_request_id || object.client_reference_id || null;
  if (!requestId || metadata.booking_type !== 'direct_booking') return null;

  const patch = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  };
  if (object.id?.startsWith?.('cs_')) patch.stripe_checkout_session_id = object.id;
  if (object.payment_intent) patch.stripe_payment_intent_id = asId(object.payment_intent);
  if (object.id?.startsWith?.('pi_')) patch.stripe_payment_intent_id = object.id;

  const { data: directRequest, error } = await supabaseAdmin
    .from('direct_booking_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!directRequest) return null;

  const succeeded = paymentStatus === 'paid';
  await logActivity(supabaseAdmin, directRequest.workspace_id, succeeded ? 'direct_booking_payment_succeeded' : 'direct_booking_payment_failed', {
    direct_booking_request_id: directRequest.id,
    property_id: directRequest.property_id,
    stripe_event_id: event.id,
  });
  await notifyWorkspaceManagers(
    supabaseAdmin,
    directRequest.workspace_id,
    succeeded ? 'workspace_activity' : 'billing_payment_failed',
    succeeded ? 'Direct booking payment succeeded' : 'Direct booking payment failed',
    succeeded ? 'A direct booking request payment succeeded in Stripe Checkout.' : 'A direct booking request payment failed in Stripe Checkout.',
    { direct_booking_request_id: directRequest.id, property_id: directRequest.property_id, stripe_event_id: event.id },
  );
  await sendDirectBookingPaymentEmails(supabaseAdmin, directRequest, event, succeeded).catch(() => null);

  return { workspaceId: directRequest.workspace_id, subscriptionId: null, status: paymentStatus, directBookingRequestId: directRequest.id };
}

async function processCheckoutCompleted(supabaseAdmin, event) {
  const session = event.data.object;
  if (session.metadata?.booking_type === 'direct_booking') return updateDirectBookingPayment(supabaseAdmin, event, 'paid');
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
    await sendBillingEmails(supabaseAdmin, updated.workspace_id, event, graceEndsAt).catch(() => null);
  }

  return { workspaceId: updated.workspace_id, subscriptionId: updated.id, plan: updated.plan, status: updated.status };
}

async function processEvent(supabaseAdmin, event) {
  if (event.type === 'checkout.session.completed') return processCheckoutCompleted(supabaseAdmin, event);
  if (event.type === 'checkout.session.expired') return updateDirectBookingPayment(supabaseAdmin, event, 'expired') || { workspaceId: null, subscriptionId: null };
  if (event.type === 'payment_intent.payment_failed') return updateDirectBookingPayment(supabaseAdmin, event, 'failed') || { workspaceId: null, subscriptionId: null };
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
      message: 'Stripe webhook could not be processed.',
    });
  }
}
