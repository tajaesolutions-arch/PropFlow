import { getBearerToken, requireBearerToken } from './_utils/auth.js';
import { getServerEnv, requireServerEnv } from './_utils/env.js';
import { json, readJsonBody, requireJsonContentType, requireMethod, safeErrorMessage } from './_utils/http.js';
import { getAuthenticatedUser, getSupabaseAdminClient } from './_utils/supabaseAdmin.js';
import { appendStripeParam, getAppUrl, getPlanPriceId, getStripeSecretKey, stripeRequest } from './_utils/stripe.js';

const BILLING_MANAGE_ROLES = new Set(['workspace_owner']);

function providerNotConfigured(request, response, requiredServerEnv = []) {
  return json(request, response, 501, {
    code: 'provider_not_configured',
    message: 'Stripe billing is not configured yet.',
    requiredServerEnv,
  });
}

function normalizeBody(body = {}) {
  return {
    workspaceId: body.workspace_id || body.workspaceId,
    planId: body.plan_id || body.planId || body.plan || body.price_key || body.priceKey,
    successUrl: body.success_url || body.successUrl,
    cancelUrl: body.cancel_url || body.cancelUrl,
  };
}

async function getOrCreateSubscription(supabaseAdmin, workspaceId, plan, userId) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const { data: created, error: insertError } = await supabaseAdmin
    .from('workspace_subscriptions')
    .insert({
      workspace_id: workspaceId,
      plan,
      status: 'trialing',
      billing_provider: 'stripe',
      trial_started_at: trialStartedAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      metadata: { initialized_from: 'stripe_checkout_request' },
      created_by: userId,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return created;
}

async function logActivity(supabaseAdmin, workspaceId, actorUserId, action, metadata = {}) {
  await supabaseAdmin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: actorUserId,
    action,
    metadata,
  });
}

async function logBillingEvent(supabaseAdmin, workspaceId, subscriptionId, actorUserId, eventType, message, metadata = {}) {
  await supabaseAdmin.from('billing_events').insert({
    workspace_id: workspaceId,
    subscription_id: subscriptionId || null,
    actor_user_id: actorUserId,
    event_type: eventType,
    provider: 'stripe',
    status: 'recorded',
    message,
    metadata,
  });
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  if (!requireJsonContentType(request, response)) return;

  const requiredConfig = [
    { name: 'SUPABASE_URL', fallbacks: ['VITE_SUPABASE_URL'] },
    { name: 'SUPABASE_SERVICE_ROLE_KEY' },
  ];

  if (!getStripeSecretKey()) return providerNotConfigured(request, response, ['STRIPE_SECRET_KEY']);
  if (!getServerEnv('SUPABASE_SERVICE_ROLE_KEY')) return providerNotConfigured(request, response, ['SUPABASE_SERVICE_ROLE_KEY']);
  if (!requireServerEnv(request, response, requiredConfig)) return;

  const accessToken = requireBearerToken(request, response, 'Authenticated session required before checkout.');
  if (!accessToken) return;

  try {
    const body = normalizeBody(await readJsonBody(request));
    const { workspaceId, planId } = body;
    const { plan, envName, priceId } = getPlanPriceId(planId);

    if (!workspaceId) {
      return json(request, response, 400, { code: 'invalid_workspace', message: 'A valid workspace_id is required.' });
    }
    if (!envName) {
      return json(request, response, 400, { code: 'invalid_plan', message: 'Choose a valid Starter, Pro, or Business plan.' });
    }
    if (!priceId) return providerNotConfigured(request, response, [envName]);

    const supabaseAdmin = getSupabaseAdminClient();
    const user = await getAuthenticatedUser(supabaseAdmin, getBearerToken(request));
    if (!user?.id) {
      return json(request, response, 401, { code: 'invalid_session', message: 'Sign in again before starting checkout.' });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, status, business_email')
      .eq('id', workspaceId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) return json(request, response, 404, { code: 'workspace_not_found', message: 'Workspace not found.' });
    if (workspace.status === 'suspended') {
      return json(request, response, 403, { code: 'workspace_suspended', message: 'Suspended workspaces cannot start checkout.' });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, roles, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    const roles = Array.isArray(membership?.roles) ? membership.roles : [];
    const canManageBilling = membership?.status === 'active' && roles.some((role) => BILLING_MANAGE_ROLES.has(role));
    if (!canManageBilling) {
      return json(request, response, 403, { code: 'billing_role_required', message: 'Only Workspace Owners can start Stripe checkout.' });
    }

    const subscription = await getOrCreateSubscription(supabaseAdmin, workspaceId, plan, user.id);
    let stripeCustomerId = subscription.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripeRequest('/customers', {
        method: 'POST',
        body: {
          name: workspace.name || 'PropFlow workspace',
          email: workspace.business_email || user.email || undefined,
          'metadata[workspace_id]': workspaceId,
        },
      });
      stripeCustomerId = customer.id;
      const { error: updateError } = await supabaseAdmin
        .from('workspace_subscriptions')
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);
      if (updateError) throw updateError;
    }

    const appUrl = getAppUrl(request);
    const successUrl = body.successUrl || `${appUrl}/settings?billing=checkout-success`;
    const cancelUrl = body.cancelUrl || `${appUrl}/settings?billing=checkout-canceled`;
    const params = {
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[workspace_id]': workspaceId,
      'metadata[user_id]': user.id,
      'metadata[plan_id]': plan,
      'subscription_data[metadata][workspace_id]': workspaceId,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan_id]': plan,
      client_reference_id: workspaceId,
    };
    appendStripeParam(params, 'customer_update[name]', 'auto');
    appendStripeParam(params, 'customer_update[address]', 'auto');

    const session = await stripeRequest('/checkout/sessions', { method: 'POST', body: params });

    await logActivity(supabaseAdmin, workspaceId, user.id, 'stripe_checkout_session_created', { plan, stripe_session_id: session.id });
    await logBillingEvent(supabaseAdmin, workspaceId, subscription.id, user.id, 'checkout_started', 'Stripe checkout session created.', { plan, stripe_session_id: session.id });

    return json(request, response, 200, { url: session.url, sessionId: session.id });
  } catch (error) {
    const statusCode = error?.code === 'provider_not_configured' ? 501 : 500;
    return json(request, response, statusCode, {
      code: error?.code || 'checkout_session_failed',
      message: error?.code === 'provider_not_configured' ? 'Stripe billing is not configured yet.' : safeErrorMessage(error, 'Checkout could not be started.'),
    });
  }
}
