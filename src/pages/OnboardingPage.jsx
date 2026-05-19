import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

function percent(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

export function OnboardingPage() {
  const { data, currentWorkspace } = useApp();

  const properties = data.properties || [];
  const bookings = data.bookings || [];
  const cleaningTasks = data.cleaningTasks || [];
  const maintenanceWorkOrders = data.maintenanceWorkOrders || [];
  const owners = data.contacts?.filter((record) => record.type === 'owner') || [];
  const supplies = data.supplies || [];
  const members = data.members || [];
  const invites = data.invites || [];

  const hasWorkspace = Boolean(currentWorkspace?.id);
  const hasCurrency = Boolean(currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency);

  const steps = [
    { key: 'workspace', title: 'Create workspace', description: 'Set up your company workspace so your team can work in one place.', done: hasWorkspace, cta: 'Workspace created', action: null },
    { key: 'currency', title: 'Set default currency', description: 'Use the currency your business reports in for consistent totals.', done: hasCurrency, cta: 'Set currency', action: () => navigate('/settings') },
    { key: 'property', title: 'Add first property', description: 'Add your first listing or rental unit.', done: properties.length > 0, cta: 'Add property', createAction: 'property' },
    { key: 'invite', title: 'Invite team member', description: 'Invite staff with the correct workspace role.', done: members.length > 0 || invites.length > 0, cta: 'Invite team member', createAction: 'invite' },
    { key: 'owner', title: 'Add owner', description: 'Capture owner contacts and ownership details.', done: owners.length > 0, cta: 'Add owner', createAction: 'owner' },
    { key: 'booking', title: 'Add booking', description: 'Start tracking reservations in your workspace.', done: bookings.length > 0, cta: 'Add booking', createAction: 'booking' },
    { key: 'cleaning', title: 'Add cleaning task', description: 'Create your first turnover or recurring cleaning task.', done: cleaningTasks.length > 0, cta: 'Add cleaning task', createAction: 'cleaning' },
    { key: 'maintenance', title: 'Add maintenance work order', description: 'Track issues, priorities, and repair status.', done: maintenanceWorkOrders.length > 0, cta: 'Add work order', createAction: 'maintenance' },
    { key: 'supply', title: 'Add supply/inventory item', description: 'Track stock levels for operations.', done: supplies.length > 0, cta: 'Add supply', action: () => navigate('/inventory') },
    { key: 'review', title: 'Review reports/dashboard', description: 'Check performance and operations health.', done: hasWorkspace, cta: 'Open reports', action: () => navigate('/reports') },
    { key: 'plan', title: 'Review subscription plan', description: 'Confirm your plan and billing settings.', done: false, cta: 'Review plan', action: () => navigate('/billing') },
  ];

  const complete = steps.filter((step) => step.done).length;
  const progress = percent(complete, steps.length);

  return (
    <AppLayout title="Onboarding" subtitle="Launch-readiness checklist for your workspace">
      <section className="card compact">
        <div className="card-header">
          <div>
            <h3>Workspace setup progress: {progress}%</h3>
            <p>Complete the core setup steps now, or continue to dashboard and finish later.</p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard')} data-skip-create-action="true">
            Continue to dashboard
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="helper">You can finish this later. PropFlow will keep showing setup reminders until the core steps are done.</div>

        <div className="settings-checklist">
          {steps.map((step) => (
            <article key={step.key} className="settings-checklist-item">
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
              <div className="settings-checklist-status">
                {step.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{step.done ? 'Completed' : 'Not started'}</span>
                {!step.done && step.createAction ? (
                  <button type="button" data-create-action={step.createAction}>{step.cta}</button>
                ) : null}
                {!step.done && !step.createAction && step.action ? (
                  <button type="button" onClick={step.action} data-skip-create-action="true">{step.cta}</button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
