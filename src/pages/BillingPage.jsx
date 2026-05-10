import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { billingAccessRoles, billingManageRoles, billingPlanDetails } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { formatCurrency } from '../lib/formatters.js';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function getWorkspacePlan(currentWorkspace, subscription) {
  return subscription?.plan || currentWorkspace?.plan || currentWorkspace?.subscription_plan || 'starter';
}

function getGracePeriodStatus(subscription) {
  if (!subscription?.gracePeriodEndsAt && !subscription?.grace_period_ends_at) return 'Not active';
  return `Ends ${formatDate(subscription.gracePeriodEndsAt || subscription.grace_period_ends_at)}`;
}

function getPlan(currentPlan) {
  return billingPlanDetails.find((plan) => plan.key === currentPlan) || billingPlanDetails[0];
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (['active', 'trialing'].includes(value)) return 'success';
  if (['past_due', 'unpaid', 'incomplete', 'paused', 'grace_period', 'not_configured'].includes(value)) return 'warning';
  if (['cancelled', 'canceled', 'restricted'].includes(value)) return 'error';
  return 'info';
}

function limitText(value) {
  return value === null || value === undefined ? 'Custom' : String(value);
}

export function BillingPage() {
  const {
    currentUser,
    currentWorkspace,
    data,
    ensureWorkspaceSubscription,
    startCheckout,
    openBillingPortal,
    refreshBillingStatus,
    getBillingAccessState,
  } = useApp();
  const [actionMessage, setActionMessage] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [busyAction, setBusyAction] = React.useState('');

  const canViewBilling = hasAnyRole(currentUser, billingAccessRoles);
  const canManageBilling = hasAnyRole(currentUser, billingManageRoles);

  if (!canViewBilling) {
    return (
      <AppLayout title="Billing" subtitle="Workspace subscription and payment recovery.">
        <EmptyState
          eyebrow="Access restricted"
          icon={Lock}
          title="Billing access restricted"
          description="Only PropFlow Admins, Workspace Owners, and Accountants can access billing. Operational staff cannot manage workspace billing."
        />
      </AppLayout>
    );
  }

  const subscription = data?.subscription || null;
  const billingEvents = data?.billingEvents || [];
  const billingPlanLimits = data?.billingPlanLimits || [];
  const billingAccessState = getBillingAccessState?.() || data?.billingAccessState || {};
  const currentPlan = getWorkspacePlan(currentWorkspace, subscription);
  const selectedPlan = getPlan(currentPlan);
  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const properties = data?.properties || [];
  const members = data?.members || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const activeMembers = members.filter((member) => member.status === 'active');
  const storageMb = Math.round((data?.fileUploads || []).reduce((total, file) => total + Number(file.fileSize || file.file_size || 0), 0) / (1024 * 1024));

  const runAction = async (label, callback) => {
    setBusyAction(label);
    setActionError('');
    setActionMessage('');
    try {
      await callback();
      setActionMessage(label === 'refresh' ? 'Billing data refreshed.' : 'Billing action completed.');
    } catch (error) {
      setActionError(error?.message || 'Billing action could not be completed.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <AppLayout
      title="Billing & Subscription"
      subtitle="Workspace subscription state, safe Stripe-ready actions, and payment recovery controls."
    >
      <section className="card billing-notice-card urgent">
        <div className="card-header">
          <div>
            <h3>Stripe provider status</h3>
            <p>
              Billing records are workspace-scoped. Live checkout and portal redirects are only available when the secure server-side Stripe endpoints are configured.
            </p>
          </div>
          <StatusBadge tone={data?.billingTablesReady ? 'warning' : 'error'}>
            {data?.billingTablesReady ? 'provider guarded' : 'migration required'}
          </StatusBadge>
        </div>
        <div className="helper">
          Frontend billing actions never contain Stripe secrets and never mark a subscription paid. If the backend endpoint or environment is missing, PropFlow records a safe provider-not-configured event instead.
        </div>
      </section>

      {(actionError || actionMessage) && (
        <section className={`workspace-load-warning ${actionError ? 'error' : ''}`} role="alert">
          <strong>{actionError ? 'Billing action needs attention' : 'Billing action'}</strong>
          <span>{actionError || actionMessage}</span>
        </section>
      )}

      {billingAccessState.warning && (
        <section className="card billing-notice-card urgent">
          <div className="card-header">
            <div>
              <h3>{billingAccessState.restricted ? 'Workspace billing recovery mode' : 'Payment grace-period warning'}</h3>
              <p>
                {billingAccessState.restricted
                  ? 'Operational access may be limited until a Workspace Owner resolves billing. Billing and account recovery remain available.'
                  : `Payment needs attention before ${formatDate(billingAccessState.gracePeriodEndsAt)}.`}
              </p>
            </div>
            <StatusBadge tone={billingAccessState.restricted ? 'error' : 'warning'}>{billingAccessState.reason}</StatusBadge>
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Current plan" value={selectedPlan.title} subtitle={selectedPlan.price} icon={CreditCard} />
        <StatCard label="Subscription status" value={subscription?.status || 'not configured'} subtitle={subscription ? 'Stored in workspace_subscriptions' : 'No row yet'} icon={ShieldCheck} tone={statusTone(subscription?.status || 'not_configured')} />
        <StatCard label="Trial ends" value={formatDate(subscription?.trialEndsAt || subscription?.trial_ends_at)} subtitle="14-day default trial" icon={CalendarDays} />
        <StatCard label="Grace period" value={getGracePeriodStatus(subscription)} icon={AlertTriangle} tone={subscription?.gracePeriodEndsAt || subscription?.grace_period_ends_at ? 'warning' : 'accent'} />
      </section>

      <section className="billing-layout-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace subscription</h3>
              <p>Real subscription lifecycle fields for this workspace.</p>
            </div>
            <CreditCard size={20} className="muted" />
          </div>

          {subscription ? (
            <div className="billing-metadata-grid">
              <span><CreditCard size={16} /><strong>Plan</strong><small>{subscription.plan}</small></span>
              <span><ShieldCheck size={16} /><strong>Status</strong><StatusBadge tone={statusTone(subscription.status)}>{subscription.status}</StatusBadge></span>
              <span><CalendarDays size={16} /><strong>Trial started</strong><small>{formatDate(subscription.trialStartedAt || subscription.trial_started_at)}</small></span>
              <span><CalendarDays size={16} /><strong>Trial ends</strong><small>{formatDate(subscription.trialEndsAt || subscription.trial_ends_at)}</small></span>
              <span><CalendarDays size={16} /><strong>Period ends</strong><small>{formatDate(subscription.currentPeriodEnd || subscription.current_period_end)}</small></span>
              <span><AlertTriangle size={16} /><strong>Grace period</strong><small>{getGracePeriodStatus(subscription)}</small></span>
              <span><Lock size={16} /><strong>Stripe customer</strong><small>{subscription.stripeCustomerId ? 'Stored server-side reference' : 'Not created yet'}</small></span>
              <span><Database size={16} /><strong>Updated</strong><small>{formatDateTime(subscription.updatedAt || subscription.updated_at)}</small></span>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CreditCard}
              title="No subscription record found"
              description="Create a safe trialing subscription row after applying the billing migration. This does not create a paid Stripe subscription."
              action={canManageBilling ? (
                <button className="primary" type="button" onClick={() => runAction('initialize', () => ensureWorkspaceSubscription('starter'))} disabled={Boolean(busyAction)} data-skip-create-action="true">
                  Initialize 14-day trial
                </button>
              ) : null}
            />
          )}

          <div className="form-actions compact">
            {canViewBilling && <button type="button" onClick={() => runAction('portal', openBillingPortal)} disabled={Boolean(busyAction)} data-skip-create-action="true">Open billing portal</button>}
            <button type="button" onClick={() => runAction('refresh', refreshBillingStatus)} disabled={Boolean(busyAction)} data-skip-create-action="true"><RefreshCw size={16} /> Refresh billing</button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div><h3>Workspace usage snapshot</h3><p>Usage is shown against plan limits where available.</p></div>
            <Users size={20} className="muted" />
          </div>
          <div className="billing-usage-grid">
            <span><strong>{activeProperties.length}</strong><small>Active properties</small></span>
            <span><strong>{activeMembers.length}</strong><small>Active team members</small></span>
            <span><strong>{storageMb} MB</strong><small>Tracked file storage</small></span>
            <span><strong>{selectedPlan.priceMonthly ? formatCurrency(selectedPlan.priceMonthly, currency) : selectedPlan.price}</strong><small>Estimated monthly price</small></span>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Plans and safe checkout</h3>
            <p>Plan changes call guarded backend endpoints. Missing Stripe env vars return provider-not-configured; no fake success state is shown.</p>
          </div>
          <Sparkles size={20} className="muted" />
        </div>

        <div className="billing-plan-grid">
          {billingPlanDetails.map((plan) => {
            const limits = billingPlanLimits.find((limit) => limit.plan === plan.key);
            return (
              <article className={plan.key === currentPlan ? 'card billing-plan-card selected' : 'card billing-plan-card'} key={plan.key}>
                <div className="billing-plan-top">
                  <div><h3>{plan.title}</h3><p>{plan.description}</p></div>
                  <StatusBadge tone={plan.key === currentPlan ? 'success' : 'info'}>{plan.key === currentPlan ? 'current' : 'available'}</StatusBadge>
                </div>
                <strong className="billing-plan-price">{plan.price}</strong>
                <ul className="checklist">
                  {plan.features.map((feature) => <li key={feature}><CheckCircle2 size={16} />{feature}</li>)}
                  {limits && <li><CheckCircle2 size={16} />{limitText(limits.maxProperties)} properties / {limitText(limits.maxTeamMembers)} team members</li>}
                </ul>
                {canManageBilling && (
                  <button className="primary" type="button" disabled={Boolean(busyAction) || plan.key === currentPlan} onClick={() => runAction(`checkout-${plan.key}`, () => startCheckout(plan.key))} data-skip-create-action="true">
                    {plan.key === currentPlan ? 'Current plan' : 'Start secure checkout'}
                  </button>
                )}
                {!canManageBilling && <small className="helper">Accountants can review billing but cannot change plans.</small>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header"><div><h3>Payment failure handling</h3><p>Grace-period model based on stored subscription fields.</p></div><AlertTriangle size={20} className="muted" /></div>
          <ul className="checklist">
            <li><CheckCircle2 size={16} />Payment failure stores past_due/unpaid state and payment_failed_at.</li>
            <li><CheckCircle2 size={16} />Grace period dates warn billing roles before restriction.</li>
            <li><CheckCircle2 size={16} />After grace period, staff are limited while billing recovery remains available.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-header"><div><h3>Billing event history</h3><p>Latest workspace billing audit records.</p></div><Database size={20} className="muted" /></div>
          {billingEvents.length ? (
            <div className="billing-event-list">
              {billingEvents.slice(0, 8).map((event) => (
                <article key={event.id}>
                  <span><strong>{String(event.eventType || event.event_type).replaceAll('_', ' ')}</strong><small>{formatDateTime(event.createdAt || event.created_at)}</small></span>
                  <StatusBadge tone={event.eventType === 'provider_not_configured' || event.event_type === 'provider_not_configured' ? 'warning' : 'info'}>{event.status || 'recorded'}</StatusBadge>
                  {event.message && <p>{event.message}</p>}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Database} title="No billing events yet" description="Provider setup checks, trial starts, checkout attempts, portal attempts, and webhook updates will appear here after the billing migration is applied." />
          )}
        </section>
      </section>
    </AppLayout>
  );
}
