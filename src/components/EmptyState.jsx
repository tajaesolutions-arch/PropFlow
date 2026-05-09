import React from 'react';
import {
  Building2,
  CalendarPlus,
  ClipboardCheck,
  DollarSign,
  FileText,
  Inbox,
  Plus,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';

const smartActionRules = [
  {
    keywords: ['property', 'properties', 'portfolio', 'workspace setup'],
    label: 'Add Property',
    icon: Building2,
    className: 'primary',
  },
  {
    keywords: ['booking', 'bookings', 'reservation', 'reservations', 'check-in', 'check out', 'check-in'],
    label: 'Add Booking',
    icon: CalendarPlus,
    className: 'primary',
  },
  {
    keywords: ['cleaning', 'cleanings', 'turnover', 'guest ready', 'checklist'],
    label: 'Add Cleaning Task',
    icon: ClipboardCheck,
    className: 'primary',
  },
  {
    keywords: ['maintenance', 'work order', 'work orders', 'repair', 'repairs', 'issue', 'issues'],
    label: 'Add Maintenance Work Order',
    icon: Wrench,
    className: 'primary',
  },
  {
    keywords: ['owner', 'owners', 'payout'],
    label: 'Add Owner',
    icon: UserPlus,
    className: 'primary',
  },
  {
    keywords: ['guest', 'guests', 'contact', 'contacts', 'crm'],
    label: 'Add Guest',
    icon: UserPlus,
    className: 'primary',
  },
  {
    keywords: ['expense', 'expenses', 'cost', 'costs', 'receipt', 'receipts', 'finance'],
    label: 'Add Expense',
    icon: DollarSign,
    className: 'primary',
  },
  {
    keywords: ['report', 'reports', 'export', 'exports', 'owner report'],
    label: 'Add Report',
    icon: FileText,
    className: 'primary',
  },
  {
    keywords: ['team', 'member', 'members', 'invite', 'invites', 'staff', 'user', 'users'],
    label: 'Invite Team Member',
    icon: Users,
    className: 'primary',
  },
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function createActionFromLabel(label) {
  const normalized = normalize(label);
  if (normalized.includes('property')) return 'property';
  if (normalized.includes('booking') || normalized.includes('reservation')) return 'booking';
  if (normalized.includes('cleaning')) return 'cleaning';
  if (normalized.includes('maintenance') || normalized.includes('work order')) return 'maintenance';
  if (normalized.includes('owner')) return 'owner';
  if (normalized.includes('guest') || normalized.includes('contact')) return 'guest';
  if (normalized.includes('expense')) return 'expense';
  if (normalized.includes('report')) return 'report';
  if (normalized.includes('invite') || normalized.includes('team member')) return 'invite';
  return undefined;
}

function getSmartActions({ title, description, eyebrow }) {
  const text = normalize(`${eyebrow} ${title} ${description}`);

  if (!text) return [];

  const actions = [];
  const seen = new Set();

  smartActionRules.forEach((rule) => {
    const matches = rule.keywords.some((keyword) => text.includes(keyword));

    if (matches && !seen.has(rule.label)) {
      seen.add(rule.label);
      actions.push(rule);
    }
  });

  if (actions.length) return actions.slice(0, 2);

  if (text.includes('nothing here') || text.includes('no data') || text.includes('empty')) {
    return [smartActionRules[0]];
  }

  return [];
}

function SmartActionButton({ action, index }) {
  const Icon = action.icon || Plus;

  return (
    <button
      type="button"
      className={index === 0 ? action.className || 'primary' : 'secondary'}
      aria-label={action.label}
      data-create-action={createActionFromLabel(action.label)}
    >
      <Icon size={16} />
      {action.label}
    </button>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Create your first record to get started.',
  action = null,
  secondaryAction = null,
  icon: Icon = Inbox,
  eyebrow = '',
  compact = false,
  suggestedActions = null,
}) {
  const smartActions = React.useMemo(() => {
    if (action || secondaryAction) return [];
    if (Array.isArray(suggestedActions)) return suggestedActions;

    return getSmartActions({ title, description, eyebrow });
  }, [action, secondaryAction, suggestedActions, title, description, eyebrow]);

  return (
    <div className={`empty-state ${compact ? 'compact-empty-state' : ''}`}>
      {Icon && (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon size={26} />
        </div>
      )}

      {eyebrow && <p className="eyebrow">{eyebrow}</p>}

      <h3>{title}</h3>
      <p>{description}</p>

      {(action || secondaryAction || smartActions.length > 0) && (
        <div className="empty-action">
          {action}
          {secondaryAction}
          {!action &&
            !secondaryAction &&
            smartActions.map((item, index) => (
              <SmartActionButton key={item.label} action={item} index={index} />
            ))}
        </div>
      )}
    </div>
  );
}
