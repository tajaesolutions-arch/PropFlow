import React from 'react';
import { AlertTriangle, CalendarDays, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const billingManagerRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT];
const staffRestrictedRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

function formatBillingRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, [roles.ADMIN])) {
    return 'PropFlow Admin can review platform billing setup and provider readiness.';
  }

  if (hasAnyRole(currentUser, [roles.OWNER_ADMIN])) {
    return 'Workspace Owners can manage subscription recovery once Stripe backend services are connected.';
  }

  if (hasAnyRole(currentUser, [roles.ACCOUNTANT])) {
    return 'Accountants can review billing status and invoices, but checkout changes should remain owner/admin controlled.';
  }

  if (hasAnyRole(currentUser, staffRestrictedRoles)) {
    return 'Staff and property owners should not manage workspace billing.';
  }

  return 'Billing visibility is role-restricted.';
}

export function BillingSafetyNotice() {
  const { currentUser, currentWorkspace } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const subscription = currentWorkspace?.subscription || null;
  const stripeConfigured = false;
  const canViewBilling = hasAnyRole(currentUser, billingManagerRoles);

  return (
    <section className="card billing-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Billing safety</p>
          <h3>Subscription setup and recovery status</h3>
          <p>
            Billing UI is intentionally safe until Stripe checkout, billing portal sessions, and webhook handling
            are implemented server-side.
          </p>
        </div>
        <CreditCard size={22} className="muted" />
      </div>

      <div className="billing-safety-grid">
        <div className="billing-safety-card">
          <CreditCard size={18} />
          <span>
            <strong>Stripe setup</strong>
            <small>
              {stripeConfigured
                ? 'Stripe public checkout is enabled.'
                : 'Stripe is not live. Keep all billing provider keys server-side until checkout and webhooks are implemented.'}
            </small>
          </span>
          <StatusBadge tone={stripeConfigured ? 'success' : 'warning'}>
            {stripeConfigured ? 'live' : 'provider_not_configured'}
          </StatusBadge>
        </div>

        <div className="billing-safety-card">
          <CalendarDays size={18} />
          <span>
            <strong>Trial and subscription</strong>
            <small>
              {subscription
                ? 'Subscription data exists for this workspace. Stripe webhook sync still needs backend validation.'
                : 'No subscription record found. Trial/subscription status remains a placeholder until backend billing is connected.'}
            </small>
          </span>
          <StatusBadge tone={subscription ? 'info' : 'warning'}>{subscription?.status || 'placeholder'}</StatusBadge>
        </div>

        <div className="billing-safety-card">
          <AlertTriangle size={18} />
          <span>
            <strong>Payment failure and grace period</strong>
            <small>
              Failed-payment recovery should use a 7-day grace period, owner/admin warnings, and restricted staff access after expiry.
            </small>
          </span>
          <StatusBadge tone="warning">policy placeholder</StatusBadge>
        </div>

        <div className="billing-safety-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{formatBillingRoleMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={canViewBilling ? 'success' : 'error'}>{primaryRole || 'restricted'}</StatusBadge>
        </div>
      </div>

      <div className="helper billing-safety-helper">
        <LockKeyhole size={16} />
        Do not enable live checkout, portal access, subscription writes, or billing recovery until backend Stripe endpoints and webhook verification are implemented.
      </div>
    </section>
  );
}
