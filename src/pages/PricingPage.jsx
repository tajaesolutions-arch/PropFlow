import React from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { navigate } from '../routes/AppRouter.jsx';

const plans = [
  {
    name: 'Starter',
    key: 'starter',
    price: '$29/mo',
    description: 'For individual hosts, homeowners, and small landlords getting organized.',
    featured: false,
    audience: 'Small operators',
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
    key: 'pro',
    price: '$79/mo',
    description: 'For growing Airbnb hosts, property managers, and rental operators.',
    featured: true,
    audience: 'Growing teams',
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
    key: 'business',
    price: '$199/mo',
    description: 'For professional property management companies and larger teams.',
    featured: false,
    audience: 'Property companies',
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
    key: 'enterprise',
    price: 'Custom',
    description: 'For agencies, real estate companies, villas, resorts, and large operators.',
    featured: false,
    audience: 'Large operators',
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

const faqs = [
  {
    question: 'Is Stripe billing live?',
    answer:
      'Not yet. Pricing is public, but live checkout should stay disabled until secure backend checkout sessions, billing portal sessions, webhooks, and subscription enforcement are connected.',
  },
  {
    question: 'Is there a permanent free plan?',
    answer:
      'The recommended launch model is a 14-day trial instead of a permanent free plan. This keeps support load controlled while the product becomes stable.',
  },
  {
    question: 'Can PropFlow support Jamaica and other currencies?',
    answer:
      'Yes. Workspace setup already collects default currency. Real-time currency conversion should be handled through a secure backend exchange-rate provider later.',
  },
  {
    question: 'Can one account manage multiple businesses?',
    answer:
      'Yes. PropFlow is structured around workspaces, so one user can belong to multiple businesses or rental operations.',
  },
];

function PricingCard({ plan }) {
  return (
    <article className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
      {plan.featured && <span className="pricing-popular-badge">Recommended</span>}

      <div className="pricing-card-head">
        <span>{plan.audience}</span>
        <h3>{plan.name}</h3>
        <p>{plan.description}</p>
      </div>

      <strong className="pricing-price">{plan.price}</strong>

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
        Stripe checkout should be connected through secure backend endpoints before live billing.
      </small>
    </article>
  );
}

export function PricingPage() {
  return (
    <div className="public-page pricing-page">
      <nav className="public-nav pricing-nav">
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

      <section className="pricing-hero">
        <div>
          <p className="eyebrow">Simple launch pricing</p>
          <h1>Plans for serious property operations.</h1>
          <p>
            Start with a 14-day free trial, then choose the plan that matches your rental operation.
            Stripe checkout is prepared as a backend phase and is not live yet.
          </p>

          <div className="hero-actions">
            <button className="primary large" type="button" onClick={() => navigate('/signup')}>
              Start 14-day trial
              <ArrowRight size={18} />
            </button>

            <button className="secondary large" type="button" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>

        <aside className="pricing-hero-panel">
          <div>
            <Sparkles size={20} />
            <span>
              <strong>No permanent free plan recommended</strong>
              <small>Use a trial to attract serious users and reduce launch support load.</small>
            </span>
          </div>

          <div>
            <ShieldCheck size={20} />
            <span>
              <strong>Workspace billing model</strong>
              <small>Subscriptions should attach to workspaces, not random frontend state.</small>
            </span>
          </div>

          <div>
            <CreditCard size={20} />
            <span>
              <strong>Stripe-ready structure</strong>
              <small>Checkout, portal, webhooks, and grace period still need backend wiring.</small>
            </span>
          </div>
        </aside>
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <PricingCard key={plan.key} plan={plan} />
        ))}
      </section>

      <section className="pricing-content">
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

              <Sparkles size={20} className="muted" />
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

              <CreditCard size={20} className="muted" />
            </div>

            <div className="pricing-status-grid">
              <span>
                <CreditCard size={16} />
                <strong>Stripe checkout</strong>
                <small>Pending backend endpoint</small>
              </span>

              <span>
                <ShieldCheck size={16} />
                <strong>Webhooks</strong>
                <small>Pending signature validation</small>
              </span>

              <span>
                <Building2 size={16} />
                <strong>Workspace billing</strong>
                <small>Pending subscription enforcement</small>
              </span>

              <span>
                <Check size={16} />
                <strong>Pricing page</strong>
                <small>Public frontend ready</small>
              </span>
            </div>

            <div className="helper">
              Do not add Stripe secret keys to frontend code. Billing must be handled through secure
              backend endpoints or Supabase Edge Functions.
            </div>
          </section>
        </div>

        <section className="card pricing-model-card">
          <div className="card-header">
            <div>
              <h3>Recommended launch model</h3>
              <p>
                Avoid a permanent free plan at launch. Free users can create support load before the
                product is stable. Use a trial instead, then convert serious users into paid
                workspaces.
              </p>
            </div>

            <Users size={20} className="muted" />
          </div>

          <div className="pricing-model-grid">
            <span>
              <strong>14-day trial</strong>
              <small>Let users test the actual workspace flow.</small>
            </span>

            <span>
              <strong>Starter / Pro / Business</strong>
              <small>Simple upgrade path for normal customers.</small>
            </span>

            <span>
              <strong>Enterprise</strong>
              <small>Manual review for larger accounts and special cases.</small>
            </span>
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

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Pricing questions</h3>
              <p>Clear expectations before the billing backend is connected.</p>
            </div>

            <HelpCircle size={20} className="muted" />
          </div>

          <div className="pricing-faq-grid">
            {faqs.map((faq) => (
              <article key={faq.question}>
                <strong>{faq.question}</strong>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
