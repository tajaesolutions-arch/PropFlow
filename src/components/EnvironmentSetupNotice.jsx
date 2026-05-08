import React from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, MessageCircle, ShieldCheck } from 'lucide-react';

import { StatusBadge } from './StatusBadge.jsx';
import { isSupabaseConfigured } from '../lib/supabase.js';

function getEnvValue(key) {
  return import.meta.env?.[key]?.trim?.() || '';
}

function hasAnyEnv(keys) {
  return keys.some((key) => Boolean(getEnvValue(key)));
}

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
        {connected ? 'connected' : 'not configured'}
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
      status: hasAnyEnv(['VITE_STRIPE_PUBLISHABLE_KEY']) ? 'connected' : 'missing',
      description: 'Provider status only. Secret keys and webhooks must stay server-side.',
      requiredKeys: ['VITE_STRIPE_PUBLISHABLE_KEY'],
    },
    {
      id: 'resend',
      icon: Mail,
      name: 'Resend email',
      status: hasAnyEnv(['VITE_RESEND_CONFIGURED']) ? 'connected' : 'missing',
      description: 'Transactional email provider is not wired in this frontend MVP yet.',
      requiredKeys: ['VITE_RESEND_CONFIGURED'],
    },
    {
      id: 'twilio-sms',
      icon: MessageCircle,
      name: 'Twilio SMS',
      status: hasAnyEnv(['VITE_TWILIO_SMS_CONFIGURED']) ? 'connected' : 'missing',
      description: 'SMS provider credentials should be stored server-side, not in frontend code.',
      requiredKeys: ['VITE_TWILIO_SMS_CONFIGURED'],
    },
    {
      id: 'twilio-whatsapp',
      icon: MessageCircle,
      name: 'Twilio WhatsApp',
      status: hasAnyEnv(['VITE_TWILIO_WHATSAPP_CONFIGURED']) ? 'connected' : 'missing',
      description: 'WhatsApp provider credentials should be stored server-side, not in frontend code.',
      requiredKeys: ['VITE_TWILIO_WHATSAPP_CONFIGURED'],
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
