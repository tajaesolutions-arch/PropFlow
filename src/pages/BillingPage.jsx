import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { formatCurrency } from '../lib/formatters.js';

const plans = [
  {
    key: 'starter',
    title: 'Starter',
    priceMonthly: 29,
    price: '$29/mo',
    description: 'For small hosts and landlords getting organized.',
    features: ['Core dashboard', 'Properties', 'Bookings', 'Cleaning tasks', 'Maintenance tracking'],
  },
  {
    key: 'pro',
    title: 'Pro',
    priceMonthly: 79,
    price: '$79/mo',
    description: 'For growing property operators and property managers.',
    features: ['Everything in Starter', 'Owner dashboard', 'Reports', 'Team roles', 'Inventory tracking'],
  },
  {
    key: 'business',
    title: 'Business',
    priceMonthly: 199,
    price: '$199/mo',
    description: 'For larger property management teams.',
    features: ['Everything in Pro', 'Advanced reports', 'Direct booking tools', 'Priority support', 'More workspaces'],
  },
  {
    key: 'enterprise',
    title: 'Enterprise',
    priceMonthly: null,
    price: 'Custom',
    description: 'For agencies, real estate companies, and larger operators.',
    features: ['Custom onboarding', 'Advanced permissions', 'Custom limits', 'Dedicated support'],
  },
];

const billingAccessRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getWorkspacePlan(currentWorkspace) {
  return (
    currentWorkspace?.subscription?.plan ||
    currentWorkspace?.plan ||
    currentWorkspace?.subscription_plan ||
    'starter'
  );
}

function getSubscriptionStatus(subscription) {
  return subscription?.status || 'not configured';
}

function getGracePeriodStatus(subscription) {
  if (!subscription) return 'not configured';
  if (subscription.grace_period_ends_at) return `ends ${formatDate(subscription.grace_period_ends_at)}`;
  return 'not active';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function getPlan(currentPlan) {
  return plans.find((plan) => plan.key === currentPlan) || plans[0];
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();

  if (['active', 'trialing', 'paid'].includes(value)) return 'success';
  if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(value)) return 'warning';
  if (['cancelled', 'canceled', 'restricted'].includes(value)) return 'error';

  return 'info';
}

export function BillingPage() {
  const { currentUser, currentWorkspace, data } = useApp();

  const allowed = hasAnyRole(currentUser, billingAccessRoles);

  if (!allowed) {
    return (
      <AppLayout title="Billing" subtitle="Workspace subscription and payment recovery.">
        <EmptyState
          eyebrow="Access restricted"
          icon={Lock}
          title="Billing access restricted"
          description="Only PropFlow Admins, Workspace Owners, and Accountants can access billing."
        />
      </AppLayout>
    );
  }

  const subscription = currentWorkspace?.subscription || null;
  const currentPlan = getWorkspacePlan(currentWorkspace);
  const selectedPlan = getPlan(currentPlan);
  const subscriptionStatus = getSubscriptionStatus(subscription);
  const currency = getWorkspaceCurrency(currentWorkspace);

  const properties = data?.properties || [];
  const members = data?.members || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const monthlyEstimate = selectedPlan.priceMonthly || 0;

  return (
    <AppLayout
      title="Billing & Subscription"
      subtitle="Workspace subscription, trial status, payment recovery, and Stripe setup."
    >
      <section className="card billing-notice-card urgent">
        <div className="card-header">
          <div>
            <h3>Stripe backend setup required</h3>
            <p>
              Secure backend billing endpoints must be configured before live subscriptions,
              upgrades, downgrades, invoices, or payment recovery can be enabled.
            </p>
          </div>

          <StatusBadge tone="warning">setup required</StatusBadge>
        </div>

        <div className="helper">
          Do not place Stripe secret keys in frontend code. Use secure backend functions or
          server-side routes for checkout sessions, billing portal sessions, webhook validation, and
          subscription updates.
        </div>
      </section>

      <section className="stat-grid dense">
        <StatCard label="Current plan" value={selectedPlan.title} subtitle={selectedPlan.price} icon={CreditCard} />

        <StatCard
          label="Subscription status"
          value={subscriptionStatus}
          subtitle="Stripe-backed later"
          icon={ShieldCheck}
          tone={statusTone(subscriptionStatus)}
        />

        <StatCard
          label="Trial ends"
          value={formatDate(subscription?.trial_ends_at)}
          subtitle="14-day trial recommended"
          icon={CalendarDays}
        />

        <StatCard
          label="Grace period"
          value={getGracePeriodStatus(subscription)}
          icon={AlertTriangle}
          tone={subscription?.grace_period_ends_at ? 'warning' : 'accent'}
        />
      </section>

      <section className="billing-layout-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace subscription</h3>
              <p>Current subscription lifecycle and billing status for this workspace.</p>
            </div>
            <CreditCard size={20} className="muted" />
          </div>

          {subscription ? (
            <div className="billing-metadata-grid">
              <span>
                <CreditCard size={16} />
                <strong>Plan</strong>
                <small>{subscription.plan || currentPlan}</small>
              </span>

              <span>
                <ShieldCheck size={16} />
                <strong>Status</strong>
                <StatusBadge tone={statusTone(subscription.status)}>{subscription.status}</StatusBadge>
              </span>

              <span>
                <CalendarDays size={16} />
                <strong>Trial ends</strong>
                <small>{formatDate(subscription.trial_ends_at)}</small>
              </span>

              <span>
                <CalendarDays size={16} />
                <strong>Period ends</strong>
                <small>{formatDate(subscription.current_period_end)}</small>
              </span>

              <span>
                <AlertTriangle size={16} />
                <strong>Grace period</strong>
                <small>{getGracePeriodStatus(subscription)}</small>
              </span>

              <span>
                <Lock size={16} />
                <strong>Billing portal</strong>
                <small>Disabled until backend is connected</small>
              </span>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CreditCard}
              title="No subscription record found"
              description="Apply the billing migration and connect Stripe backend services before enabling paid subscriptions."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace usage snapshot</h3>
              <p>Basic usage context for future pricing and plan limits.</p>
            </div>
            <Users size={20} className="muted" />
          </div>

          <div className="billing-usage-grid">
            <span>
              <strong>{activeProperties.length}</strong>
              <small>Active properties</small>
            </span>

            <span>
              <strong>{members.length}</strong>
              <small>Team members</small>
            </span>

            <span>
              <strong>{formatCurrency(monthlyEstimate, currency)}</strong>
              <small>Estimated monthly price</small>
            </span>

            <span>
              <strong>{currency}</strong>
              <small>Workspace currency</small>
            </span>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Launch billing model</h3>
            <p>
              Recommended launch structure: 14-day free trial, Starter, Pro, and Business/Enterprise
              plans through Stripe subscriptions.
            </p>
          </div>
          <Sparkles size={20} className="muted" />
        </div>

        <div className="billing-plan-grid">
          {plans.map((plan) => (
            <article className={plan.key === currentPlan ? 'card billing-plan-card selected' : 'card billing-plan-card'} key={plan.key}>
              <div className="billing-plan-top">
                <div>
                  <h3>{plan.title}</h3>
                  <p>{plan.description}</p>
                </div>

                <StatusBadge tone={plan.key === currentPlan ? 'success' : 'info'}>
                  {plan.key === currentPlan ? 'current' : 'available'}
                </StatusBadge>
              </div>

              <strong className="billing-plan-price">{plan.price}</strong>

              <ul className="checklist">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 size={16} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button className="primary" type="button" disabled data-skip-create-action="true">
                {plan.key === currentPlan ? 'Current plan' : 'Start / Upgrade'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Payment failure handling</h3>
              <p>Recommended launch-ready grace-period workflow.</p>
            </div>
            <AlertTriangle size={20} className="muted" />
          </div>

          <ul className="checklist">
            <li>
              <CheckCircle2 size={16} />
              Stripe webhook detects payment failure.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Workspace Owner sees billing warning.
            </li>
            <li>
              <CheckCircle2 size={16} />
              7-day grace period starts by default.
            </li>
            <li>
              <CheckCircle2 size={16} />
              After grace period, workspace access is restricted to billing recovery.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Staff access is blocked or limited until billing is resolved.
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Billing backend TODO</h3>
              <p>Required before public launch.</p>
            </div>
            <Lock size={20} className="muted" />
          </div>

          <ul className="checklist">
            <li>
              <CheckCircle2 size={16} />
              Create Stripe checkout session endpoint.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Create Stripe billing portal endpoint.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Add Stripe webhook signature validation.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Store subscription status in Supabase.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Enforce trial, active, failed, grace-period, and restricted states.
            </li>
          </ul>
        </section>
      </section>
    </AppLayout>
  );
}
