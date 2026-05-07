import React from 'react';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const smartToolPreviews = [
  {
    title: 'AI property performance insights',
    description: 'Summarize revenue, occupancy, maintenance cost, and property health trends.',
    icon: Sparkles,
  },
  {
    title: 'AI guest message drafts',
    description: 'Draft replies for guest questions, check-in instructions, and booking follow-ups.',
    icon: MessageSquare,
  },
  {
    title: 'AI maintenance issue summaries',
    description: 'Turn repair notes, photos, and cost updates into clean work order summaries.',
    icon: Wrench,
  },
  {
    title: 'AI cleaning checklist generator',
    description: 'Generate property-specific cleaning checklists for cleaners and turnovers.',
    icon: ClipboardCheck,
  },
  {
    title: 'AI owner report summaries',
    description: 'Create executive summaries for monthly owner reports and performance updates.',
    icon: FileText,
  },
  {
    title: 'AI task automation suggestions',
    description: 'Recommend reminders, task follow-ups, and operational automations.',
    icon: Bell,
  },
];

function isSmartToolsPage(title) {
  return String(title).toLowerCase().includes('smart') || String(title).toLowerCase().includes('ai');
}

export function ComingSoonPage({ title = 'Coming soon' }) {
  const smartTools = isSmartToolsPage(title);

  return (
    <AppLayout title={title} subtitle="Polished placeholder for a planned PropFlow feature">
      <section className="card">
        <div className="card-header">
          <div>
            <h3>{title}</h3>
            <p>
              This page is intentionally not fully implemented in the current MVP. It does not use
              fake customer data and is prepared as a clean launch-safe placeholder.
            </p>
          </div>

          <StatusBadge tone="info">coming soon</StatusBadge>
        </div>

        <div className="helper">
          Keep this page visible only when it helps users understand what is planned next. Do not
          connect incomplete automations, AI tools, payments, or provider integrations until the
          backend is ready.
        </div>
      </section>

      {smartTools ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Smart Tools / AI Tools preview</h3>
              <p>
                These AI tools are planned for a later phase after the core property, booking,
                cleaning, maintenance, reporting, and notification workflows are stable.
              </p>
            </div>

            <Sparkles size={22} />
          </div>

          <div className="panel-grid two">
            {smartToolPreviews.map((item) => {
              const Icon = item.icon;

              return (
                <section className="card compact" key={item.title}>
                  <div className="card-header">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <Icon size={20} />
                  </div>

                  <StatusBadge tone="info">planned</StatusBadge>
                </section>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Planned next steps</h3>
              <p>This feature should be completed only after the MVP foundation is stable.</p>
            </div>

            <HelpCircle size={22} />
          </div>

          <ul className="checklist">
            <li>
              <CheckCircle2 size={16} />
              Confirm the database tables and permissions required for this feature.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Add Supabase read/write logic with workspace scoping.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Add clean empty states instead of fake demo data.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Add role-based access rules.
            </li>
            <li>
              <CheckCircle2 size={16} />
              Test build, routing, mobile layout, and permissions before launch.
            </li>
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Return to core workflows</h3>
            <p>Use the current MVP pages that are already connected to the main PropFlow structure.</p>
          </div>
        </div>

        <div className="action-row">
          <button type="button" className="primary" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>

          <button type="button" onClick={() => navigate('/properties')}>
            Properties
          </button>

          <button type="button" onClick={() => navigate('/bookings')}>
            Bookings
          </button>

          <button type="button" onClick={() => navigate('/reports')}>
            Reports
          </button>
        </div>
      </section>
    </AppLayout>
  );
}
