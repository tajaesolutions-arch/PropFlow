import React from 'react';
import {
  AlertTriangle,
  Ban,
  CreditCard,
  Home,
  LogIn,
  ShieldAlert,
  UserRound,
} from 'lucide-react';

import { navigate } from '../routes/AppRouter.jsx';

function getContent(variant) {
  if (variant === 'denied') {
    return {
      icon: ShieldAlert,
      eyebrow: 'Access restricted',
      title: 'You do not have access to this area',
      description:
        'Your current role does not have permission to view this workspace page. Use the dashboard assigned to your role or contact your Workspace Owner if your access looks incorrect.',
      primaryAction: 'Go to my dashboard',
      primaryPath: '/login/redirect',
      secondaryAction: 'Account settings',
      secondaryPath: '/account',
    };
  }

  if (variant === 'billing') {
    return {
      icon: CreditCard,
      eyebrow: 'Billing restricted',
      title: 'Workspace billing needs attention',
      description:
        'This workspace may be past its billing grace period. Workspace Owners can access billing recovery, but staff access may be limited until the subscription is resolved.',
      primaryAction: 'Go to billing',
      primaryPath: '/billing',
      secondaryAction: 'Account settings',
      secondaryPath: '/account',
    };
  }

  return {
    icon: Ban,
    eyebrow: 'Account suspended',
    title: 'Your access is suspended',
    description:
      'This account, membership, or workspace has been suspended. You can view account information, but workspace data and operational pages are restricted.',
    primaryAction: 'Account settings',
    primaryPath: '/account',
    secondaryAction: 'Back to login',
    secondaryPath: '/login',
  };
}

export function SuspendedPage({ variant }) {
  const content = getContent(variant);
  const Icon = content.icon;

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <Icon size={40} />

        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>

        <div className="helper">
          <AlertTriangle size={16} />
          PropFlow blocks restricted users from dashboards, properties, bookings, cleaning,
          maintenance, reports, team data, and workspace records until access is restored.
        </div>

        <div className="action-row">
          <button
            className="primary"
            type="button"
            onClick={() => navigate(content.primaryPath)}
          >
            {variant === 'denied' ? <Home size={16} /> : <UserRound size={16} />}
            {content.primaryAction}
          </button>

          <button type="button" onClick={() => navigate(content.secondaryPath)}>
            {content.secondaryPath === '/login' ? <LogIn size={16} /> : <UserRound size={16} />}
            {content.secondaryAction}
          </button>
        </div>

        <p className="page-note">
          Contact your Workspace Owner or PropFlow support if this restriction is unexpected.
        </p>
      </div>
    </div>
  );
}
