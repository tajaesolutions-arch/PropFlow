import React from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, MessageCircle, ShieldCheck } from 'lucide-react';

import { StatusBadge } from './StatusBadge.jsx';
import { isSupabaseConfigured, isSupabaseStorageConfigured } from '../lib/supabase.js';

function ProviderRow({ icon: Icon, name, status, description, requiredKeys, showTechnicalDetails }) {
  const connected = status === 'connected';

  return (
    <div className="environment-provider-row">
      <div className={connected ? 'environment-provider-icon ready' : 'environment-provider-icon warning'}>
        <Icon size={17} />
      </div>

      <span>
        <strong>{name}</strong>
        <small>{description}</small>
        {showTechnicalDetails && requiredKeys?.length ? <code>{requiredKeys.join(', ')}</code> : null}
      </span>

      <StatusBadge tone={connected ? 'success' : 'warning'}>
        {connected ? 'connected' : 'Provider not configured'}
      </StatusBadge>
    </div>
  );
}

export function EnvironmentSetupNotice({ compact = false, showTechnicalDetails = false }) {
  const providers = [
    {
      id: 'supabase',
      icon: ShieldCheck,
      name: 'Supabase',
      status: isSupabaseConfigured ? 'connected' : 'missing',
      description: isSupabaseConfigured
        ? 'Auth and database access are connected for this deployment.'
        : 'Database access is not ready. Finish public Supabase setup before using workspace actions.',
      requiredKeys: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    },
    {
      id: 'storage',
      icon: ShieldCheck,
      name: 'Supabase Storage',
      status: isSupabaseStorageConfigured ? 'connected' : 'missing',
      description: isSupabaseStorageConfigured
        ? 'Private workspace file storage is marked ready for uploads.'
        : 'Private file storage is not marked ready yet. Complete the private bucket setup before production uploads.',
      requiredKeys: ['VITE_SUPABASE_STORAGE_CONFIGURED'],
    },
    {
      id: 'stripe',
      icon: CreditCard,
      name: 'Stripe billing',
      status: 'missing',
      description: 'Billing is safe when disconnected; checkout and portal actions show setup-required messaging until Stripe is connected.',
      requiredKeys: ['server-only Stripe env vars'],
    },
    {
      id: 'resend',
      icon: Mail,
      name: 'Resend email',
      status: 'missing',
      description: 'Email notifications fail safely until the verified sender/domain and server-only credentials are connected.',
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
            These checks are safe runtime indicators only. Provider secrets must stay server-only and must never
            appear in browser-visible settings.
          </p>
        </div>

        {missingCount ? <AlertTriangle size={22} className="muted" /> : <CheckCircle2 size={22} className="muted" />}
      </div>

      <div className="environment-provider-list">
        {providers.map((provider) => (
          <ProviderRow key={provider.id} {...provider} showTechnicalDetails={showTechnicalDetails} />
        ))}
      </div>
    </section>
  );
}
