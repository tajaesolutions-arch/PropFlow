export const currencies = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];

export const roles = {
  ADMIN: 'propflow_admin',
  OWNER_ADMIN: 'workspace_owner',
  PROPERTY_MANAGER: 'property_manager',
  HOST: 'host',
  OWNER: 'owner',
  CLEANER: 'cleaner',
  MAINTENANCE: 'maintenance_crew',
};

export const roleLabels = {
  propflow_admin: 'PropFlow Admin',
  workspace_owner: 'Workspace Owner / Company Admin',
  property_manager: 'Property Manager',
  host: 'Host',
  owner: 'Owner',
  cleaner: 'Cleaner',
  maintenance_crew: 'Maintenance Crew',
};

export const roleRedirects = {
  propflow_admin: '/admin',
  workspace_owner: '/dashboard',
  property_manager: '/dashboard',
  host: '/dashboard',
  owner: '/owner-dashboard',
  cleaner: '/cleaner-dashboard',
  maintenance_crew: '/maintenance-dashboard',
};

export const dashboardRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
