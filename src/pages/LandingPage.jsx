import React from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
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
    description: 'Manage short-term rentals, long-term rentals, villas, apartments, homes, model units, and commercial spaces.',
    icon: Building2,
  },
  {
    title: 'Bookings and leases',
    description: 'Track check-ins, check-outs, booking sources, payment status, lease periods, occupancy, and calendar activity.',
    icon: CalendarDays,
  },
  {
    title: 'Cleaning operations',
    description: 'Assign cleanings, use checklists, upload before/after photos, track supplies, and confirm guest-ready status.',
    icon: ClipboardCheck,
  },
  {
    title: 'Maintenance work orders',
    description: 'Track urgent repairs, parts needed, estimated costs, actual costs, due dates, and completion photos.',
    icon: Wrench,
  },
  {
    title: 'Owner dashboards',
    description: 'Give property owners a limited view of assigned properties, revenue, expenses, payouts, and maintenance updates.',
    icon: Users,
  },
  {
    title: 'Reports and finance',
    description: 'Prepare owner statements, revenue reports, expense reports, occupancy reports, and export-ready summaries.',
    icon: CreditCard,
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

export function LandingPage() {
  return (
    <div className="public-page">
      <nav className="public-nav">
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

      <section className="hero">
        <div>
          <p className="eyebrow">Property operations, finances, and teams in one workspace</p>

          <h1>Run every rental property like a professional operation.</h1>

          <p>
            PropFlow helps Airbnb hosts, landlords, property managers, homeowners, real estate teams,
            cleaners, maintenance crews, and property owners manage rentals from one clean SaaS
            command center.
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
        </div>

        <aside className="hero-panel">
          <div className="mini-kpis">
            <span>
              <strong>Multi-role</strong>
              <small>Owners, managers, hosts, cleaners</small>
            </span>
            <span>
              <strong>Multi-property</strong>
              <small>One workspace, many properties</small>
            </span>
            <span>
              <strong>Multi-currency</strong>
              <small>USD, JMD, CAD, GBP, EUR</small>
            </span>
          </div>

          <div className="feature-row">
            <Building2 size={20} />
            <span>
              <strong>Workspace-scoped property portfolio</strong>
              <small>Each company keeps its data separated and role-protected.</small>
            </span>
          </div>

          <div className="feature-row">
            <ClipboardCheck size={20} />
            <span>
              <strong>Cleaner checklists and guest-ready updates</strong>
              <small>Track cleaning progress, notes, issues, and photos.</small>
            </span>
          </div>

          <div className="feature-row">
            <Wrench size={20} />
            <span>
              <strong>Maintenance work orders and urgent alerts</strong>
              <small>Manage repairs, priorities, costs, parts, and completion updates.</small>
            </span>
          </div>
        </aside>
      </section>

      <section className="page-content">
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

        <section className="card">
          <div className="card-header">
            <div>
              <h3>One system for property operations</h3>
              <p>
                PropFlow is designed to replace scattered spreadsheets, WhatsApp messages, manual
                reminders, disconnected cleaners, and unclear owner updates.
              </p>
            </div>
            <Sparkles size={22} />
          </div>

          <div className="panel-grid two">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <section className="card compact" key={feature.title}>
                  <div className="card-header">
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                    <Icon size={20} />
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <div className="panel-grid two">
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
              <Users size={22} />
            </div>

            <ul className="checklist">
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
              <Building2 size={22} />
            </div>

            <ul className="checklist">
              <li>
                <CheckCircle2 size={16} />
                Create a new workspace or join an existing workspace.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Invite users by role and assign properties where needed.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Route users to the correct dashboard after login.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Keep customer data scoped by workspace.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Support multiple currencies for global property operators.
              </li>
            </ul>
          </section>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Direct booking foundation</h3>
              <p>
                PropFlow is being prepared for public property booking pages, guest inquiry forms,
                manual approval, Stripe payments, and automatic booking creation.
              </p>
            </div>
            <CalendarDays size={22} />
          </div>

          <div className="action-row">
            <button className="primary" type="button" onClick={() => navigate('/book/demo-property')}>
              Preview booking page
            </button>

            <button type="button" onClick={() => navigate('/pricing')}>
              See launch plans
            </button>
          </div>

          <div className="helper">
            MVP default: booking requests should require manual approval unless instant booking and
            payment are explicitly enabled for that property.
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Start building your property command center</h3>
              <p>
                Create a workspace, add your first property, invite your team, and start tracking
                bookings, cleaning, maintenance, owners, reports, supplies, and calendar activity.
              </p>
            </div>
          </div>

          <div className="action-row">
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
