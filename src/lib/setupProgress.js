function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasWorkspaceCurrency(workspace) {
  return Boolean(workspace?.defaultCurrency || workspace?.default_currency);
}

function getWorkspaceOwners(data) {
  const owners = toArray(data?.owners);
  if (owners.length > 0) return owners;

  return toArray(data?.contacts).filter((record) => record?.type === 'owner');
}

export function getWorkspaceSetupSteps({ currentWorkspace, data, userRole } = {}) {
  const properties = toArray(data?.properties);
  const bookings = toArray(data?.bookings);
  const cleaningTasks = toArray(data?.cleaningTasks);
  const maintenanceWorkOrders = toArray(data?.maintenanceWorkOrders);
  const supplies = toArray(data?.supplies);
  const owners = getWorkspaceOwners(data);
  const members = toArray(data?.members);
  const invites = toArray(data?.invites);

  return [
    {
      key: 'currency',
      label: 'Set workspace currency',
      title: 'Set default currency',
      description: 'Use the currency your business reports in for consistent totals.',
      done: hasWorkspaceCurrency(currentWorkspace),
      cta: { type: 'route', value: '/settings', text: 'Set currency' },
      action: () => {},
    },
    {
      key: 'property',
      label: 'Add first property',
      title: 'Add first property',
      description: 'Add your first listing or rental unit.',
      done: properties.length > 0,
      cta: { type: 'action', value: 'property', text: 'Add property' },
      createAction: 'property',
    },
    {
      key: 'invite',
      label: 'Invite team member',
      title: 'Invite team member',
      description: 'Invite staff with the correct workspace role.',
      done: members.length > 0 || invites.length > 0,
      cta: { type: 'action', value: 'invite', text: 'Invite team member' },
      createAction: 'invite',
    },
    {
      key: 'owner',
      label: 'Add owner',
      title: 'Add owner',
      description: 'Capture owner contacts and ownership details.',
      done: owners.length > 0,
      cta: { type: 'action', value: 'owner', text: 'Add owner' },
      createAction: 'owner',
    },
    {
      key: 'booking',
      label: 'Add booking',
      title: 'Add booking',
      description: 'Start tracking reservations in your workspace.',
      done: bookings.length > 0,
      cta: { type: 'action', value: 'booking', text: 'Add booking' },
      createAction: 'booking',
    },
    {
      key: 'cleaning',
      label: 'Add cleaning task',
      title: 'Add cleaning task',
      description: 'Create your first turnover or recurring cleaning task.',
      done: cleaningTasks.length > 0,
      cta: { type: 'action', value: 'cleaning', text: 'Add cleaning task' },
      createAction: 'cleaning',
    },
    {
      key: 'maintenance',
      label: 'Add maintenance work order',
      title: 'Add maintenance work order',
      description: 'Track issues, priorities, and repair status.',
      done: maintenanceWorkOrders.length > 0,
      cta: { type: 'action', value: 'maintenance', text: 'Add work order' },
      createAction: 'maintenance',
    },
    {
      key: 'supply',
      label: 'Add supply item',
      title: 'Add supply/inventory item',
      description: 'Track stock levels for operations.',
      done: supplies.length > 0,
      cta: { type: 'route', value: '/inventory', text: 'Add supply' },
      action: () => {},
    },
  ].filter((step) => (step.key === 'invite' ? userRole !== 'cleaner' : true));
}

export function getWorkspaceSetupProgress(input = {}) {
  const steps = getWorkspaceSetupSteps(input);
  const complete = steps.filter((step) => step.done).length;
  const progress = steps.length ? Math.round((complete / steps.length) * 100) : 0;

  return { steps, complete, total: steps.length, progress };
}

export function isWorkspaceSetupComplete(input = {}) {
  return getWorkspaceSetupProgress(input).progress === 100;
}
