const TEMPLATE_KEYS = [
  'team_invite',
  'cleaning_task_assigned',
  'maintenance_work_order_assigned',
  'direct_booking_request_confirmation',
  'direct_booking_request_received',
  'direct_booking_payment_succeeded',
  'direct_booking_payment_failed',
  'owner_report_ready',
  'billing_payment_failed',
  'subscription_billing_warning',
];

const SAFE_PATHS = {
  team_invite: '/login/redirect',
  cleaning_task_assigned: '/cleaning',
  maintenance_work_order_assigned: '/maintenance',
  direct_booking_request_confirmation: '/',
  direct_booking_request_received: '/direct-bookings',
  direct_booking_payment_succeeded: '/direct-bookings',
  direct_booking_payment_failed: '/direct-bookings',
  owner_report_ready: '/reports',
  billing_payment_failed: '/settings',
  subscription_billing_warning: '/settings',
};

export function isApprovedTemplateKey(templateKey) {
  return TEMPLATE_KEYS.includes(templateKey);
}

export function approvedTemplateKeys() {
  return [...TEMPLATE_KEYS];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value, fallback = '') {
  return String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 1000) || fallback;
}

function formatDate(value, fallback = 'Not scheduled') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value, fallback).slice(0, 40);
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: value.includes?.('T') ? 'short' : undefined, timeZone: 'UTC' });
}

function money(amount, currency = 'USD') {
  if (amount === null || amount === undefined || amount === '') return '';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: text(currency, 'USD').toUpperCase() }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${text(currency, 'USD').toUpperCase()}`;
  }
}

function getAppUrl(context = {}) {
  const base = text(context.appUrl || process.env.APP_URL || process.env.VITE_APP_URL || 'https://app.propflow.example', 'https://app.propflow.example');
  try {
    const url = new URL(base);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://app.propflow.example';
  }
}

export function sameOriginAppLink(path, context = {}) {
  const base = getAppUrl(context);
  const safePath = String(path || '/').startsWith('/') ? String(path || '/') : '/';
  return new URL(safePath, base).toString();
}

function layout({ eyebrow, title, intro, rows = [], actionLabel, actionUrl }) {
  const safeRows = rows.filter((row) => row?.label && row?.value);
  const rowsHtml = safeRows.map((row) => `
    <tr>
      <td style="padding:8px 0;color:#64748B;font-size:13px;">${escapeHtml(row.label)}</td>
      <td style="padding:8px 0;color:#0F172A;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(row.value)}</td>
    </tr>`).join('');
  const button = actionUrl ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#1B998B;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 16px;font-weight:700;font-size:14px;">${escapeHtml(actionLabel || 'Open PropFlow')}</a></p>` : '';

  return `<!doctype html>
<html><body style="margin:0;background:#F7F8FA;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;padding:28px;">
      <p style="margin:0 0 12px;color:#1B998B;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(eyebrow || 'PropFlow')}</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#0B2545;">${escapeHtml(title)}</h1>
      <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
      ${safeRows.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:20px;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">${rowsHtml}</table>` : ''}
      ${button}
      <p style="margin:28px 0 0;color:#64748B;font-size:12px;line-height:1.5;">This is a transactional PropFlow email. No payment card details, private file links, or message bodies are stored in delivery logs.</p>
    </div>
  </div>
</body></html>`;
}

function buildText({ title, intro, rows = [], actionLabel, actionUrl }) {
  const detailLines = rows.filter((row) => row?.label && row?.value).map((row) => `${row.label}: ${row.value}`);
  return [
    'PropFlow',
    '',
    title,
    intro,
    detailLines.length ? `\n${detailLines.join('\n')}` : '',
    actionUrl ? `\n${actionLabel || 'Open PropFlow'}: ${actionUrl}` : '',
  ].filter(Boolean).join('\n');
}

function response(templateKey, subject, model) {
  return {
    templateKey,
    subject,
    html: layout(model),
    text: buildText(model),
    actionUrl: model.actionUrl || null,
  };
}

const builders = {
  team_invite(context) {
    const workspaceName = text(context.workspaceName, 'a PropFlow workspace');
    const role = text(context.roleLabel || context.role, 'team member');
    const actionUrl = sameOriginAppLink(context.invitePath || SAFE_PATHS.team_invite, context);
    return response('team_invite', `You're invited to ${workspaceName} on PropFlow`, {
      eyebrow: 'Team invite',
      title: `You're invited to ${workspaceName}`,
      intro: `${text(context.inviterName, 'A workspace admin')} invited you to join ${workspaceName} in PropFlow.`,
      rows: [
        { label: 'Workspace', value: workspaceName },
        { label: 'Role', value: role },
        { label: 'Workspace code', value: text(context.workspaceCode, '') },
      ],
      actionLabel: 'Accept invite',
      actionUrl,
    });
  },
  cleaning_task_assigned(context) {
    const propertyName = text(context.propertyName, 'Assigned property');
    const actionUrl = sameOriginAppLink(SAFE_PATHS.cleaning_task_assigned, context);
    return response('cleaning_task_assigned', `Cleaning task assigned: ${propertyName}`, {
      eyebrow: 'Cleaning assignment',
      title: 'A cleaning task has been assigned to you',
      intro: 'Review the task details in PropFlow before starting work.',
      rows: [
        { label: 'Property', value: propertyName },
        { label: 'Scheduled for', value: formatDate(context.scheduledFor) },
        { label: 'Checklist', value: text(context.checklistSummary, '') },
      ],
      actionLabel: 'Open cleaning task',
      actionUrl,
    });
  },
  maintenance_work_order_assigned(context) {
    const title = text(context.issueTitle, 'Maintenance work order');
    const actionUrl = sameOriginAppLink(SAFE_PATHS.maintenance_work_order_assigned, context);
    return response('maintenance_work_order_assigned', `Maintenance assigned: ${title}`, {
      eyebrow: 'Maintenance assignment',
      title: 'A maintenance work order has been assigned to you',
      intro: 'Review the work order and update status in PropFlow.',
      rows: [
        { label: 'Property', value: text(context.propertyName, 'Assigned property') },
        { label: 'Issue', value: title },
        { label: 'Priority', value: text(context.priority, 'normal') },
        { label: 'Due date', value: context.dueDate ? formatDate(context.dueDate) : '' },
      ],
      actionLabel: 'Open work order',
      actionUrl,
    });
  },
  direct_booking_request_confirmation(context) {
    const propertyName = text(context.propertyName, 'the property');
    const actionUrl = sameOriginAppLink(context.publicPath || '/', context);
    return response('direct_booking_request_confirmation', `Booking request received for ${propertyName}`, {
      eyebrow: 'Booking request',
      title: 'We received your booking request',
      intro: `Thanks, ${text(context.guestName, 'guest')}. The host will review your request and follow up soon.`,
      rows: [
        { label: 'Property', value: propertyName },
        { label: 'Check-in', value: formatDate(context.checkIn, '') },
        { label: 'Check-out', value: formatDate(context.checkOut, '') },
        { label: 'Guests', value: text(context.guestCount, '') },
        { label: 'Estimated total', value: money(context.quotedTotal, context.currency) },
      ],
      actionLabel: 'View booking page',
      actionUrl,
    });
  },
  direct_booking_request_received(context) {
    const propertyName = text(context.propertyName, 'Property');
    const actionUrl = sameOriginAppLink(SAFE_PATHS.direct_booking_request_received, context);
    return response('direct_booking_request_received', `New direct booking request: ${propertyName}`, {
      eyebrow: 'Direct booking',
      title: 'A guest submitted a direct booking request',
      intro: 'Review the request in PropFlow before approving or converting it.',
      rows: [
        { label: 'Guest', value: text(context.guestName, 'Guest') },
        { label: 'Property', value: propertyName },
        { label: 'Dates', value: [formatDate(context.checkIn, ''), formatDate(context.checkOut, '')].filter(Boolean).join(' → ') },
        { label: 'Estimated total', value: money(context.quotedTotal, context.currency) },
      ],
      actionLabel: 'Review request',
      actionUrl,
    });
  },
  direct_booking_payment_succeeded(context) {
    return response('direct_booking_payment_succeeded', 'Direct booking payment received', {
      eyebrow: 'Payment update',
      title: 'Direct booking payment succeeded',
      intro: 'A direct booking payment was confirmed. No card details are included in this email.',
      rows: [
        { label: 'Guest', value: text(context.guestName, '') },
        { label: 'Property', value: text(context.propertyName, '') },
        { label: 'Amount', value: money(context.amount, context.currency) },
      ],
      actionLabel: 'Open direct bookings',
      actionUrl: sameOriginAppLink(SAFE_PATHS.direct_booking_payment_succeeded, context),
    });
  },
  direct_booking_payment_failed(context) {
    return response('direct_booking_payment_failed', 'Direct booking payment could not be completed', {
      eyebrow: 'Payment update',
      title: 'Direct booking payment failed',
      intro: 'A direct booking payment could not be completed. No raw payment processor errors or card details are included.',
      rows: [
        { label: 'Guest', value: text(context.guestName, '') },
        { label: 'Property', value: text(context.propertyName, '') },
        { label: 'Amount', value: money(context.amount, context.currency) },
      ],
      actionLabel: 'Open direct bookings',
      actionUrl: sameOriginAppLink(SAFE_PATHS.direct_booking_payment_failed, context),
    });
  },
  owner_report_ready(context) {
    const actionUrl = sameOriginAppLink(SAFE_PATHS.owner_report_ready, context);
    return response('owner_report_ready', `Owner report ready: ${text(context.reportTitle, 'Owner report')}`, {
      eyebrow: 'Owner report',
      title: 'Your owner report is ready',
      intro: 'Sign in to PropFlow to review the report. Private files are not attached to this email.',
      rows: [
        { label: 'Report', value: text(context.reportTitle, 'Owner report') },
        { label: 'Property', value: text(context.propertyName, '') },
        { label: 'Date range', value: [formatDate(context.startDate, ''), formatDate(context.endDate, '')].filter(Boolean).join(' → ') },
      ],
      actionLabel: 'Open reports',
      actionUrl,
    });
  },
  billing_payment_failed(context) {
    const actionUrl = sameOriginAppLink(SAFE_PATHS.billing_payment_failed, context);
    return response('billing_payment_failed', 'PropFlow billing payment failed', {
      eyebrow: 'Billing',
      title: 'Billing payment failed',
      intro: 'A subscription payment could not be completed. Please update billing from PropFlow to avoid workspace access restrictions.',
      rows: [
        { label: 'Workspace', value: text(context.workspaceName, 'Workspace') },
        { label: 'Grace period ends', value: context.gracePeriodEndsAt ? formatDate(context.gracePeriodEndsAt) : '' },
      ],
      actionLabel: 'Open billing settings',
      actionUrl,
    });
  },
  subscription_billing_warning(context) {
    const actionUrl = sameOriginAppLink(SAFE_PATHS.subscription_billing_warning, context);
    return response('subscription_billing_warning', 'PropFlow subscription billing status update', {
      eyebrow: 'Billing status',
      title: 'Subscription billing status update',
      intro: 'Please review your workspace billing status in PropFlow.',
      rows: [
        { label: 'Workspace', value: text(context.workspaceName, 'Workspace') },
        { label: 'Status', value: text(context.billingStatus, 'Needs attention') },
      ],
      actionLabel: 'Open billing settings',
      actionUrl,
    });
  },
};

export function buildEmailTemplate(templateKey, context = {}) {
  if (!isApprovedTemplateKey(templateKey)) {
    const error = new Error('Unsupported transactional email template.');
    error.code = 'unsupported_template';
    throw error;
  }

  return builders[templateKey](context);
}
