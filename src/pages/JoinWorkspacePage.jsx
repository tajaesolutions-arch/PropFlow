import React from 'react';
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

function normalizeJoinInput(value) {
  return value
    .trim()
    .replace(/^.*invite=/, '')
    .replace(/^.*code=/, '')
    .trim();
}

function getPlanValue(label) {
  const normalized = label.toLowerCase();

  if (normalized.includes('growth')) return 'growth';
  if (normalized.includes('scale')) return 'scale';

  return 'starter';
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
    plan_placeholder: 'Starter',
  });

  const [joinCode, setJoinCode] = React.useState(initialJoinCode);
  const [message, setMessage] = React.useState('');
  const [busyAction, setBusyAction] = React.useState('');

  React.useEffect(() => {
    if (!createForm.business_email && currentUser?.email) {
      setCreateForm((form) => ({
        ...form,
        business_email: currentUser.email,
      }));
    }
  }, [currentUser?.email, createForm.business_email]);

  const set = (key) => (event) => {
    setCreateForm((form) => ({
      ...form,
      [key]: event.target.value,
    }));
  };

  const submitCreate = async (event) => {
    event.preventDefault();

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
        plan: getPlanValue(createForm.plan_placeholder),
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

  const submitJoin = async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Invite validation requires Supabase.');
      return;
    }

    if (!currentUser) {
      setMessage('Log in with the invited email before joining a workspace.');
      navigate('/login');
      return;
    }

    const cleanedCode = normalizeJoinInput(joinCode);

    if (!cleanedCode) {
      setMessage('Enter an invite token, invite link, or company code.');
      return;
    }

    setBusyAction('join');
    setMessage('');

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

  const createBusy = busyAction === 'create';
  const joinBusy = busyAction === 'join';

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <h1>Create or join a workspace</h1>
        <p>
          New accounts can create a workspace immediately. Company codes only work when a valid
          pending invite exists for your authenticated email.
        </p>

        {message && <div className="helper">{message}</div>}

        {!isSupabaseConfigured && (
          <div className="helper error-helper">
            Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before
            using workspace setup.
          </div>
        )}

        <div className="panel-grid two">
          <form className="card compact" onSubmit={submitCreate}>
            <h3>Create workspace</h3>

            <div className="form-grid">
              <label>
                Workspace/business name
                <input value={createForm.name} onChange={set('name')} required />
              </label>

              <label>
                Business type
                <select value={createForm.business_type} onChange={set('business_type')}>
                  {businessTypes.map((item) => (
                    <option key={item}>{item}</option>
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
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>

              <label>
                Business email
                <input
                  value={createForm.business_email}
                  onChange={set('business_email')}
                  type="email"
                  required
                />
              </label>

              <label>
                Phone number
                <input value={createForm.phone} onChange={set('phone')} required />
              </label>

              <label>
                Website optional
                <input value={createForm.website} onChange={set('website')} />
              </label>

              <label>
                Number of properties managed
                <input
                  value={createForm.property_count_estimate}
                  onChange={set('property_count_estimate')}
                  type="number"
                  min="0"
                />
              </label>

              <label>
                Subscription plan
                <select value={createForm.plan_placeholder} onChange={set('plan_placeholder')}>
                  <option>Starter</option>
                  <option>Growth</option>
                  <option>Scale</option>
                </select>
              </label>
            </div>

            <button className="primary" disabled={createBusy || joinBusy}>
              {createBusy ? 'Saving…' : 'Create workspace'}
            </button>
          </form>

          <form className="card compact" onSubmit={submitJoin}>
            <h3>Join workspace</h3>
            <p>
              Paste an invite token, invite link, or company code. PropFlow checks invite status,
              expiration, and email match before adding access.
            </p>

            <label>
              Invite link, invite token, or company code
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeJoinInput(event.target.value))}
                placeholder="BLUE-2026 or invite token"
                required
              />
            </label>

            <button className="primary" disabled={createBusy || joinBusy}>
              {joinBusy ? 'Joining…' : 'Join workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
