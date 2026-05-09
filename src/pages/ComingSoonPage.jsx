import React from 'react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';
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

const helpTopics = [
  {
    title: 'Workspace setup',
    description: 'Create a workspace, choose currency, invite team members, and assign roles.',
    icon: ShieldCheck,
  },
  {
    title: 'Adding properties',
    description: 'Add real properties, set rental type, attach owners, and prepare operations.',
    icon: BookOpen,
  },
  {
    title: 'Bookings and calendar',
    description: 'Track reservations, check-ins, check-outs, cleaning, maintenance, and leases.',
    icon: ClipboardCheck,
  },
  {
    title: 'Reports and billing',
    description: 'Review owner reports, exports, subscription placeholders, and billing recovery.',
    icon: FileText,
  },
];

const operationalRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const ownerVisibleRoles = [...operationalRoles, roles.OWNER, roles.ACCOUNTANT];
const bookingVisibleRoles = [...operationalRoles, roles.ACCOUNTANT];
const reportVisibleRoles = [...operationalRoles, roles.OWNER, roles.ACCOUNTANT];

function isSmartToolsPage(title) {
  return String(title).toLowerCase().includes('smart') || String(title).toLowerCase().includes('ai');
}

function getSafeDashboardPath(currentUser) {
  const path = getPostLoginPath(currentUser);

  if (path === '/workspace-setup' || path === '/suspended') return '/account';
  return path || '/account';
}

function getRoleSafeLinks(currentUser) {
  const links = [
    {
      label: 'Back to dashboard',
      path: getSafeDashboardPath(currentUser),
      primary: true,
    },
  ];

  if (hasAnyRole(currentUser, ownerVisibleRoles)) {
    links.push({ label: 'Properties', path: '/properties' });
  }

  if (hasAnyRole(currentUser, bookingVisibleRoles)) {
    links.push({ label: 'Bookings', path: '/bookings' });
  }

  if (hasAnyRole(currentUser, reportVisibleRoles)) {
    links.push({ label: 'Reports', path: '/reports' });
  }

  if (hasAnyRole(currentUser, [roles.CLEANER])) {
    links.push({ label: 'Cleaning Tasks', path: '/cleaning' });
  }

  if (hasAnyRole(currentUser, [roles.MAINTENANCE])) {
    links.push({ label: 'Work Orders', path: '/maintenance' });
  }

  return links;
}

function PlannedFeatureCard({ item }) {
  const Icon = item.icon;

  return (
    <article className="card coming-soon-feature-card">
      <div className="coming-soon-feature-icon">
        <Icon size={20} />
      </div>

      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>

      <StatusBadge tone="info">planned</StatusBadge>
    </article>
  );
}

export function ComingSoonPage({ title = 'Coming soon' }) {
  const { currentUser } = useApp();
  const smartTools = isSmartToolsPage(title);
  const safeLinks = getRoleSafeLinks(currentUser);
  const safeDashboardPath = getSafeDashboardPath(currentUser);

  return (
    <AppLayout
      title={title}
      subtitle={
        smartTools
          ? 'Planned AI tools preview for future PropFlow automation.'
          : 'Help, support, and launch-safe feature placeholder.'
      }
    >
      <section className="card coming-soon-hero">
        <div>
          <p className="eyebrow">{smartTools ? 'Smart Tools / AI Tools' : 'Support center'}</p>
          <h3>{title}</h3>
          <p>
            {smartTools
              ? 'This page previews planned AI tools for property performance, guest messaging, owner reports, cleaning checklists, maintenance summaries, and task automation.'
              : 'This page is intentionally simple for the MVP. It gives users a safe support destination without connecting incomplete support-ticket or chat-provider workflows.'}
          </p>
        </div>

        <StatusBadge tone="info">coming soon</StatusBadge>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Launch-safe guardrails</h3>
            <p>
              This screen does not use fake customer data, does not trigger unfinished automations,
              and does not depend on unconfigured providers.
            </p>
          </div>

          <ShieldCheck size={22} className="muted" />
        </div>

        <div className="coming-soon-guardrail-grid">
          <span>
            <CheckCircle2 size={16} />
            <strong>No fake data</strong>
            <small>Do not show sample records as if they are customer records.</small>
          </span>

          <span>
            <CheckCircle2 size={16} />
            <strong>No incomplete automation</strong>
            <small>Do not trigger AI, email, SMS, WhatsApp, or payment actions until backend logic exists.</small>
          </span>

          <span>
            <CheckCircle2 size={16} />
            <strong>Workspace scoped later</strong>
            <small>Future records must include workspace_id and RLS protection.</small>
          </span>

          <span>
            <CheckCircle2 size={16} />
            <strong>Role-aware UX</strong>
            <small>Future features must respect role permissions and dashboard type.</small>
          </span>
        </div>
      </section>

      {smartTools ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Smart Tools / AI Tools preview</h3>
              <p>
                These AI tools should be built after the core property, booking, cleaning,
                maintenance, reporting, notification, and billing workflows are stable.
              </p>
            </div>

            <Sparkles size={22} className="muted" />
          </div>

          <div className="coming-soon-feature-grid">
            {smartToolPreviews.map((item) => (
              <PlannedFeatureCard item={item} key={item.title} />
            ))}
          </div>

          <div className="helper">
            Future AI tools should use real workspace data only after explicit permission checks.
            They should not expose private owner, guest, team, or property data across workspaces.
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Help / Support foundation</h3>
              <p>
                Support can start as a clean guidance page, then later expand into support tickets,
                help docs, onboarding tutorials, and contact workflows.
              </p>
            </div>

            <LifeBuoy size={22} className="muted" />
          </div>

          <div className="coming-soon-feature-grid">
            {helpTopics.map((item) => (
              <PlannedFeatureCard item={item} key={item.title} />
            ))}
          </div>

          <div className="helper">
            Recommended next support phase: add a Supabase-backed support_tickets table, ticket
            status, priority, workspace_id, created_by, assigned_to, and role-aware visibility.
          </div>
        </section>
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Planned next steps</h3>
              <p>This feature should be completed only after the MVP foundation is stable.</p>
            </div>

            <HelpCircle size={22} className="muted" />
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

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Search core workflows</h3>
              <p>Use the existing MVP pages while this feature is still planned.</p>
            </div>

            <Search size={22} className="muted" />
          </div>

          <EmptyState
            compact
            icon={Search}
            title="Use current PropFlow pages"
            description="Core workflows are available from your role dashboard and permitted workspace pages."
            action={
              <button type="button" className="primary" onClick={() => navigate(safeDashboardPath)}>
                Back to dashboard
              </button>
            }
          />
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Return to core workflows</h3>
            <p>Use the current MVP pages that are available for your role.</p>
          </div>
        </div>

        <div className="action-row">
          {safeLinks.map((link) => (
            <button
              key={`${link.path}-${link.label}`}
              type="button"
              className={link.primary ? 'primary' : undefined}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
