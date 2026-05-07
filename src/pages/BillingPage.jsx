import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

const plans = [
  {
    key: 'starter',
    title: 'Starter',
    price: '$29/mo',
    description: 'For small hosts and landlords getting organized.',
    features: ['Core dashboard', 'Properties', 'Bookings', 'Cleaning tasks', 'Maintenance tracking'],
  },
  {
    key: 'pro',
    title: 'Pro',
    price: '$79/mo',
    description: 'For growing property operators and managers.',
    features: ['Everything in Starter', 'Owner dashboard', 'Reports', 'Team roles', 'Inventory tracking'],
  },
  {
    key: 'business',
    title: 'Business',
    price: '$199/mo',
    description: 'For larger property management teams.',
    features: ['Everything in Pro', 'Advanced reports', 'Direct booking tools', 'Priority support', 'More workspaces'],
  },
  {
    key: 'enterprise',
    title: 'Enterprise',
    price: 'Custom',
    description: 'For agencies, real estate companies, and larger operators.',
    features: ['Custom onboarding', 'Advanced permissions', 'Custom limits', 'Dedicated support'],
  },
];

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

export function BillingPage() {
  const { currentUser, currentWorkspace } = useApp();

  const allowed =
    currentUser?.roles?.includes(roles.OWNER_ADMIN) ||
    currentUser?.roles?.includes(roles.ADMIN);

  if (!allowed) {
    return (
      <AppLayout title="Billing">
        <EmptyState
          title="Billing access restricted"
          description="Only Workspace Owners and PropFlow Admins can access billing."
        />
      </AppLayout>
    );
  }

  const subscription = currentWorkspace?.subscription || null;
  const currentPlan = getWorkspacePlan(currentWorkspace);
  const subscriptionStatus = getSubscriptionStatus(subscription);

  return (
    <AppLayout
      title="Billing & Subscription"
      subtitle="Workspace subscription, trial status, payment recovery, and Stripe setup"
    >
      <p className="page-note">
        Billing is a protected Workspace Owner / PropFlow Admin area. Stripe checkout, billing
        portal, subscription webhooks, failed-payment warnings, and grace-period enforcement should
        be connected in the backend billing phase.
      </p>

      <div className="stat-grid dense">
        <StatCard label="Current plan" value={currentPlan} icon={CreditCard} />
        <StatCard label="Subscription status" value={subscriptionStatus} icon={ShieldCheck} />
        <StatCard
          label="Trial ends"
          value={formatDate(subscription?.trial_ends_at)}
          icon={CalendarDays}
        />
        <StatCard
          label="Grace period"
          value={getGracePeriodStatus(subscription)}
          icon={AlertTriangle}
          tone={subscription?.grace_period_ends_at ? 'warning' : 'accent'}
        />
      </div>

      <section className="card urgent">
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

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Workspace subscription</h3>
            <p>Current subscription lifecycle and billing status for this workspace.</p>
          </div>
        </div>

        {subscription ? (
          <div className="metadata-grid">
            <span>
              <CreditCard size={16} />
              Plan: {subscription.plan || currentPlan}
            </span>

            <span>
              <ShieldCheck size={16} />
              Status: <StatusBadge>{subscription.status}</StatusBadge>
            </span>

            <span>
              <CalendarDays size={16} />
              Trial ends: {formatDate(subscription.trial_ends_at)}
            </span>

            <span>
              <CalendarDays size={16} />
              Period ends: {formatDate(subscription.current_period_end)}
            </span>

            <span>
              <AlertTriangle size={16} />
              Grace period: {getGracePeriodStatus(subscription)}
            </span>

            <span>
              <Lock size={16} />
              Billing portal: disabled
            </span>
          </div>
        ) : (
          <EmptyState
            title="No subscription record found"
            description="Apply the billing migration and connect Stripe backend services before enabling paid subscriptions."
          />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Launch billing model</h3>
            <p>
              Recommended billing structure: 14-day free trial, Starter, Pro, and
              Business/Enterprise plans through Stripe subscriptions.
            </p>
          </div>
        </div>

        <div className="panel-grid two">
          {plans.map((plan) => (
            <section className="card compact" key={plan.key}>
              <div className="card-header">
                <div>
                  <h3>{plan.title}</h3>
                  <p>{plan.description}</p>
                </div>
                <StatusBadge tone={plan.key === currentPlan ? 'success' : 'info'}>
                  {plan.key === currentPlan ? 'current' : 'available'}
                </StatusBadge>
              </div>

              <strong>{plan.price}</strong>

              <ul className="checklist">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 size={16} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button className="primary" type="button" disabled>
                {plan.key === currentPlan ? 'Current plan' : 'Start / Upgrade'}
              </button>
            </section>
          ))}
        </div>
      </section>

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Payment failure handling</h3>
              <p>Recommended launch-ready grace-period workflow.</p>
            </div>
            <AlertTriangle size={20} />
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
            <Lock size={20} />
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
      </div>
    </AppLayout>
  );
}
