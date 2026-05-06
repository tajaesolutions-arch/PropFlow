import React from 'react';
import { CreditCard } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

const plans = [
  { key: 'starter', title: 'Starter' },
  { key: 'pro', title: 'Pro' },
  { key: 'business', title: 'Business' },
  { key: 'enterprise', title: 'Enterprise' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function BillingPage() {
  const { currentUser, currentWorkspace } = useApp();

  const allowed = currentUser?.roles?.includes(roles.OWNER_ADMIN) || currentUser?.roles?.includes(roles.ADMIN);

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

  return (
    <AppLayout title="Billing & Subscription">
      <div className="stats-grid compact">
        <StatCard label="Current plan" value={subscription?.plan || 'Starter'} icon={CreditCard} />
        <StatCard label="Subscription status" value={subscription?.status || 'Not configured'} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Stripe backend setup required</h3>
            <p>Secure backend billing endpoints still need to be configured before enabling live subscriptions.</p>
          </div>
          <StatusBadge tone="warning">setup required</StatusBadge>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Workspace subscription</h3>
            <p>Subscription lifecycle and billing status.</p>
          </div>
        </div>

        {subscription ? (
          <div className="detail-grid">
            <div><strong>Plan</strong><p>{subscription.plan}</p></div>
            <div><strong>Status</strong><p><StatusBadge>{subscription.status}</StatusBadge></p></div>
            <div><strong>Trial ends</strong><p>{formatDate(subscription.trial_ends_at)}</p></div>
            <div><strong>Current period end</strong><p>{formatDate(subscription.current_period_end)}</p></div>
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
            <h3>Plans</h3>
            <p>Prepare upgrade paths before public launch.</p>
          </div>
        </div>

        <div className="plan-grid">
          {plans.map((plan) => (
            <div className="plan-card" key={plan.key}>
              <h4>{plan.title}</h4>
              <button className="primary" type="button">Start / Upgrade</button>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
