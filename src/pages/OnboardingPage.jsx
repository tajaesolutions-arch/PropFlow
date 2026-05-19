import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { getWorkspaceSetupProgress } from '../lib/setupProgress.js';
import { navigate } from '../routes/AppRouter.jsx';

export function OnboardingPage() {
  const { data, currentWorkspace, currentUser } = useApp();
  const { steps, progress } = getWorkspaceSetupProgress({
    currentWorkspace,
    data,
    userRole: currentUser?.role,
  });

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
                <strong>{step.title || step.label}</strong>
                <p>{step.description}</p>
              </div>
              <div className="settings-checklist-status">
                {step.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{step.done ? 'Completed' : 'Not started'}</span>
                {!step.done && step.cta?.type === 'action' ? (
                  <button type="button" data-create-action={step.cta.value}>{step.cta.text}</button>
                ) : null}
                {!step.done && step.cta?.type === 'route' ? (
                  <button type="button" onClick={() => navigate(step.cta.value)} data-skip-create-action="true">{step.cta.text}</button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
