import React from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, MessageCircle, ShieldCheck } from 'lucide-react';

import { StatusBadge } from './StatusBadge.jsx';
import { isSupabaseConfigured } from '../lib/supabase.js';

function ProviderRow({ icon: Icon, name, status, description, requiredKeys }) {
  const connected = status === 'connected';

  return (
    <div className="environment-provider-row">
      <div className={connected ? 'environment-provider-icon ready' : 'environment-provider-icon warning'}>
        <Icon size={17} />
      </div>

      <span>
        <strong>{name}</strong>
        <small>{description}</small>
        {requiredKeys?.length ? <code>{requiredKeys.join(', ')}</code> : null}
      </span>

      <StatusBadge tone={connected ? 'success' : 'warning'}>
        {connected ? 'connected' : 'provider_not_configured'}
      </StatusBadge>
    </div>
  );
}

export function EnvironmentSetupNotice({ compact = false }) {
  const providers = [
    {
      id: 'supabase',
      icon: ShieldCheck,
      name: 'Supabase',
      status: isSupabaseConfigured ? 'connected' : 'missing',
      description: isSupabaseConfigured
        ? 'Auth and database client are configured.'
        : 'Add the public Supabase URL and anon key before using auth/database actions.',
      requiredKeys: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    },
    {
      id: 'stripe',
      icon: CreditCard,
      name: 'Stripe billing',
      status: 'missing',
      description: 'Server-only API routes intentionally return provider_not_configured until live Stripe is implemented.',
      requiredKeys: ['server-only Stripe env vars'],
    },
    {
      id: 'resend',
      icon: Mail,
      name: 'Resend email',
      status: 'missing',
      description: 'External email sends are not live. Keep Resend credentials server-only when implemented.',
      requiredKeys: ['server-only Resend env vars'],
    },
    {
      id: 'twilio-sms',
      icon: MessageCircle,
      name: 'Twilio SMS',
      status: 'missing',
      description: 'External SMS sends are not live. Keep Twilio credentials server-only when implemented.',
      requiredKeys: ['server-only Twilio SMS env vars'],
    },
    {
      id: 'twilio-whatsapp',
      icon: MessageCircle,
      name: 'Twilio WhatsApp',
      status: 'missing',
      description: 'External WhatsApp sends are not live. Keep Twilio credentials server-only when implemented.',
      requiredKeys: ['server-only Twilio WhatsApp env vars'],
    },
  ];

  const missingCount = providers.filter((provider) => provider.status !== 'connected').length;

  return (
    <section className={compact ? 'card environment-setup-card compact' : 'card environment-setup-card'}>
      <div className="card-header">
        <div>
          <p className="eyebrow">Environment setup</p>
          <h3>Provider configuration status</h3>
          <p>
            These checks are safe frontend indicators only. Do not expose provider secret keys in Vite
            environment variables.
          </p>
        </div>

        {missingCount ? <AlertTriangle size={22} className="muted" /> : <CheckCircle2 size={22} className="muted" />}
      </div>

      <div className="environment-provider-list">
        {providers.map((provider) => (
          <ProviderRow key={provider.id} {...provider} />
        ))}
      </div>
    </section>
  );
}
