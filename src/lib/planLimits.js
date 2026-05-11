import { normalizeBillingStatus } from './billingStatus.js';

export const PLAN_KEYS = Object.freeze(['starter', 'pro', 'business']);

export const FEATURE_KEYS = Object.freeze({
  PROPERTIES: 'properties',
  TEAM_MEMBERS: 'team_members',
  OWNER_REPORTS: 'owner_reports',
  DIRECT_BOOKING_PAGES: 'direct_booking_pages',
  ADVANCED_REPORTS: 'advanced_reports',
  AI_TOOLS: 'ai_tools',
  PRIORITY_SUPPORT: 'priority_support',
});

export const PLAN_LIMITS = Object.freeze({
  starter: Object.freeze({
    key: 'starter',
    label: 'Starter',
    maxProperties: 3,
    maxTeamMembers: 3,
    maxOwnerReportsPerMonth: 5,
    directBookingPages: false,
    advancedReports: false,
    aiTools: false,
    prioritySupport: false,
  }),
  pro: Object.freeze({
    key: 'pro',
    label: 'Pro',
    maxProperties: 15,
    maxTeamMembers: 10,
    maxOwnerReportsPerMonth: 25,
    directBookingPages: true,
    advancedReports: true,
    aiTools: false,
    prioritySupport: false,
  }),
  business: Object.freeze({
    key: 'business',
    label: 'Business',
    maxProperties: null,
    maxTeamMembers: null,
    maxOwnerReportsPerMonth: null,
    directBookingPages: true,
    advancedReports: true,
    aiTools: 'coming_soon',
    prioritySupport: true,
  }),
});

const FEATURE_LIMIT_MAP = Object.freeze({
  [FEATURE_KEYS.PROPERTIES]: 'maxProperties',
  [FEATURE_KEYS.TEAM_MEMBERS]: 'maxTeamMembers',
  [FEATURE_KEYS.OWNER_REPORTS]: 'maxOwnerReportsPerMonth',
});

const FEATURE_FLAG_MAP = Object.freeze({
  [FEATURE_KEYS.DIRECT_BOOKING_PAGES]: 'directBookingPages',
  [FEATURE_KEYS.ADVANCED_REPORTS]: 'advancedReports',
  [FEATURE_KEYS.AI_TOOLS]: 'aiTools',
  [FEATURE_KEYS.PRIORITY_SUPPORT]: 'prioritySupport',
});

const PREMIUM_FEATURES = new Set([
  FEATURE_KEYS.DIRECT_BOOKING_PAGES,
  FEATURE_KEYS.ADVANCED_REPORTS,
  FEATURE_KEYS.AI_TOOLS,
  FEATURE_KEYS.PRIORITY_SUPPORT,
]);

const RESTRICTED_STATUSES = new Set(['unpaid', 'canceled', 'incomplete']);
const WARNING_STATUSES = new Set(['past_due', 'grace_period']);

function normalizePlanKey(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'enterprise') return 'business';
  return PLAN_LIMITS[key] ? key : 'starter';
}

export function getWorkspacePlan(subscription = {}, workspace = {}) {
  const planKey = normalizePlanKey(
    subscription?.plan ||
      subscription?.price_key ||
      subscription?.priceKey ||
      workspace?.subscription_plan ||
      workspace?.plan,
  );

  return PLAN_LIMITS[planKey];
}

export function getPlanLimit(planOrKey, limitKey) {
  const plan = typeof planOrKey === 'string' ? PLAN_LIMITS[normalizePlanKey(planOrKey)] : planOrKey;
  return plan?.[limitKey] ?? null;
}

export function isWorkspaceRestricted(subscriptionStatus, subscription = {}) {
  const normalizedStatus = normalizeBillingStatus(subscriptionStatus, subscription);
  return RESTRICTED_STATUSES.has(normalizedStatus);
}

export function isWorkspaceInBillingWarning(subscriptionStatus, subscription = {}) {
  const normalizedStatus = normalizeBillingStatus(subscriptionStatus, subscription);
  return WARNING_STATUSES.has(normalizedStatus);
}

export function canUseFeature(workspace = {}, featureKey, subscription = workspace?.subscription || {}) {
  const plan = getWorkspacePlan(subscription, workspace);
  const normalizedStatus = normalizeBillingStatus(subscription?.status || workspace?.subscription_status, subscription);
  const restricted = isWorkspaceRestricted(normalizedStatus, subscription);

  if (restricted && PREMIUM_FEATURES.has(featureKey)) {
    return {
      allowed: false,
      plan,
      status: normalizedStatus,
      restricted: true,
      reason: 'billing_restricted',
      message: 'Billing recovery is required before premium workspace operations can continue.',
    };
  }

  const flagKey = FEATURE_FLAG_MAP[featureKey];
  if (flagKey) {
    const value = plan[flagKey];
    const allowed = value === true || value === 'coming_soon';
    return {
      allowed,
      plan,
      status: normalizedStatus,
      restricted: false,
      comingSoon: value === 'coming_soon',
      reason: allowed ? 'allowed' : 'plan_upgrade_required',
      message: allowed ? '' : getUpgradeMessage(featureKey, plan.key),
    };
  }

  return {
    allowed: true,
    plan,
    status: normalizedStatus,
    restricted: false,
    reason: 'allowed',
    limit: getPlanLimit(plan, FEATURE_LIMIT_MAP[featureKey]),
    message: '',
  };
}

export function getUsageLimitState({ plan, limitKey, currentCount }) {
  const limit = getPlanLimit(plan, limitKey);
  const count = Number(currentCount);
  const hasCount = Number.isFinite(count);

  if (limit === null || limit === undefined) {
    return { limit, count: hasCount ? count : null, unlimited: true, available: true, reached: false, label: 'Unlimited' };
  }

  if (!hasCount) {
    return { limit, count: null, unlimited: false, available: false, reached: false, label: 'Usage data unavailable' };
  }

  return {
    limit,
    count,
    unlimited: false,
    available: true,
    reached: count >= limit,
    remaining: Math.max(limit - count, 0),
    label: `${count} / ${limit}`,
  };
}

export function countOwnerReportsThisMonth(ownerReports = [], now = new Date()) {
  if (!Array.isArray(ownerReports)) return null;

  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  return ownerReports.filter((report) => {
    const rawDate = report.created_at || report.createdAt || report.generated_at || report.generatedAt || report.start_date || report.startDate;
    const date = rawDate ? new Date(rawDate) : null;
    const time = date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
    return time !== null && time >= start && time < end;
  }).length;
}

export function formatLimit(limit) {
  return limit === null || limit === undefined ? 'Unlimited' : String(limit);
}

export function getUpgradeMessage(featureKey, currentPlan) {
  const plan = getWorkspacePlan({ plan: currentPlan });
  const featureNames = {
    [FEATURE_KEYS.PROPERTIES]: 'more properties',
    [FEATURE_KEYS.TEAM_MEMBERS]: 'more team members',
    [FEATURE_KEYS.OWNER_REPORTS]: 'more owner reports this month',
    [FEATURE_KEYS.DIRECT_BOOKING_PAGES]: 'direct booking pages',
    [FEATURE_KEYS.ADVANCED_REPORTS]: 'advanced reports',
    [FEATURE_KEYS.AI_TOOLS]: 'AI tools',
    [FEATURE_KEYS.PRIORITY_SUPPORT]: 'priority support',
  };

  const targetPlan = plan.key === 'starter' ? 'Pro' : 'Business';
  return `Upgrade to ${targetPlan} to unlock ${featureNames[featureKey] || 'this feature'}.`;
}

export function buildWorkspaceUsage({ properties, members, ownerReports }) {
  return {
    properties: Array.isArray(properties) ? properties.filter((property) => property.status !== 'archived').length : null,
    teamMembers: Array.isArray(members) ? members.filter((member) => member.status !== 'removed' && member.status !== 'revoked').length : null,
    ownerReportsThisMonth: countOwnerReportsThisMonth(ownerReports),
  };
}
