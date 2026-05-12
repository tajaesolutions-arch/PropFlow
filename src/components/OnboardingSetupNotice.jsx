import React from 'react';
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Home,
  Users,
  Wrench,
} from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || workspace?.currency || '';
}

function getWorkspacePlan(workspace) {
  return workspace?.subscription?.plan || workspace?.plan || workspace?.subscription_plan || '';
}

function isStepComplete(step) {
  return Boolean(step.complete);
}

export function OnboardingSetupNotice() {
  const { currentWorkspace, data } = useApp();

  const propertiesCount = count(data?.properties);
  const membersCount = count(data?.members);
  const ownersCount = count((data?.contacts || []).filter((contact) => (contact.contact_type || contact.contactType) === 'owner'));
  const bookingsCount = count(data?.bookings) + count(data?.leases);
  const cleaningCount = count(data?.cleaningTasks);
  const maintenanceCount = count(data?.maintenanceWorkOrders);
  const hasCurrency = Boolean(getWorkspaceCurrency(currentWorkspace));
  const hasPlan = Boolean(getWorkspacePlan(currentWorkspace));

  const steps = [
    {
      title: 'Add first property',
      description: 'Create the first real property record. Do not use demo/sample properties.',
      icon: Building2,
      complete: propertiesCount > 0,
      action: 'Add Property',
    },
    {
      title: 'Invite team member',
      description: 'Invite cleaners, maintenance crew, managers, or accountants when needed.',
      icon: Users,
      complete: membersCount > 1,
      action: 'Invite Team Member',
    },
    {
      title: 'Add owner',
      description: 'Add an owner contact before generating owner-facing reports.',
      icon: Home,
      complete: ownersCount > 0,
      action: 'Add Owner',
    },
    {
      title: 'Add booking or lease',
      description: 'Add the first booking, reservation, or lease record for real operating data.',
      icon: CalendarPlus,
      complete: bookingsCount > 0,
      action: 'Add Booking',
    },
    {
      title: 'Add cleaning task',
      description: 'Create the first cleaning task or turnover checklist.',
      icon: ClipboardCheck,
      complete: cleaningCount > 0,
      action: 'Add Cleaning Task',
    },
    {
      title: 'Add maintenance task',
      description: 'Create the first maintenance work order or repair issue.',
      icon: Wrench,
      complete: maintenanceCount > 0,
      action: 'Add Maintenance Work Order',
    },
    {
      title: 'Set workspace currency',
      description: 'Confirm the default currency for this workspace before reports and billing.',
      icon: DollarSign,
      complete: hasCurrency,
      action: 'Open Settings',
    },
    {
      title: 'Choose subscription plan',
      description: 'Keep the selected plan visible while Stripe checkout is being configured.',
      icon: CreditCard,
      complete: hasPlan,
      action: 'Open Billing',
    },
  ];

  const completedSteps = steps.filter(isStepComplete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const workspaceName = currentWorkspace?.name || currentWorkspace?.business_name || 'this workspace';

  return (
    <section className="card onboarding-setup-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Workspace setup</p>
          <h3>Setup progress for {workspaceName}</h3>
          <p>
            Use real workspace records only. This checklist reflects existing workspace data and does not create seeded records.
          </p>
        </div>
        <StatusBadge tone={completedSteps === steps.length ? 'success' : 'warning'}>
          {completedSteps}/{steps.length} complete
        </StatusBadge>
      </div>

      <div className="onboarding-progress-track" aria-label={`Workspace setup ${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-step-grid">
        {steps.map((step) => {
          const Icon = step.icon;
          const complete = isStepComplete(step);

          return (
            <div className={complete ? 'onboarding-step-card complete' : 'onboarding-step-card'} key={step.title}>
              <div className="onboarding-step-icon">
                {complete ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </div>
              <span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
              <StatusBadge tone={complete ? 'success' : 'info'}>{complete ? 'done' : step.action}</StatusBadge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
