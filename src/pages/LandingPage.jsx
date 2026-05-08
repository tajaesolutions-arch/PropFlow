import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Hotel,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';

import { navigate } from '../routes/AppRouter.jsx';

const featureCards = [
  {
    title: 'Property portfolio',
    description:
      'Manage short-term rentals, long-term rentals, villas, apartments, homes, model units, guesthouses, and commercial spaces.',
    icon: Building2,
  },
  {
    title: 'Bookings and leases',
    description:
      'Track check-ins, check-outs, booking sources, payment status, lease periods, occupancy, and calendar activity.',
    icon: CalendarDays,
  },
  {
    title: 'Cleaning operations',
    description:
      'Assign cleanings, use checklists, upload before/after photos, track supplies, and confirm guest-ready status.',
    icon: ClipboardCheck,
  },
  {
    title: 'Maintenance work orders',
    description:
      'Track urgent repairs, parts needed, estimated costs, actual costs, due dates, and completion photos.',
    icon: Wrench,
  },
  {
    title: 'Owner dashboards',
    description:
      'Give property owners a limited view of assigned properties, revenue, expenses, payouts, and maintenance updates.',
    icon: Users,
  },
  {
    title: 'Reports and finance',
    description:
      'Prepare owner statements, revenue reports, expense reports, occupancy reports, and export-ready summaries.',
    icon: FileText,
  },
];

const roleCards = [
  'Workspace Owner / Company Admin',
  'Property Manager',
  'Host',
  'Property Owner',
  'Cleaner',
  'Maintenance Crew',
  'Accountant / Bookkeeper',
];

const operationsSteps = [
  'Create a workspace',
  'Add the first property',
  'Add bookings or lease records',
  'Assign cleaning and maintenance work',
  'Invite owners, cleaners, maintenance crew, and accountants',
  'Track reports, payouts, calendar activity, and notifications',
];

function LandingFeature({ feature }) {
  const Icon = feature.icon;

  return (
    <article className="card landing-feature-card">
      <div className="landing-feature-icon">
        <Icon size={20} />
      </div>

      <div>
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
      </div>
    </article>
  );
}

function LandingDashboardPreview() {
  return (
    <aside className="landing-dashboard-preview">
      <div className="landing-preview-header">
        <span>
          <strong>PropFlow Command Center</strong>
          <small>Workspace: Island Stay Management</small>
        </span>

        <span className="landing-live-pill">MVP preview</span>
      </div>

      <div className="landing-preview-kpis">
        <span>
          <small>Gross revenue</small>
          <strong>Preview</strong>
        </span>

        <span>
          <small>Occupancy</small>
          <strong>Preview</strong>
        </span>

        <span>
          <small>Open repairs</small>
          <strong>Preview</strong>
        </span>
      </div>

      <div className="landing-preview-list">
        <div>
          <ClipboardCheck size={16} />
          <span>
            <strong>Cleaning workflow</strong>
            <small>Assign tasks · track guest-ready status</small>
          </span>
        </div>

        <div>
          <Wrench size={16} />
          <span>
            <strong>Maintenance workflow</strong>
            <small>Track issues · manage repair status</small>
          </span>
        </div>

        <div>
          <CalendarDays size={16} />
          <span>
            <strong>Booking workflow</strong>
            <small>Manual bookings first · integrations later</small>
          </span>
        </div>
      </div>

      <div className="landing-preview-footer">
        <span>Pre-launch MVP interface</span>
        <button type="button" onClick={() => navigate('/signup')}>
          Start setup
        </button>
      </div>
    </aside>
  );
}

export function LandingPage() {
  return (
    <div className="public-page landing-page">
      <nav className="public-nav landing-nav">
        <strong>PropFlow</strong>

        <div>
          <button type="button" onClick={() => navigate('/pricing')}>
            Pricing
          </button>

          <button type="button" onClick={() => navigate('/login')}>
            Login
          </button>

          <button className="primary" type="button" onClick={() => navigate('/signup')}>
            Start free
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <p className="eyebrow">Property operations, finances, and teams in one workspace</p>

          <h1>Run every rental property like a professional operation.</h1>

          <p>
            PropFlow helps Airbnb hosts, landlords, property managers, homeowners, real estate teams,
            cleaners, maintenance crews, accountants, and property owners manage rentals from one
            clean SaaS command center.
          </p>

          <div className="hero-actions">
            <button className="primary large" type="button" onClick={() => navigate('/signup')}>
              Create workspace
              <ArrowRight size={18} />
            </button>

            <button className="secondary large" type="button" onClick={() => navigate('/pricing')}>
              View pricing
            </button>
          </div>

          <div className="landing-trust-row">
            <span>
              <ShieldCheck size={16} />
              Workspace-scoped data
            </span>

            <span>
              <KeyRound size={16} />
              Role-based dashboards
            </span>

            <span>
              <CreditCard size={16} />
              Stripe-ready billing
            </span>
          </div>
        </div>

        <LandingDashboardPreview />
      </section>

      <section className="landing-content">
        <div className="stat-grid dense">
          <div className="stat-card">
            <div>
              <p>Built for</p>
              <strong>STR + LTR</strong>
              <span className="trend">Short-term and long-term rentals</span>
            </div>
            <Hotel className="stat-icon" size={20} />
          </div>

          <div className="stat-card">
            <div>
              <p>Core workflow</p>
              <strong>Operations</strong>
              <span className="trend">Bookings, cleaning, maintenance</span>
            </div>
            <ClipboardCheck className="stat-icon" size={20} />
          </div>

          <div className="stat-card">
            <div>
              <p>Team access</p>
              <strong>Role-based</strong>
              <span className="trend">Dashboards by permission</span>
            </div>
            <KeyRound className="stat-icon" size={20} />
          </div>

          <div className="stat-card">
            <div>
              <p>Data model</p>
              <strong>Workspace-first</strong>
              <span className="trend">Built for SaaS scaling</span>
            </div>
            <ShieldCheck className="stat-icon" size={20} />
          </div>
        </div>

        <section className="card public-mvp-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">MVP / pre-launch notice</p>
              <h3>Public pages are safe previews only.</h3>
              <p>
                Live payments, public booking payments, provider integrations, and demo data are not exposed from this page.
                Use signup/login CTAs to enter the real workspace flow.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>

        <section className="card landing-section-card">
          <div className="card-header">
            <div>
              <h3>One system for property operations</h3>
              <p>
                PropFlow is designed to replace scattered spreadsheets, WhatsApp messages, manual
                reminders, disconnected cleaners, unclear maintenance status, and messy owner
                updates.
              </p>
            </div>

            <Sparkles size={22} className="muted" />
          </div>

          <div className="landing-feature-grid">
            {featureCards.map((feature) => (
              <LandingFeature key={feature.title} feature={feature} />
            ))}
          </div>
        </section>

        <section className="landing-split-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Role-based dashboards</h3>
                <p>
                  Each user sees the workflow that matches their job. Owners do not need cleaner
                  controls. Cleaners do not need financial dashboards. Maintenance crews do not need
                  owner reports.
                </p>
              </div>

              <Users size={22} className="muted" />
            </div>

            <ul className="checklist landing-checklist-grid">
              {roleCards.map((role) => (
                <li key={role}>
                  <CheckCircle2 size={16} />
                  {role}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Workspace-first SaaS structure</h3>
                <p>
                  One user can belong to multiple businesses. Each business can manage multiple
                  properties, invite team members, assign roles, and keep data scoped to that
                  workspace.
                </p>
              </div>

              <Building2 size={22} className="muted" />
            </div>

            <ul className="checklist">
              {operationsSteps.map((step) => (
                <li key={step}>
                  <CheckCircle2 size={16} />
                  {step}
                </li>
              ))}
            </ul>
          </section>
        </section>

        <section className="landing-split-grid">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Finance and owner reporting</h3>
                <p>
                  Keep revenue, owner payouts, cleaning costs, maintenance costs, net profit, and
                  report exports in one finance-aware property system.
                </p>
              </div>

              <BarChart3 size={22} className="muted" />
            </div>

            <div className="landing-mini-metrics">
              <span>
                <strong>Revenue</strong>
                <small>Bookings and direct booking records</small>
              </span>

              <span>
                <strong>Expenses</strong>
                <small>Cleaning, maintenance, supplies, and fees</small>
              </span>

              <span>
                <strong>Owner reports</strong>
                <small>Manual reports first, scheduled reports later</small>
              </span>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Direct booking foundation</h3>
                <p>
                  PropFlow is being prepared for public property booking pages, guest inquiry forms,
                  manual approval, Stripe payments, and automatic booking creation.
                </p>
              </div>

              <CalendarDays size={22} className="muted" />
            </div>

            <div className="action-row">
              <button className="primary" type="button" onClick={() => navigate('/signup')}>
                Create workspace first
              </button>

              <button type="button" onClick={() => navigate('/pricing')}>
                See launch plans
              </button>
            </div>

            <div className="helper">
              MVP default: public booking pages and payments should stay disabled until a real
              property record, approval rules, and Stripe backend flow are connected.
            </div>
          </section>
        </section>

        <section className="card landing-final-cta">
          <div>
            <p className="eyebrow">Start clean. Scale later.</p>
            <h3>Build your property command center.</h3>
            <p>
              Create a workspace, add your first property, invite your team, and start tracking
              bookings, cleaning, maintenance, owners, reports, supplies, and calendar activity.
            </p>
          </div>

          <div className="landing-final-actions">
            <button className="primary large" type="button" onClick={() => navigate('/signup')}>
              Start free trial
              <ArrowRight size={18} />
            </button>

            <button className="secondary large" type="button" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
