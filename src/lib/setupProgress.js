import { roles } from '../data/constants.js';

const FULL_SETUP_ROLES = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const OPERATIONAL_SETUP_ROLES = [roles.HOST];
const EXCLUDED_SETUP_ROLES = [roles.CLEANER, roles.MAINTENANCE, roles.OWNER];

const STEP_DEFINITIONS = [
  {
    id: 'workspaceCreated',
    title: 'Workspace created',
    description: 'Set up your company workspace so your team can work from one place.',
    ctaLabel: 'Workspace created',
    ctaType: 'disabled',
    ctaTarget: null,
  },
  {
    id: 'defaultCurrency',
    title: 'Default currency selected',
    description: 'Set your reporting currency for consistent totals and forecasting.',
    ctaLabel: 'Set currency',
    ctaType: 'route',
    ctaTarget: '/settings',
  },
  { id: 'firstProperty', title: 'First property added', description: 'Add your first rental unit or listing.', ctaLabel: 'Add property', ctaType: 'createAction', ctaTarget: 'property' },
  { id: 'ownerAdded', title: 'Owner added', description: 'Capture owner contacts and ownership details.', ctaLabel: 'Add owner', ctaType: 'createAction', ctaTarget: 'owner' },
  { id: 'teamMemberAdded', title: 'Team member invited or added', description: 'Invite staff and assign the right role permissions.', ctaLabel: 'Invite team member', ctaType: 'route', ctaTarget: '/settings' },
  { id: 'firstBooking', title: 'First booking added', description: 'Track your first reservation inside this workspace.', ctaLabel: 'Add booking', ctaType: 'createAction', ctaTarget: 'booking' },
  { id: 'cleaningTaskCreated', title: 'Cleaning task created', description: 'Create a turnover or recurring cleaning task.', ctaLabel: 'Add cleaning task', ctaType: 'createAction', ctaTarget: 'cleaning' },
  { id: 'maintenanceWorkOrderCreated', title: 'Maintenance work order created', description: 'Log your first issue and track work order progress.', ctaLabel: 'Add maintenance work order', ctaType: 'createAction', ctaTarget: 'maintenance' },
  { id: 'supplyAdded', title: 'Supply/inventory item added', description: 'Track key operational inventory before stock runs low.', ctaLabel: 'Add supply item', ctaType: 'route', ctaTarget: '/inventory' },
  { id: 'reportsReviewed', title: 'Reports/dashboard reviewed', description: 'Review dashboard and reports once operational data exists.', ctaLabel: 'Review reports', ctaType: 'route', ctaTarget: '/reports' },
  { id: 'billingReviewed', title: 'Subscription/billing reviewed', description: 'Review billing and subscription details when billing data is available.', ctaLabel: 'Review billing', ctaType: 'route', ctaTarget: '/billing' },
];

function asArray(value) { return Array.isArray(value) ? value : []; }

function getUserRole(userRole) {
  if (Array.isArray(userRole)) return userRole[0] || null;
  return userRole || null;
}

function canSeeSetup(role) {
  if (!role) return true;
  if (EXCLUDED_SETUP_ROLES.includes(role)) return false;
  return FULL_SETUP_ROLES.includes(role) || OPERATIONAL_SETUP_ROLES.includes(role);
}

function canSeeStep(role, stepId) {
  if (!canSeeSetup(role)) return false;
  if (FULL_SETUP_ROLES.includes(role)) return true;
  if (OPERATIONAL_SETUP_ROLES.includes(role)) return !['ownerAdded', 'teamMemberAdded', 'billingReviewed'].includes(stepId);
  return true;
}

export function getWorkspaceSetupSteps({ currentWorkspace, data, userRole } = {}) {
  const role = getUserRole(userRole);
  if (!canSeeSetup(role)) return [];

  const properties = asArray(data?.properties);
  const contacts = asArray(data?.contacts);
  const owners = asArray(data?.owners);
  const ownerContacts = contacts.filter((record) => record?.type === 'owner');
  const members = asArray(data?.members);
  const invites = asArray(data?.invites);
  const bookings = asArray(data?.bookings);
  const cleaningTasks = asArray(data?.cleaningTasks);
  const maintenanceWorkOrders = asArray(data?.maintenanceWorkOrders);
  const supplies = asArray(data?.supplies);
  const ownerReports = asArray(data?.ownerReports);
  const dashboardViews = asArray(data?.dashboardViews);

  const billingData = data?.subscription || asArray(data?.billingEvents).length > 0 || asArray(data?.billingPlanLimits).length > 0;

  const completionById = {
    workspaceCreated: Boolean(currentWorkspace?.id),
    defaultCurrency: Boolean(currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency),
    firstProperty: properties.length > 0,
    ownerAdded: owners.length > 0 || ownerContacts.length > 0,
    teamMemberAdded: members.length > 1 || invites.length > 0,
    firstBooking: bookings.length > 0,
    cleaningTaskCreated: cleaningTasks.length > 0,
    maintenanceWorkOrderCreated: maintenanceWorkOrders.length > 0,
    supplyAdded: supplies.length > 0,
    reportsReviewed: ownerReports.length > 0 || dashboardViews.length > 0,
    billingReviewed: Boolean(billingData && data?.subscription),
  };

  return STEP_DEFINITIONS
    .filter((step) => canSeeStep(role, step.id))
    .map((step) => ({
      ...step,
      isComplete: Boolean(completionById[step.id]),
      secondaryLabel: completionById[step.id] ? 'Completed' : 'Not started',
      helperText: step.id === 'billingReviewed' && !data?.subscription
        ? 'Billing connection is optional here and only marks complete when subscription data exists.'
        : undefined,
    }));
}

export function getWorkspaceSetupProgress({ currentWorkspace, data, userRole } = {}) {
  const steps = getWorkspaceSetupSteps({ currentWorkspace, data, userRole });
  if (!steps.length) return { steps: [], completed: 0, total: 0, percent: 100, isComplete: true };
  const completed = steps.filter((step) => step.isComplete).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  return { steps, completed, total, percent, isComplete: completed === total };
}

export function isWorkspaceSetupComplete({ currentWorkspace, data, userRole } = {}) {
  return getWorkspaceSetupProgress({ currentWorkspace, data, userRole }).isComplete;
}
