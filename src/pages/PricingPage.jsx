import React from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { navigate } from '../routes/AppRouter.jsx';

const plans = [
  {
    name: 'Starter',
    price: '$29/mo',
    description: 'For individual hosts, homeowners, and small landlords getting organized.',
    featured: false,
    features: [
      '14-day free trial',
      '1 workspace',
      'Core dashboard',
      'Properties',
      'Bookings and leases',
      'Cleaning tasks',
      'Maintenance work orders',
      'Calendar view',
    ],
  },
  {
    name: 'Pro',
    price: '$79/mo',
    description: 'For growing Airbnb hosts, property managers, and rental operators.',
    featured: true,
    features: [
      'Everything in Starter',
      'Owner dashboard',
      'Cleaner dashboard',
      'Maintenance crew dashboard',
      'Reports foundation',
      'Supplies / inventory',
      'Team roles and invites',
      'Private file uploads',
    ],
  },
  {
    name: 'Business',
    price: '$199/mo',
    description: 'For professional property management companies and larger teams.',
    featured: false,
    features: [
      'Everything in Pro',
      'Multiple workspaces prepared',
      'Accountant dashboard',
      'Advanced reports foundation',
      'Direct booking page foundation',
      'Notification center',
      'Billing recovery workflow prepared',
      'Priority setup support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For agencies, real estate companies, villas, resorts, and large operators.',
    featured: false,
    features: [
      'Custom onboarding',
      'Custom workspace limits',
      'Advanced permission planning',
      'Team training',
      'Custom reporting support',
      'Future integrations support',
      'Dedicated support path',
      'Founder review required',
    ],
  },
];

export function PricingPage() {
  return (
    <div className="public-page">
      <nav className="public-nav">
        <strong onClick={() => navigate('/')}>PropFlow</strong>

        <div>
          <button type="button" onClick={() => navigate('/')}>
            Home
          </button>
          <button type="button" onClick={() => navigate('/login')}>
            Login
          </button>
          <button className="primary" type="button" onClick={() => navigate('/signup')}>
            Start free
          </button>
        </div>
      </nav>

      <section className="pricing-head">
        <p className="eyebrow">Simple launch pricing</p>
        <h1>Plans for serious property operations.</h1>
        <p>
          Start with a 14-day free trial, then choose the plan that matches your rental operation.
          Stripe billing checkout is prepared as a backend phase and is not live yet.
        </p>
      </section>

      <div className="pricing-grid">
        {plans.map((plan) => (
          <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
            <div>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
            </div>

            <strong>{plan.price}</strong>

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} />
                  {feature}
                </li>
              ))}
            </ul>

            <button className="primary" type="button" onClick={() => navigate('/signup')}>
              Start {plan.name}
              <ArrowRight size={16} />
            </button>

            <small className="todo">
              Stripe checkout coming after secure backend billing endpoints are connected.
            </small>
          </article>
        ))}
      </div>

      <section className="page-content">
        <div className="panel-grid two">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>What is included in the trial?</h3>
                <p>
                  The trial should let new workspaces create properties, invite team members, test
                  dashboards, add bookings, create cleaning tasks, create maintenance work orders,
                  and review reports before paying.
                </p>
              </div>
              <Sparkles size={20} />
            </div>

            <ul className="checklist">
              <li>
                <Check size={16} />
                Create or join a workspace.
              </li>
              <li>
                <Check size={16} />
                Add real properties.
              </li>
              <li>
                <Check size={16} />
                Invite team members by role.
              </li>
              <li>
                <Check size={16} />
                Test role-based dashboards.
              </li>
              <li>
                <Check size={16} />
                Track bookings, cleaning, maintenance, calendar, owners, and reports.
              </li>
            </ul>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Billing setup status</h3>
                <p>
                  Pricing is shown publicly, but live billing should stay disabled until Stripe
                  checkout, billing portal, webhooks, subscription tables, and access restrictions
                  are connected securely.
                </p>
              </div>
              <CreditCard size={20} />
            </div>

            <div className="metadata-grid">
              <span>
                <CreditCard size={16} />
                Stripe checkout: pending
              </span>
              <span>
                <ShieldCheck size={16} />
                Webhooks: pending
              </span>
              <span>
                <Building2 size={16} />
                Workspace billing: pending
              </span>
              <span>
                <Check size={16} />
                Pricing page: ready
              </span>
            </div>

            <div className="helper">
              Do not add Stripe secret keys to frontend code. Billing must be handled through secure
              backend endpoints or Supabase edge functions.
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Recommended launch model</h3>
              <p>
                Avoid a permanent free plan at launch. Free users can create support load before the
                product is stable. Use a trial instead, then convert serious users into paid
                workspaces.
              </p>
            </div>
          </div>

          <div className="action-row">
            <button className="primary large" type="button" onClick={() => navigate('/signup')}>
              Start 14-day trial
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
