import React from 'react';
import { ChevronDown, ChevronUp, EyeOff } from 'lucide-react';
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
import { navigate } from '../routes/AppRouter.jsx';

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
  const workspaceId = currentWorkspace?.id || 'default';
  const collapsedStorageKey = `propflow:workspaceSetupCollapsed:${workspaceId}`;
  const hiddenStorageKey = `propflow:workspaceSetupHidden:${workspaceId}`;
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(collapsedStorageKey) === 'true';
  });
  const [hidden, setHidden] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(hiddenStorageKey) === 'true';
  });

  React.useEffect(() => {
    setCollapsed(typeof window !== 'undefined' && window.localStorage.getItem(collapsedStorageKey) === 'true');
    setHidden(typeof window !== 'undefined' && window.localStorage.getItem(hiddenStorageKey) === 'true');
  }, [collapsedStorageKey, hiddenStorageKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(collapsedStorageKey, String(collapsed));
  }, [collapsed, collapsedStorageKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(hiddenStorageKey, String(hidden));
  }, [hidden, hiddenStorageKey]);

  const propertiesCount = count(data?.properties);
  const membersCount = count(data?.members);
  const ownersCount = count((data?.contacts || []).filter((contact) => (contact.contact_type || contact.contactType || contact.type) === 'owner'));
  const bookingsCount = count(data?.bookings) + count(data?.leases);
  const cleaningCount = count(data?.cleaningTasks);
  const maintenanceCount = count(data?.maintenanceWorkOrders);
  const hasCurrency = Boolean(getWorkspaceCurrency(currentWorkspace));
  const hasPlan = Boolean(getWorkspacePlan(currentWorkspace));

  const steps = [
    { title: 'Add first property', description: 'Create the first real property record.', icon: Building2, complete: propertiesCount > 0, action: 'Add Property', createAction: 'property' },
    { title: 'Invite team member', description: 'Invite cleaners, maintenance crew, managers, or accountants.', icon: Users, complete: membersCount > 1, action: 'Invite Team Member', createAction: 'invite' },
    { title: 'Add owner', description: 'Add an owner contact before owner-facing reports.', icon: Home, complete: ownersCount > 0, action: 'Add Owner', createAction: 'owner' },
    { title: 'Add booking or lease', description: 'Add the first booking/reservation or lease record.', icon: CalendarPlus, complete: bookingsCount > 0, action: 'Add Booking', createAction: 'booking' },
    { title: 'Add cleaning task', description: 'Create the first cleaning task or turnover checklist.', icon: ClipboardCheck, complete: cleaningCount > 0, action: 'Add Cleaning Task', createAction: 'cleaning' },
    { title: 'Add maintenance task', description: 'Create the first maintenance work order or repair issue.', icon: Wrench, complete: maintenanceCount > 0, action: 'Add Maintenance Work Order', createAction: 'maintenance' },
    { title: 'Set workspace currency', description: 'Confirm the default currency for this workspace.', icon: DollarSign, complete: hasCurrency, action: 'Open Settings', route: '/settings?section=workspace' },
    { title: 'Choose subscription plan', description: 'Choose an active workspace plan in billing.', icon: CreditCard, complete: hasPlan, action: 'Open Billing', route: '/settings?section=billing' },
  ];

  const completedSteps = steps.filter(isStepComplete).length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const workspaceName = currentWorkspace?.name || currentWorkspace?.business_name || 'this workspace';

  if (hidden) {
    return <button type="button" className="show-setup-checklist-button" onClick={() => setHidden(false)} data-skip-create-action="true">Show setup checklist</button>;
  }

  return (
    <section className="card onboarding-setup-notice" aria-label="Workspace setup">
      <div className="card-header onboarding-setup-header">
        <div>
          <p className="eyebrow">Workspace setup</p>
          <h3>Setup progress for {workspaceName}</h3>
          <p>{completedSteps} of {steps.length} complete</p>
        </div>
        <div className="onboarding-setup-controls">
          <StatusBadge tone={completedSteps === steps.length ? 'success' : 'warning'}>{completedSteps}/{steps.length} complete</StatusBadge>
          <button type="button" onClick={() => setCollapsed((value) => !value)} data-skip-create-action="true">{collapsed ? <><ChevronDown size={16} /> Expand</> : <><ChevronUp size={16} /> Minimize</>}</button>
          <button type="button" onClick={() => setHidden(true)} data-skip-create-action="true"><EyeOff size={16} /> Hide setup</button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="onboarding-progress-track" aria-label={`Workspace setup ${progress}% complete`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="onboarding-step-grid">
            {steps.map((step) => {
              const Icon = step.icon;
              const complete = isStepComplete(step);

              return (
                <div className={complete ? 'onboarding-step-card complete' : 'onboarding-step-card'} key={step.title}>
                  <div className="onboarding-step-icon">{complete ? <CheckCircle2 size={18} /> : <Icon size={18} />}</div>
                  <span>
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  {complete ? (
                    <StatusBadge tone="success">Done</StatusBadge>
                  ) : step.createAction ? (
                    <button type="button" className="onboarding-step-action" data-create-action={step.createAction}>{step.action}</button>
                  ) : (
                    <button type="button" className="onboarding-step-action" onClick={() => navigate(step.route)} data-skip-create-action="true">{step.action}</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
