export const currencies = ['USD', 'JMD', 'CAD', 'GBP', 'EUR', 'AUD', 'NZD', 'MXN'];

export const roles = {
  ADMIN: 'propflow_admin',
  OWNER_ADMIN: 'workspace_owner',
  PROPERTY_MANAGER: 'property_manager',
  HOST: 'host',
  ACCOUNTANT: 'accountant',
  OWNER: 'property_owner',
  CLEANER: 'cleaner',
  MAINTENANCE: 'maintenance',
};

export const rolePriority = [
  roles.ADMIN,
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
  roles.OWNER,
  roles.MAINTENANCE,
  roles.CLEANER,
  'guest',
];

export const roleLabels = {
  propflow_admin: 'PropFlow Admin',
  workspace_owner: 'Workspace Owner / Company Admin',
  property_manager: 'Property Manager',
  host: 'Host',
  accountant: 'Accountant / Bookkeeper',
  property_owner: 'Property Owner',
  cleaner: 'Cleaner',
  maintenance: 'Maintenance Crew',
  guest: 'Guest',
};

export const customerWorkspaceRoles = [
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
  roles.OWNER,
  roles.CLEANER,
  roles.MAINTENANCE,
];

export const inviteRoleOptions = [...customerWorkspaceRoles];

export const propertyScopedInviteRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

export const propertyAssignmentRoleOptions = [
  roles.OWNER,
  roles.CLEANER,
  roles.MAINTENANCE,
  roles.HOST,
  roles.ACCOUNTANT,
];

export const invitePermissionLevels = ['standard', 'limited'];

export const roleRedirects = {
  propflow_admin: '/admin',
  workspace_owner: '/dashboard',
  property_manager: '/dashboard',
  host: '/dashboard',
  accountant: '/accountant-dashboard',
  property_owner: '/owner-dashboard',
  cleaner: '/cleaner-dashboard',
  maintenance: '/maintenance-dashboard',
};

export const dashboardRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
export const propertyEditorRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
export const taskManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];


export const billingPlans = [
  ['starter', 'Starter'],
  ['pro', 'Pro'],
  ['business', 'Business'],
  ['enterprise', 'Enterprise'],
];

export const billingPlanDetails = [
  {
    key: 'starter',
    name: 'Starter',
    title: 'Starter',
    price: '$49/mo',
    priceMonthly: 49,
    audience: 'Solo hosts',
    description: 'For small portfolios starting with role-safe operations.',
    features: ['14-day trial', 'Up to 3 properties', 'Core operations', 'In-app notifications'],
  },
  {
    key: 'pro',
    name: 'Pro',
    title: 'Pro',
    price: '$129/mo',
    priceMonthly: 129,
    audience: 'Growing teams',
    description: 'For operators managing multiple properties and team workflows.',
    featured: true,
    features: ['14-day trial', 'Up to 15 properties', 'Owner reports', 'Inventory tracking'],
  },
  {
    key: 'business',
    name: 'Business',
    title: 'Business',
    price: '$299/mo',
    priceMonthly: 299,
    audience: 'Management companies',
    description: 'For larger teams that need finance visibility and direct booking readiness.',
    features: ['14-day trial', 'Up to 50 properties', 'Accountant dashboard', 'Direct booking readiness'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    title: 'Enterprise',
    price: 'Custom',
    priceMonthly: null,
    audience: 'Scaled operations',
    description: 'For multi-brand or high-volume operations that need custom onboarding.',
    features: ['14-day trial available', 'Custom limits', 'Priority setup', 'Workspace recovery support'],
  },
];

export const subscriptionStatuses = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'incomplete',
  'canceled',
  'cancelled',
  'paused',
  'restricted',
  'grace_period',
  'not_configured',
];

export const billingEventTypes = [
  'trial_started',
  'trial_ending',
  'checkout_started',
  'checkout_completed',
  'subscription_created',
  'subscription_updated',
  'subscription_canceled',
  'payment_succeeded',
  'payment_failed',
  'grace_period_started',
  'grace_period_ended',
  'access_restricted',
  'access_restored',
  'billing_portal_opened',
  'provider_not_configured',
];

export const billingAccessRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT];
export const billingManageRoles = [roles.ADMIN, roles.OWNER_ADMIN];

export const expenseCategories = [
  ['cleaning', 'Cleaning'],
  ['maintenance', 'Maintenance'],
  ['supplies', 'Supplies'],
  ['utilities', 'Utilities'],
  ['platform_fee', 'Platform fee'],
  ['owner_payout', 'Owner payout'],
  ['property_tax', 'Property tax'],
  ['insurance', 'Insurance'],
  ['repairs', 'Repairs'],
  ['other', 'Other'],
];

export const expensePaymentStatuses = [
  ['unpaid', 'Unpaid'],
  ['paid', 'Paid'],
  ['reimbursed', 'Reimbursed'],
  ['pending', 'Pending'],
  ['cancelled', 'Cancelled'],
];

export const expenseStatuses = [
  ['active', 'Active'],
  ['archived', 'Archived'],
  ['draft', 'Draft'],
];

export const propertyTypes = [
  'short_term_rental',
  'long_term_rental',
  'villa',
  'apartment',
  'house',
  'condo',
  'guesthouse',
  'hotel_small_resort',
  'commercial_property',
  'model_unit',
];

export const rentalTypes = ['short_term', 'long_term', 'both'];
export const propertyStatuses = ['active', 'vacant', 'occupied', 'maintenance_issue', 'archived'];


export const notificationChannels = [
  ['in_app', 'In-app'],
  ['email', 'Email'],
  ['sms', 'SMS'],
  ['whatsapp', 'WhatsApp'],
];

export const notificationEventTypes = [
  ['booking_created', 'Booking created'],
  ['booking_updated', 'Booking updated'],
  ['booking_checkin_due', 'Booking check-in due'],
  ['booking_checkout_due', 'Booking check-out due'],
  ['cleaning_task_assigned', 'Cleaning task assigned'],
  ['cleaning_task_due_soon', 'Cleaning task due soon'],
  ['cleaning_task_completed', 'Cleaning task completed'],
  ['cleaning_task_issue_reported', 'Cleaning task issue reported'],
  ['maintenance_work_order_created', 'Maintenance work order created'],
  ['maintenance_work_order_assigned', 'Maintenance work order assigned'],
  ['maintenance_work_order_urgent', 'Urgent maintenance work order'],
  ['maintenance_work_order_completed', 'Maintenance work order completed'],
  ['owner_report_ready', 'Owner report ready'],
  ['owner_report_released', 'Owner report released'],
  ['expense_created', 'Expense created'],
  ['low_stock_alert', 'Low-stock alert'],
  ['file_uploaded', 'File uploaded'],
  ['team_invite_created', 'Team invite created'],
  ['team_invite_accepted', 'Team invite accepted'],
  ['member_suspended', 'Member suspended'],
  ['member_reactivated', 'Member reactivated'],
  ['billing_payment_failed', 'Billing payment failed'],
  ['billing_trial_ending', 'Billing trial ending'],
  ['billing_grace_period_started', 'Billing grace period started'],
  ['billing_grace_period_warning', 'Billing grace period warning'],
  ['billing_access_restricted', 'Billing access restricted'],
  ['billing_access_restored', 'Billing access restored'],
  ['billing_provider_not_configured', 'Billing provider not configured'],
  ['workspace_activity', 'Workspace activity'],
];

export const notificationPreferenceGroups = [
  ['bookings', 'Bookings'],
  ['cleaning', 'Cleaning'],
  ['maintenance', 'Maintenance'],
  ['owner_reports', 'Owner reports'],
  ['finance', 'Finance'],
  ['inventory', 'Inventory'],
  ['files', 'Files'],
  ['team', 'Team'],
  ['billing', 'Billing'],
  ['workspace_activity', 'Workspace activity'],
];

export const notificationStatuses = [
  ['unread', 'Unread'],
  ['read', 'Read'],
  ['archived', 'Archived'],
];

export const deliveryStatuses = [
  ['queued', 'Queued'],
  ['skipped', 'Skipped'],
  ['sent', 'Sent'],
  ['failed', 'Failed'],
  ['provider_not_configured', 'Provider not configured'],
];
