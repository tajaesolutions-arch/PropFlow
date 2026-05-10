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

export const inviteRoleOptions = [
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
  roles.OWNER,
  roles.CLEANER,
  roles.MAINTENANCE,
];

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
