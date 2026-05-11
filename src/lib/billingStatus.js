import { billingManageRoles } from '../data/constants.js';

const STATUS_ALIASES = {
  trial: 'trialing',
  trialing: 'trialing',
  active: 'active',
  paid: 'active',
  current: 'active',
  past_due: 'past_due',
  pastdue: 'past_due',
  payment_failed: 'past_due',
  grace: 'grace_period',
  grace_period: 'grace_period',
  unpaid: 'unpaid',
  restricted: 'unpaid',
  canceled: 'canceled',
  cancelled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete',
  paused: 'incomplete',
  not_configured: 'no_subscription',
  none: 'no_subscription',
  no_subscription: 'no_subscription',
};

const BILLING_MESSAGES = {
  trialing: 'Your workspace is in its 14-day trial. Billing management is prepared, but live Stripe checkout is not connected yet.',
  active: 'Your workspace subscription is active. Stripe billing is not connected yet, so live payment management remains unavailable.',
  past_due: 'Payment needs attention. Workspace access stays available during the grace period and may be restricted if unresolved.',
  grace_period: 'Payment needs attention during the grace period. Access may be restricted after the grace period if unresolved.',
  unpaid: 'Workspace access is in recovery mode. Owners can review billing recovery while staff access is limited.',
  canceled: 'This workspace subscription is canceled. Choose a plan when billing is connected to restore normal subscription management.',
  incomplete: 'Subscription setup is incomplete. Finish setup when Stripe billing is connected.',
  no_subscription: 'No subscription record was found for this workspace yet. Billing setup is prepared but not live.',
};

function toStatusKey(value) {
  return String(value || 'no_subscription')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatBillingDate(value) {
  const date = getDate(value);
  if (!date) return '—';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function normalizeBillingStatus(status, subscription = {}) {
  const rawStatus = toStatusKey(status || subscription?.status);
  const gracePeriodEndsAt = subscription?.gracePeriodEndsAt || subscription?.grace_period_ends_at || null;
  const graceEnds = getDate(gracePeriodEndsAt);
  const hasActiveGracePeriod = Boolean(graceEnds && graceEnds.getTime() > Date.now());

  if (['past_due', 'pastdue', 'payment_failed', 'unpaid'].includes(rawStatus) && hasActiveGracePeriod) {
    return 'grace_period';
  }

  return STATUS_ALIASES[rawStatus] || 'no_subscription';
}

export function getBillingStatus(subscription, currentUser = null) {
  const normalizedStatus = normalizeBillingStatus(subscription?.status, subscription);
  const gracePeriodEndsAt = subscription?.gracePeriodEndsAt || subscription?.grace_period_ends_at || null;
  const graceEnds = getDate(gracePeriodEndsAt);
  const isInGracePeriod = normalizedStatus === 'grace_period' || Boolean(graceEnds && graceEnds.getTime() > Date.now() && ['past_due', 'unpaid'].includes(toStatusKey(subscription?.status)));
  const isRestricted = normalizedStatus === 'unpaid';
  const canManageBilling = Boolean(currentUser?.roles?.some((role) => billingManageRoles.includes(role)));

  const labelMap = {
    trialing: 'Trialing',
    active: 'Active',
    past_due: 'Past due',
    grace_period: 'Grace period',
    unpaid: 'Restricted / unpaid',
    canceled: 'Canceled',
    incomplete: 'Incomplete setup',
    no_subscription: 'No subscription',
  };

  const toneMap = {
    trialing: 'success',
    active: 'success',
    past_due: 'warning',
    grace_period: 'warning',
    unpaid: 'error',
    canceled: 'error',
    incomplete: 'warning',
    no_subscription: 'info',
  };

  const plan = subscription?.plan || 'starter';
  const userMessage = normalizedStatus === 'grace_period' && gracePeriodEndsAt
    ? `Payment needs attention by ${formatBillingDate(gracePeriodEndsAt)}. Access may be restricted after the grace period if unresolved.`
    : BILLING_MESSAGES[normalizedStatus];

  return {
    normalizedStatus,
    label: labelMap[normalizedStatus],
    tone: toneMap[normalizedStatus],
    userMessage,
    plan,
    gracePeriodEndsAt,
    isInGracePeriod,
    isRestricted,
    canManageBilling,
  };
}
