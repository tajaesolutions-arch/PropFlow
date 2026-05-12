import React from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  KeyRound,
  LogIn,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { currencies } from '../data/constants.js';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const businessTypes = [
  'Short-term rental operator',
  'Long-term landlord',
  'Property management company',
  'Cleaning company',
  'Maintenance company',
  'Villa / guesthouse / resort',
  'Real estate company',
];

const planOptions = [
  {
    label: 'Starter',
    value: 'starter',
    description: 'Best for a small host, landlord, or early property operation.',
  },
  {
    label: 'Pro',
    value: 'pro',
    description: 'Best for growing hosts and property managers with teams.',
  },
  {
    label: 'Business',
    value: 'business',
    description: 'Best for larger teams, agencies, and multi-property operators.',
  },
];

function normalizeJoinInput(value) {
  return String(value || '')
    .trim()
    .replace(/^.*invite=/, '')
    .replace(/^.*code=/, '')
    .replace(/[&#].*$/, '')
    .trim();
}

function cleanUrl(value) {
  const text = String(value || '').trim();

  if (!text) return '';

  if (text.startsWith('http://') || text.startsWith('https://')) {
    return text;
  }

  return `https://${text}`;
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function validateCreateForm(form) {
  const errors = [];

  if (!form.name.trim()) errors.push('Workspace/business name is required.');
  if (!form.business_type) errors.push('Business type is required.');
  if (!form.country.trim()) errors.push('Country is required.');
  if (!form.default_currency) errors.push('Default currency is required.');
  if (!form.business_email.trim()) errors.push('Business email is required.');
  if (!form.phone.trim()) errors.push('Phone number is required.');

  const propertyEstimate = cleanNumber(form.property_count_estimate);

  if (
    form.property_count_estimate !== '' &&
    (propertyEstimate === null || propertyEstimate < 0)
  ) {
    errors.push('Number of properties managed must be 0 or more.');
  }

  return errors;
}

function getPlanDescription(planValue) {
  return planOptions.find((plan) => plan.value === planValue)?.description || planOptions[0].description;
}

function WorkspaceSetupFeature({ icon: Icon, title, description }) {
  return (
    <article className="workspace-setup-feature">
      <Icon size={18} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </article>
  );
}

export function JoinWorkspacePage() {
  const {
    createWorkspace,
    joinWorkspace,
    isSupabaseConfigured,
    currentUser,
    loadAccount,
  } = useApp();

  const params = new URLSearchParams(window.location.search);
  const initialJoinCode = params.get('invite') || params.get('code') || '';

  const [createForm, setCreateForm] = React.useState({
    name: '',
    business_type: businessTypes[0],
    country: 'United States',
    default_currency: 'USD',
    business_email: currentUser?.email || '',
    phone: '',
    website: '',
    property_count_estimate: '',
    plan: 'starter',
  });

  const [joinCode, setJoinCode] = React.useState(initialJoinCode);
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState([]);
  const [busyAction, setBusyAction] = React.useState('');
  const autoJoinAttempted = React.useRef(false);

  React.useEffect(() => {
    if (!currentUser?.email) return;

    setCreateForm((form) => {
      if (form.business_email) return form;

      return {
        ...form,
        business_email: currentUser.email,
      };
    });
  }, [currentUser?.email]);

  const set = (key) => (event) => {
    setCreateForm((form) => ({
      ...form,
      [key]: event.target.value,
    }));
  };

  const submitCreate = async (event) => {
    event.preventDefault();

    const nextErrors = validateCreateForm(createForm);
    setErrors(nextErrors);

    if (nextErrors.length) {
      setMessage('Please fix the highlighted workspace setup details.');
      return;
    }

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Workspace records require a connected Supabase project.');
      return;
    }

    if (!currentUser) {
      setMessage('Create an account or log in before creating a workspace.');
      navigate('/signup');
      return;
    }

    setBusyAction('create');
    setMessage('');

    try {
      const workspace = await createWorkspace({
        ...createForm,
        name: createForm.name.trim(),
        country: createForm.country.trim(),
        business_email: createForm.business_email.trim(),
        phone: createForm.phone.trim(),
        website: cleanUrl(createForm.website),
        property_count_estimate: cleanNumber(createForm.property_count_estimate),
        plan: createForm.plan,
      });

      if (workspace?.id) {
        setMessage('Workspace created. Loading dashboard…');
        navigate('/dashboard');
        return;
      }

      const account = await loadAccount();

      if (account?.currentWorkspace?.id) {
        setMessage('Workspace created. Loading dashboard…');
        navigate('/dashboard');
        return;
      }

      setMessage('Workspace created. Refreshing your dashboard…');
      window.location.assign('/dashboard');
    } catch (error) {
      setMessage(error.message || 'Workspace creation failed.');
    } finally {
      setBusyAction('');
    }
  };

  const tryJoinWorkspace = async (cleanedCode) => {
    try {
      return await joinWorkspace({ token: cleanedCode });
    } catch (tokenError) {
      return joinWorkspace({ code: cleanedCode });
    }
  };

  const runJoin = async (rawCode) => {
    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Invite validation requires Supabase.');
      return;
    }

    if (!currentUser) {
      setMessage('Log in with the invited email before joining a workspace.');
      navigate('/login');
      return;
    }

    const cleanedCode = normalizeJoinInput(rawCode);

    if (!cleanedCode) {
      setMessage('Enter an invite token, invite link, or company code.');
      return;
    }

    setBusyAction('join');
    setMessage('');
    setErrors([]);

    try {
      await tryJoinWorkspace(cleanedCode);
      setMessage('Workspace joined. Loading your dashboard…');
      navigate('/login/redirect');
    } catch (error) {
      setMessage(error.message || 'Could not join workspace.');
    } finally {
      setBusyAction('');
    }
  };

  React.useEffect(() => {
    if (autoJoinAttempted.current || !initialJoinCode || !currentUser) return;

    autoJoinAttempted.current = true;
    runJoin(initialJoinCode);
  }, [currentUser, initialJoinCode]);

  const submitJoin = async (event) => {
    event.preventDefault();
    runJoin(joinCode);
  };


  const createBusy = busyAction === 'create';
  const joinBusy = busyAction === 'join';

  return (
    <div className="auth-page workspace-setup-page">
      <div className="auth-card workspace-setup-shell">
        <section className="workspace-setup-hero">
          <div>
            <p className="eyebrow">PropFlow workspace setup</p>
            <h1>Create or join a workspace</h1>
            <p>
              Create a new property operation or join an existing workspace with a valid invite
              token, invite link, or a company code tied to a pending invite for your signed-in email.
            </p>
          </div>

          <div className="workspace-setup-hero-card">
            <Sparkles size={22} />
            <strong>Workspace-first SaaS structure</strong>
            <small>
              Every property, booking, task, report, file, and team member should stay scoped to the
              correct workspace.
            </small>
          </div>
        </section>

        {message && (
          <div
            className={
              message.toLowerCase().includes('failed') ||
              message.toLowerCase().includes('not configured') ||
              message.toLowerCase().includes('fix') ||
              message.toLowerCase().includes('could not')
                ? 'helper error-helper'
                : 'helper'
            }
            role="status"
          >
            {message}
          </div>
        )}

        {errors.length > 0 && (
          <div className="helper error-helper" role="alert">
            <strong>Workspace setup needs attention:</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="helper error-helper">
            <AlertTriangle size={16} />
            Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before
            using workspace setup.
          </div>
        )}

        {!currentUser && (
          <div className="workspace-setup-auth-warning">
            <ShieldCheck size={18} />
            <span>
              <strong>Login required</strong>
              <small>
                You can view this page, but creating or joining a workspace requires a signed-in
                PropFlow account.
              </small>
            </span>
            <button type="button" onClick={() => navigate('/login')}>
              <LogIn size={16} />
              Login
            </button>
          </div>
        )}

        <section className="workspace-setup-grid">
          <form className="card workspace-setup-card" onSubmit={submitCreate}>
            <div className="card-header">
              <div>
                <h3>Create new workspace</h3>
                <p>
                  Use this when you are starting a new company, rental operation, or property
                  management workspace.
                </p>
              </div>

              <Building2 size={22} className="muted" />
            </div>

            <div className="form-grid">
              <label>
                Workspace/business name
                <input
                  value={createForm.name}
                  onChange={set('name')}
                  placeholder="Example: Island Stay Management"
                  required
                />
              </label>

              <label>
                Business type
                <select value={createForm.business_type} onChange={set('business_type')}>
                  {businessTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Country
                <input value={createForm.country} onChange={set('country')} required />
              </label>

              <label>
                Default currency
                <select value={createForm.default_currency} onChange={set('default_currency')}>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Business email
                <input
                  value={createForm.business_email}
                  onChange={set('business_email')}
                  type="email"
                  placeholder="business@example.com"
                  required
                />
              </label>

              <label>
                Phone number
                <input
                  value={createForm.phone}
                  onChange={set('phone')}
                  placeholder="+1 876 000 0000"
                  required
                />
              </label>

              <label>
                Website optional
                <input
                  value={createForm.website}
                  onChange={set('website')}
                  placeholder="yourcompany.com"
                />
              </label>

              <label>
                Number of properties managed
                <input
                  value={createForm.property_count_estimate}
                  onChange={set('property_count_estimate')}
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </label>

              <label className="full">
                Subscription plan
                <select value={createForm.plan} onChange={set('plan')}>
                  {planOptions.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                </select>
                <small>{getPlanDescription(createForm.plan)}</small>
              </label>
            </div>

            <button className="primary workspace-setup-submit" disabled={createBusy || joinBusy}>
              <Plus size={16} />
              {createBusy ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>

          <form className="card workspace-setup-card" onSubmit={submitJoin}>
            <div className="card-header">
              <div>
                <h3>Join existing workspace</h3>
                <p>
                  Use this when a Workspace Owner or Property Manager invited you to an existing
                  PropFlow workspace.
                </p>
              </div>

              <KeyRound size={22} className="muted" />
            </div>

            <label>
              Invite link, invite token, or invited company code
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeJoinInput(event.target.value))}
                placeholder="Invite link, token, or invited company code"
                required
              />
            </label>

            <div className="workspace-join-rules">
              <WorkspaceSetupFeature
                icon={ShieldCheck}
                title="Email match required"
                description="A company code by itself cannot join a workspace; a pending invite must match your signed-in email."
              />

              <WorkspaceSetupFeature
                icon={KeyRound}
                title="Invite validation"
                description="PropFlow checks the token/code, invite status, invited email, and workspace access before joining."
              />

              <WorkspaceSetupFeature
                icon={Users}
                title="Role-based access"
                description="Your dashboard is selected automatically from your saved workspace role."
              />
            </div>

            <button className="primary workspace-setup-submit" disabled={createBusy || joinBusy}>
              <LogIn size={16} />
              {joinBusy ? 'Joining workspace…' : 'Join workspace'}
            </button>
          </form>
        </section>

        <section className="workspace-setup-feature-grid">
          <WorkspaceSetupFeature
            icon={Globe2}
            title="Multi-country ready"
            description="Workspace default currency and country are captured during setup."
          />

          <WorkspaceSetupFeature
            icon={CreditCard}
            title="Subscription prepared"
            description="Plans are stored now and Stripe billing can be connected in the billing phase."
          />

          <WorkspaceSetupFeature
            icon={Building2}
            title="Multi-property ready"
            description="Each workspace can manage many properties, bookings, staff, and reports."
          />

          <WorkspaceSetupFeature
            icon={CheckCircle2}
            title="Clean workspace setup"
            description="New workspaces start clean and use records your team creates or imports."
          />
        </section>
      </div>
    </div>
  );
}
