import { getBearerToken, requireBearerToken } from './_utils/auth.js';
import { getServerEnv, requireServerEnv } from './_utils/env.js';
import { json, readJsonBody, requireJsonContentType, requireMethod } from './_utils/http.js';
import { getAuthenticatedUser, getSupabaseAdminClient } from './_utils/supabaseAdmin.js';
import { buildSameOriginUrl, getStripeSecretKey, stripeRequest } from './_utils/stripe.js';

const BILLING_PORTAL_ROLES = new Set(['workspace_owner', 'billing_admin', 'billing-admin']);
const NO_STRIPE_CUSTOMER_MESSAGE = 'No Stripe customer is connected to this workspace yet. Choose a plan first.';

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
    returnUrl: body.return_url || body.returnUrl,
    action: body.action || body.billing_action || body.billingAction || 'manage_billing',
  };
}

function safeBillingAction(action) {
  const normalized = String(action || 'manage_billing').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64);
  return normalized || 'manage_billing';
}

async function logActivity(supabaseAdmin, workspaceId, actorUserId, action, metadata = {}) {
  await supabaseAdmin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: actorUserId,
    action,
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
  if (!getServerEnv('APP_URL', ['VITE_APP_URL'])) return providerNotConfigured(request, response, ['APP_URL']);
  if (!requireServerEnv(request, response, requiredConfig)) return;

  const accessToken = requireBearerToken(request, response, 'Authenticated session required before opening billing portal.');
  if (!accessToken) return;

  try {
    const body = normalizeBody(await readJsonBody(request));
    const { workspaceId } = body;
    const billingAction = safeBillingAction(body.action);

    if (!workspaceId) {
      return json(request, response, 400, { code: 'invalid_workspace', message: 'A valid workspace_id is required.' });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const user = await getAuthenticatedUser(supabaseAdmin, getBearerToken(request));
    if (!user?.id) {
      return json(request, response, 401, { code: 'invalid_session', message: 'Sign in again before opening billing portal.' });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, status')
      .eq('id', workspaceId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) return json(request, response, 404, { code: 'workspace_not_found', message: 'Workspace not found.' });
    if (workspace.status === 'suspended') {
      return json(request, response, 403, { code: 'workspace_suspended', message: 'Suspended workspaces cannot open Stripe billing portal.' });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, roles, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;

    const roles = Array.isArray(membership?.roles) ? membership.roles : [];
    const canManagePortal = membership?.status === 'active' && roles.some((role) => BILLING_PORTAL_ROLES.has(role));
    if (!canManagePortal) {
      return json(request, response, 403, { code: 'billing_role_required', message: 'Only Workspace Owners can manage Stripe billing.' });
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('id, workspace_id, plan, status, stripe_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    if (!subscription?.stripe_customer_id) {
      return json(request, response, 409, { code: 'stripe_customer_missing', message: NO_STRIPE_CUSTOMER_MESSAGE });
    }

    const portalSession = await stripeRequest('/billing_portal/sessions', {
      method: 'POST',
      body: {
        customer: subscription.stripe_customer_id,
        return_url: buildSameOriginUrl(getServerEnv('APP_URL', ['VITE_APP_URL']).replace(/\/$/, ''), body.returnUrl, '/settings?tab=billing'),
      },
    });

    await logActivity(supabaseAdmin, workspaceId, user.id, 'stripe_customer_portal_opened', {
      workspace_id: workspaceId,
      user_id: user.id,
      action: billingAction,
      plan: subscription.plan || null,
      status: subscription.status || null,
    });

    return json(request, response, 200, { url: portalSession.url });
  } catch (error) {
    const statusCode = error?.code === 'provider_not_configured' ? 501 : 500;
    return json(request, response, statusCode, {
      code: error?.code || 'customer_portal_session_failed',
      message: error?.code === 'provider_not_configured' ? 'Stripe billing is not configured yet.' : 'Stripe billing portal could not be opened.',
    });
  }
}
