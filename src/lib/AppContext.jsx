import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { currencies, inviteRoleOptions, propertyStatuses, propertyTypes, rentalTypes, roles } from '../data/constants.js';
import { resolvePrimaryRole } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabase.js';

const AppContext = createContext(null);

const storageKey = 'propflow.currentWorkspaceId';

const workspaceCreationCurrencies = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];

function normalizeWorkspaceCurrency(value) {
  return String(value || 'USD').trim().toUpperCase();
}

function getErrorText(error) {
  return [error?.message, error?.details, error?.hint, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function formatAuthError(error, fallback = 'Authentication failed.') {
  const combined = getErrorText(error);
  const status = Number(error?.status || 0);

  if (combined.includes('already registered') || combined.includes('already exists') || combined.includes('user already')) {
    return 'This email is already registered. Log in instead, or use password reset if needed.';
  }

  if (combined.includes('password') && (combined.includes('weak') || combined.includes('short') || status === 422)) {
    return 'Choose a stronger password. Use at least 8 characters and avoid common passwords.';
  }

  if (combined.includes('email not confirmed') || combined.includes('confirm')) {
    return 'Email confirmation is required. Check your inbox, confirm your account, then log in again.';
  }

  if (combined.includes('invalid login') || combined.includes('invalid credentials')) {
    return 'Email or password is incorrect. Check your credentials and try again.';
  }

  if (combined.includes('failed to fetch') || combined.includes('network') || combined.includes('timeout')) {
    return 'Could not reach Supabase. Check your connection and try again.';
  }

  return fallback;
}

function formatWorkspaceCreationError(error) {
  const code = String(error?.code || '');
  const combined = getErrorText(error);

  if (combined.includes('failed to fetch') || combined.includes('network') || combined.includes('timeout')) {
    return 'Network issue while creating the workspace. Check your connection and try again.';
  }

  if (combined.includes('workspace_name_required') || combined.includes('null value')) {
    return 'Workspace/business name is required.';
  }

  if (combined.includes('missing_authenticated_session') || code === '28000') {
    return 'Your session expired. Sign in again before creating a workspace.';
  }

  if (combined.includes('invalid_default_currency') || combined.includes('default_currency')) {
    return 'Choose a supported launch currency: USD, JMD, CAD, GBP, or EUR.';
  }

  if (combined.includes('schema cache')) {
    return 'Workspace setup RPC is not visible to Supabase yet. Confirm the create_workspace_with_owner migration is applied, then wait briefly, reload the app, and try again.';
  }

  if (combined.includes('could not find the function') || combined.includes('function public.create_workspace_with_owner') || code === 'PGRST202' || code === '42883') {
    return 'Workspace setup is not deployed yet. Ask an admin to apply the create_workspace_with_owner RPC migration.';
  }

  if (combined.includes('row-level security') || combined.includes('permission denied') || code === '42501') {
    return 'Workspace setup is blocked by database security rules. Ask an admin to verify the workspace creation RPC grant and RLS migration.';
  }

  if (combined.includes('workspace_created_but_membership_failed')) {
    return 'Workspace setup could not finish assigning your owner membership. Please try again or contact support.';
  }

  if (combined.includes('workspace_creation_validation_failed')) {
    return 'Workspace setup could not be saved. Check the workspace details and try again.';
  }

  return 'Workspace could not be created. Please try again.';
}

const emptyData = {
  properties: [],
  cleaningTasks: [],
  maintenanceWorkOrders: [],
  bookings: [],
  leases: [],
  contacts: [],
  supplies: [],
  notifications: [],
  ownerReports: [],
  fileUploads: [],
  invites: [],
  members: [],
};

function firstResult(data) {
  return Array.isArray(data) ? data[0] : data;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanNumber(value) {
  if (value === '' || value === undefined || value === null) return null;

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
    return null;
  }

  const numericValue = Number(cleanValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function cleanEmail(value) {
  const text = String(value || '').trim().toLowerCase();
  return text || null;
}

function normalizeWorkspace(row) {
  if (!row) return null;

  return {
    ...row,
    defaultCurrency: row.default_currency || row.defaultCurrency || 'USD',
    code: row.company_code || row.code,
  };
}

function normalizeProperty(row) {
  if (!row) return row;

  return {
    ...row,
    rentalType: row.rental_type,
    propertyType: row.property_type,
    nightlyRate: row.nightly_rate,
    monthlyRent: row.monthly_rent,
    squareFeet: row.square_feet,
    assignedOwnerId: row.assigned_owner_id,
    archivedAt: row.archived_at,
  };
}

function normalizeCleaning(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    assignedCleanerId: row.assigned_cleaner_id,
    scheduledFor: row.scheduled_for,
    checklist: row.checklist_items || [],
    cleanerNotes: row.cleaner_notes,
    suppliesUsed: row.supplies_used,
  };
}

function normalizeMaintenance(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    description: row.description || row.issue_description || '',
    issueDescription: row.description || row.issue_description || '',
    assignedMaintenanceId: row.assigned_maintenance_id,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    partsNeeded: row.parts_needed,
    due: row.due_date,
  };
}

function normalizeBooking(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    contactId: row.contact_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestCount: row.guest_count,
    paymentStatus: row.payment_status,
    totalAmount: row.total_amount,
    cleaningFee: row.cleaning_fee,
    taxesFees: row.taxes_fees,
    ownerPayout: row.owner_payout,
    autoCreateCleaning: row.auto_create_cleaning,
    cancelledAt: row.cancelled_at,
  };
}

function normalizeLease(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || row.property || 'Unassigned property',
    propertyId: row.property_id,
    contactId: row.contact_id,
    tenantName: row.tenant_name,
    tenantEmail: row.tenant_email,
    tenantPhone: row.tenant_phone,
    leaseStart: row.lease_start,
    leaseEnd: row.lease_end,
    monthlyRent: row.monthly_rent,
    securityDeposit: row.security_deposit,
    rentPaymentStatus: row.rent_payment_status,
    leaseStatus: row.lease_status,
    leaseDocumentFileId: row.lease_document_file_id,
    terminatedAt: row.terminated_at,
  };
}

function normalizeSupply(row, properties = []) {
  if (!row) return row;

  const property = properties.find((item) => item.id === row.property_id);

  return {
    ...row,
    property: property?.name || 'Workspace supply',
    propertyId: row.property_id,
    itemName: row.item_name,
    currentQuantity: row.current_quantity,
    lowStockThreshold: row.low_stock_threshold,
    supplierName: row.supplier_name,
    supplierContact: row.supplier_contact,
    estimatedUnitCost: row.estimated_unit_cost,
    archivedAt: row.archived_at,
  };
}

function normalizeMember(row) {
  if (!row) return row;

  const profile = row.profiles || row.profile || null;

  return {
    ...row,
    profile,
    profiles: profile,
  };
}

function normalizeContact(row) {
  if (!row) return row;

  return {
    ...row,
    name: row.full_name || row.name,
    fullName: row.full_name || row.name,
    contactType: row.contact_type,
  };
}

function normalizeReport(row) {
  if (!row) return row;

  return {
    ...row,
    propertyId: row.property_id,
    reportType: row.report_type || row.type,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

function normalizeFileUpload(row) {
  if (!row) return row;

  return {
    ...row,
    propertyId: row.property_id,
    cleaningTaskId: row.cleaning_task_id,
    maintenanceWorkOrderId: row.maintenance_work_order_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using database actions.',
    );
  }

  return supabase;
}

function formatSupabaseError(error, fallback = 'The database action failed.') {
  if (!error) return fallback;

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  const message = parts.join(' ');

  return message || fallback;
}

function requireWorkspaceSession(workspace, activeSession) {
  if (!workspace?.id) {
    throw new Error('No workspace selected. Select or create a workspace before saving.');
  }

  if (!activeSession?.user?.id) {
    throw new Error('Your session expired. Sign in again before saving.');
  }
}

function inviteToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSavedWorkspaceId() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function saveWorkspaceId(workspaceId) {
  try {
    if (workspaceId) window.localStorage.setItem(storageKey, workspaceId);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Local storage may be unavailable in strict browser modes.
  }
}

async function safeQuery(label, query, fallback = []) {
  try {
    const { data, error } = await query;

    if (error) {
      console.error(`[PropFlow] Could not load ${label}`, error);
      return { data: fallback, error };
    }

    return { data: data || fallback, error: null };
  } catch (error) {
    console.error(`[PropFlow] Could not load ${label}`, error);
    return { data: fallback, error };
  }
}

function getWorkspaceCode(workspace) {
  return workspace?.company_code || workspace?.code || '';
}

function makeDateTimeFromDate(value, fallback = new Date()) {
  if (!value) return fallback.toISOString();

  const text = String(value);

  if (text.includes('T')) return text;

  return new Date(`${text}T11:00:00`).toISOString();
}

function stripUnsupportedPayloadKeys(payload, allowedKeys) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => allowedKeys.includes(key) && value !== undefined),
  );
}

const scopedInviteRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

const workspaceActionRoles = {
  property: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  booking: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  cleaning: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  maintenance: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  contact: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  invite: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  report: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT],
};

function assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, action) {
  const allowedRoles = workspaceActionRoles[action] || [];
  const activeMembership = asArray(memberships).find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status !== 'revoked',
  );
  const activeRoles = asArray(activeMembership?.roles || currentUser?.membership?.roles);

  if (!allowedRoles.some((role) => activeRoles.includes(role))) {
    throw new Error('Your current workspace role cannot create this type of record.');
  }
}

function requireWorkspaceProperty(properties, propertyId, label = 'property') {
  const property = asArray(properties).find((item) => item.id === propertyId);

  if (!property) {
    throw new Error(`Select an existing ${label} in this workspace.`);
  }

  return property;
}

function requireAllowedValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw new Error(`Select a valid ${label}.`);
  }
}

function findActiveWorkspaceMember(members, workspaceId, userId) {
  if (!userId) return null;

  return asArray(members).find(
    (member) =>
      member.workspace_id === workspaceId &&
      member.status === 'active' &&
      (member.user_id === userId || member.userId === userId || member.id === userId),
  );
}

function assertAssignedOwnerIsWorkspaceMember(members, workspaceId, assignedOwnerId) {
  if (!assignedOwnerId) return;

  const member = findActiveWorkspaceMember(members, workspaceId, assignedOwnerId);

  if (!member || !asArray(member.roles).includes(roles.OWNER)) {
    throw new Error('Assigned owner must be an active Property Owner member in this workspace.');
  }
}

function cleanNonNegativeNumber(value, label) {
  const numericValue = cleanNumber(value);

  if (numericValue !== null && numericValue < 0) {
    throw new Error(`${label} must be 0 or more.`);
  }

  return numericValue;
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [currentUser, setCurrentUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState(null);
  const [data, setData] = useState(emptyData);
  const [error, setError] = useState('');

  const refreshWorkspaceData = async (workspace = currentWorkspace) => {
    if (!supabase || !workspace?.id) {
      setData(emptyData);
      return { ok: true, warnings: [] };
    }

    const workspaceId = workspace.id;
    const nextData = { ...emptyData };
    const warnings = [];

    const propertiesResponse = await safeQuery(
      'properties',
      supabase
        .from('properties')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    );

    if (propertiesResponse.error) warnings.push(`properties: ${formatSupabaseError(propertiesResponse.error)}`);

    const properties = asArray(propertiesResponse.data).map(normalizeProperty);
    nextData.properties = properties;

    const workspaceQueries = [
      {
        label: 'workspace members',
        key: 'members',
        query: supabase
          .from('workspace_members')
          .select('*, profiles:profiles!workspace_members_user_id_fkey(full_name, email)')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        normalize: (rows) => rows.map(normalizeMember),
      },
      {
        label: 'bookings',
        key: 'bookings',
        query: supabase
          .from('bookings')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('check_in', { ascending: true }),
        normalize: (rows) => rows.map((row) => normalizeBooking(row, properties)),
      },
      {
        label: 'leases',
        key: 'leases',
        query: supabase
          .from('leases')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('lease_start', { ascending: true }),
        normalize: (rows) => rows.map((row) => normalizeLease(row, properties)),
      },
      {
        label: 'contacts',
        key: 'contacts',
        query: supabase
          .from('contacts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('updated_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeContact),
      },
      {
        label: 'cleaning tasks',
        key: 'cleaningTasks',
        query: supabase
          .from('cleaning_tasks')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('scheduled_for', { ascending: true }),
        normalize: (rows) => rows.map((row) => normalizeCleaning(row, properties)),
      },
      {
        label: 'maintenance work orders',
        key: 'maintenanceWorkOrders',
        query: supabase
          .from('maintenance_work_orders')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeMaintenance(row, properties)),
      },
      {
        label: 'supplies',
        key: 'supplies',
        query: supabase
          .from('supplies')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map((row) => normalizeSupply(row, properties)),
      },
      {
        label: 'workspace invites',
        key: 'invites',
        query: supabase
          .from('workspace_invites')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows,
      },
      {
        label: 'file uploads',
        key: 'fileUploads',
        query: supabase
          .from('file_uploads')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeFileUpload),
      },
      {
        label: 'notifications',
        key: 'notifications',
        query: supabase
          .from('notifications')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows,
      },
      {
        label: 'owner reports',
        key: 'ownerReports',
        query: supabase
          .from('owner_reports')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        normalize: (rows) => rows.map(normalizeReport),
      },
    ];

    const results = await Promise.all(
      workspaceQueries.map(async (item) => {
        const result = await safeQuery(item.label, item.query);
        return { ...item, ...result };
      }),
    );

    results.forEach((result) => {
      if (result.error) warnings.push(`${result.label}: ${formatSupabaseError(result.error)}`);
      nextData[result.key] = result.error ? [] : result.normalize(asArray(result.data));
    });

    setData(nextData);

    return {
      ok: warnings.length === 0,
      warnings,
    };
  };

  const loadAccount = async () => {
    if (!supabase) {
      setAuthLoading(false);
      setSession(null);
      setCurrentUser(null);
      setMemberships([]);
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setData(emptyData);
      return {
        session: null,
        currentUser: null,
        memberships: [],
        workspaces: [],
        currentWorkspace: null,
      };
    }

    setAuthLoading(true);
    setError('');

    try {
      const sessionResponse = await supabase.auth.getSession();
      const activeSession = sessionResponse.data?.session || null;
      const user = activeSession?.user || null;

      setSession(activeSession);

      if (!user) {
        setCurrentUser(null);
        setMemberships([]);
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
        setData(emptyData);
        saveWorkspaceId(null);

        return {
          session: null,
          currentUser: null,
          memberships: [],
          workspaces: [],
          currentWorkspace: null,
        };
      }

      let profile = null;

      const profileResponse = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileResponse.error) {
        console.warn('[PropFlow] Could not load profile, using auth user fallback.', profileResponse.error);
      } else {
        profile = profileResponse.data;
      }

      if (!profile) {
        const profilePayload = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.fullName || user.user_metadata?.full_name || user.email || '',
          status: 'active',
          is_propflow_admin: false,
        };

        const upsertResponse = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        profile = upsertResponse.data || profilePayload;
      }

      const membershipResponse = await supabase
        .from('workspace_members')
        .select('*, workspaces(*)')
        .eq('user_id', user.id)
        .neq('status', 'revoked')
        .order('created_at', { ascending: true });

      const membershipRows = membershipResponse.error ? [] : membershipResponse.data || [];
      const normalizedMemberships = membershipRows.map((membership) => ({
        ...membership,
        workspace: normalizeWorkspace(membership.workspaces),
        workspaces: normalizeWorkspace(membership.workspaces),
      }));

      const workspaceRows = normalizedMemberships
        .map((membership) => membership.workspace || membership.workspaces)
        .filter(Boolean);

      const savedWorkspaceId = getSavedWorkspaceId();
      const activeMembership =
        normalizedMemberships.find(
          (membership) =>
            membership.workspace_id === savedWorkspaceId &&
            membership.status !== 'revoked' &&
            membership.workspace,
        ) ||
        normalizedMemberships.find(
          (membership) => membership.status === 'active' && membership.workspace,
        ) ||
        normalizedMemberships.find((membership) => membership.workspace);

      const activeWorkspace = normalizeWorkspace(activeMembership?.workspace || activeMembership?.workspaces);

      if (activeWorkspace?.id) {
        saveWorkspaceId(activeWorkspace.id);
      }

      const memberRoles = Array.from(
        new Set(normalizedMemberships.flatMap((membership) => asArray(membership.roles))),
      );

      const userRoles = profile?.is_propflow_admin
        ? [roles.ADMIN, ...memberRoles]
        : memberRoles;

      const accountUser = {
        ...profile,
        id: user.id,
        email: profile?.email || user.email,
        fullName: profile?.full_name || profile?.fullName || user.email,
        full_name: profile?.full_name || profile?.fullName || user.email,
        status: profile?.status || 'active',
        roles: userRoles,
        role: resolvePrimaryRole(userRoles),
        workspaceId: activeWorkspace?.id || null,
        workspace_id: activeWorkspace?.id || null,
        membership: activeMembership || null,
      };

      setCurrentUser(accountUser);
      setMemberships(normalizedMemberships);
      setWorkspaces(workspaceRows);
      setCurrentWorkspaceState(activeWorkspace || null);

      if (activeWorkspace?.id) {
        await refreshWorkspaceData(activeWorkspace);
      } else {
        setData(emptyData);
      }

      return {
        session: activeSession,
        currentUser: accountUser,
        memberships: normalizedMemberships,
        workspaces: workspaceRows,
        currentWorkspace: activeWorkspace || null,
      };
    } catch (loadError) {
      console.error('[PropFlow] Account load failed', loadError);
      setError(loadError?.message || 'Could not load account.');
      return {
        session: null,
        currentUser: null,
        memberships: [],
        workspaces: [],
        currentWorkspace: null,
      };
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    loadAccount().catch((loadError) => {
      if (!mounted) return;
      console.error('[PropFlow] Initial account load failed', loadError);
      setError(loadError?.message || 'Could not load PropFlow.');
      setAuthLoading(false);
    });

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession || null);

      window.setTimeout(() => {
        if (mounted) loadAccount();
      }, 0);
    });

    return () => {
      mounted = false;
      subscription?.data?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrentWorkspace = async (workspaceId) => {
    const workspace = workspaces.find((item) => item.id === workspaceId) || null;

    setCurrentWorkspaceState(workspace);
    saveWorkspaceId(workspace?.id || null);

    if (workspace?.id) {
      await refreshWorkspaceData(workspace);
    } else {
      setData(emptyData);
    }

    return workspace;
  };

  const signIn = async (email, password) => {
    const client = requireSupabase();

    const { data: authData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw new Error(formatAuthError(signInError, 'Login failed.'));

    const accountState = await loadAccount();

    return {
      ...authData,
      accountState,
    };
  };

  const signUp = async ({ fullName, email, password }) => {
    const client = requireSupabase();

    const { data: authData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          fullName,
          full_name: fullName,
        },
      },
    });

    if (signUpError) throw new Error(formatAuthError(signUpError, 'Signup failed.'));

    if (authData?.user?.id) {
      const { error: profileError } = await client.from('profiles').upsert(
        {
          id: authData.user.id,
          full_name: fullName,
          email: cleanEmail(email),
          status: 'active',
          is_propflow_admin: false,
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        console.warn('[PropFlow] Signup profile upsert was deferred or blocked by RLS.', profileError);
      }
    }

    if (authData?.session) {
      await loadAccount();
    }

    return authData;
  };

  const signOut = async () => {
    const client = requireSupabase();

    await client.auth.signOut();

    setSession(null);
    setCurrentUser(null);
    setMemberships([]);
    setWorkspaces([]);
    setCurrentWorkspaceState(null);
    setData(emptyData);
    saveWorkspaceId(null);
  };

  const createWorkspace = async (payload) => {
    const client = requireSupabase();

    if (!session?.user?.id) {
      throw new Error('Your session expired. Sign in again before creating a workspace.');
    }

    const name = cleanText(payload.name);

    if (!name) {
      throw new Error('Workspace/business name is required.');
    }

    const defaultCurrency = normalizeWorkspaceCurrency(payload.default_currency || payload.defaultCurrency);

    if (!workspaceCreationCurrencies.includes(defaultCurrency)) {
      throw new Error('Choose a supported launch currency: USD, JMD, CAD, GBP, or EUR.');
    }

    const rpcPayload = {
      p_name: name,
      p_business_type: cleanText(payload.business_type),
      p_country: cleanText(payload.country) || 'United States',
      p_default_currency: defaultCurrency,
      p_business_email: cleanEmail(payload.business_email),
      p_phone: cleanText(payload.phone),
      p_website: cleanText(payload.website),
      p_property_count_estimate: cleanNumber(payload.property_count_estimate),
      p_plan_placeholder: cleanText(payload.plan_placeholder || payload.plan) || 'starter',
    };

    let rpcResponse;

    try {
      rpcResponse = await client.rpc('create_workspace_with_owner', rpcPayload);
    } catch (rpcError) {
      console.warn('[PropFlow] create_workspace_with_owner network/runtime failure', rpcError);
      throw new Error(formatWorkspaceCreationError(rpcError));
    }

    const { data: workspaceData, error: workspaceError } = rpcResponse;

    if (workspaceError) {
      console.warn('[PropFlow] create_workspace_with_owner failed', workspaceError);
      throw new Error(formatWorkspaceCreationError(workspaceError));
    }

    const workspace = normalizeWorkspace(firstResult(workspaceData));

    if (!workspace?.id) {
      console.warn('[PropFlow] create_workspace_with_owner returned no workspace row', workspaceData);
      throw new Error('Workspace setup could not finish assigning your owner membership. Please try again or contact support.');
    }

    saveWorkspaceId(workspace.id);
    await loadAccount();

    return workspace;
  };

  const joinWorkspace = async ({ token, code }) => {
    const client = requireSupabase();

    if (!session?.user?.id) {
      throw new Error('Log in before joining a workspace.');
    }

    const value = String(token || code || '').trim();

    if (!value) {
      throw new Error('Enter a valid invite token or company code.');
    }

    const currentEmail = cleanEmail(currentUser?.email || session.user.email);

    if (!currentEmail) {
      throw new Error('Your signed-in account needs an email address before joining a workspace.');
    }

    let inviteQuery = client
      .from('workspace_invites')
      .select('*')
      .eq('status', 'pending')
      .eq('email', currentEmail)
      .limit(1);

    if (token) {
      inviteQuery = inviteQuery.eq('token', value);
    } else {
      inviteQuery = inviteQuery.eq('workspace_code', value);
    }

    const { data: inviteRows, error: inviteError } = await inviteQuery;
    if (inviteError) {
      throw new Error(formatSupabaseError(inviteError, 'Could not validate invite.'));
    }

    const invite = inviteRows?.[0];

    if (!invite) {
      throw new Error('Invite not found, expired, or already used.');
    }

    const invitedEmail = cleanEmail(invite.email);

    if (!invitedEmail || invitedEmail !== currentEmail) {
      throw new Error('This invite was created for a different email address. Log in with the invited email to join.');
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new Error('Invite not found, expired, or already used.');
    }

    const inviteRoles = asArray(invite.roles).filter((role) => inviteRoleOptions.includes(role));

    if (!inviteRoles.length || inviteRoles.length !== asArray(invite.roles).length) {
      throw new Error('This invite contains an unsupported role. Ask the workspace owner to send a new invite.');
    }

    const { error: memberError } = await client.from('workspace_members').upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: session.user.id,
        roles: inviteRoles,
        status: 'active',
        invited_by: invite.invited_by || null,
      },
      { onConflict: 'workspace_id,user_id' },
    );

    if (memberError) {
      console.warn('[PropFlow] Workspace invite membership insert failed', memberError);
      throw new Error(formatSupabaseError(memberError, 'Could not join workspace.'));
    }

    const { error: acceptError } = await client
      .from('workspace_invites')
      .update({
        status: 'accepted',
        accepted_by: session.user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)
      .eq('status', 'pending');

    if (acceptError) {
      console.warn('[PropFlow] Workspace invite status update failed after membership creation', acceptError);
    }

    saveWorkspaceId(invite.workspace_id);
    await loadAccount();

    return invite;
  };

  const createProperty = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'property');

    const allowed = [
      'name',
      'address',
      'city',
      'state',
      'country',
      'property_type',
      'rental_type',
      'currency',
      'status',
      'nightly_rate',
      'monthly_rent',
      'assigned_owner_id',
      'bedrooms',
      'bathrooms',
      'square_feet',
      'notes',
    ];

    const propertyPayload = stripUnsupportedPayloadKeys(payload, allowed);

    propertyPayload.workspace_id = currentWorkspace.id;
    propertyPayload.created_by = session.user.id;
    propertyPayload.name = cleanText(propertyPayload.name);
    propertyPayload.address = cleanText(propertyPayload.address);

    if (!propertyPayload.name) throw new Error('Property name is required.');
    if (!propertyPayload.address) throw new Error('Address or location is required.');
    propertyPayload.city = cleanText(propertyPayload.city);
    propertyPayload.state = cleanText(propertyPayload.state);
    propertyPayload.country = cleanText(propertyPayload.country) || currentWorkspace.country || 'United States';
    propertyPayload.property_type = propertyPayload.property_type || 'short_term_rental';
    propertyPayload.rental_type = propertyPayload.rental_type || 'short_term';
    propertyPayload.currency = propertyPayload.currency || currentWorkspace.defaultCurrency || 'USD';
    propertyPayload.status = propertyPayload.status || 'active';
    propertyPayload.notes = cleanText(propertyPayload.notes);
    propertyPayload.assigned_owner_id = propertyPayload.assigned_owner_id || null;

    requireAllowedValue(propertyPayload.property_type, propertyTypes, 'property type');
    requireAllowedValue(propertyPayload.rental_type, rentalTypes, 'rental type');
    requireAllowedValue(propertyPayload.currency, currencies, 'currency');
    requireAllowedValue(propertyPayload.status, propertyStatuses, 'property status');
    assertAssignedOwnerIsWorkspaceMember(memberships, currentWorkspace.id, propertyPayload.assigned_owner_id);
    propertyPayload.nightly_rate = cleanNonNegativeNumber(propertyPayload.nightly_rate, 'Nightly rate');
    propertyPayload.monthly_rent = cleanNonNegativeNumber(propertyPayload.monthly_rent, 'Monthly rent');
    propertyPayload.bedrooms = cleanNonNegativeNumber(propertyPayload.bedrooms, 'Bedrooms');
    propertyPayload.bathrooms = cleanNonNegativeNumber(propertyPayload.bathrooms, 'Bathrooms');
    propertyPayload.square_feet = cleanNonNegativeNumber(propertyPayload.square_feet, 'Square footage');

    const { data: row, error: insertError } = await client
      .from('properties')
      .insert(propertyPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Property could not be saved.'));

    await refreshWorkspaceData();

    return normalizeProperty(row);
  };

  const updateProperty = async (propertyId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'name',
      'address',
      'city',
      'state',
      'country',
      'property_type',
      'rental_type',
      'currency',
      'status',
      'nightly_rate',
      'monthly_rent',
      'assigned_owner_id',
      'bedrooms',
      'bathrooms',
      'square_feet',
      'notes',
      'archived_at',
    ];

    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'property');

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if ('name' in updatePayload) updatePayload.name = cleanText(updatePayload.name);
    if ('address' in updatePayload) updatePayload.address = cleanText(updatePayload.address);
    if ('city' in updatePayload) updatePayload.city = cleanText(updatePayload.city);
    if ('state' in updatePayload) updatePayload.state = cleanText(updatePayload.state);
    if ('country' in updatePayload) updatePayload.country = cleanText(updatePayload.country);
    if ('notes' in updatePayload) updatePayload.notes = cleanText(updatePayload.notes);
    if ('assigned_owner_id' in updatePayload) updatePayload.assigned_owner_id = updatePayload.assigned_owner_id || null;

    if ('name' in updatePayload && !updatePayload.name) throw new Error('Property name is required.');
    if ('address' in updatePayload && !updatePayload.address) throw new Error('Address or location is required.');
    if ('property_type' in updatePayload) requireAllowedValue(updatePayload.property_type, propertyTypes, 'property type');
    if ('rental_type' in updatePayload) requireAllowedValue(updatePayload.rental_type, rentalTypes, 'rental type');
    if ('currency' in updatePayload) requireAllowedValue(updatePayload.currency, currencies, 'currency');
    if ('status' in updatePayload) requireAllowedValue(updatePayload.status, propertyStatuses, 'property status');
    if ('assigned_owner_id' in updatePayload) {
      assertAssignedOwnerIsWorkspaceMember(memberships, currentWorkspace.id, updatePayload.assigned_owner_id);
    }

    const numericLabels = {
      nightly_rate: 'Nightly rate',
      monthly_rent: 'Monthly rent',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      square_feet: 'Square footage',
    };

    ['nightly_rate', 'monthly_rent', 'bedrooms', 'bathrooms', 'square_feet'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNonNegativeNumber(updatePayload[key], numericLabels[key]);
    });

    const { data: row, error: updateError } = await client
      .from('properties')
      .update(updatePayload)
      .eq('id', propertyId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Property could not be updated.'));

    await refreshWorkspaceData();

    return normalizeProperty(row);
  };

  const archiveProperty = async (propertyId, archived = true) =>
    updateProperty(propertyId, {
      status: archived ? 'archived' : 'active',
      archived_at: archived ? new Date().toISOString() : null,
    });

  const createOrUpdateContact = async ({
    full_name,
    name,
    email,
    phone,
    contact_type = 'other',
    notes,
  }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'contact');

    const fullName = cleanText(full_name || name);

    if (!fullName) {
      throw new Error('Contact name is required.');
    }

    const rpcPayload = {
      p_workspace_id: currentWorkspace.id,
      p_full_name: fullName,
      p_email: cleanEmail(email),
      p_phone: cleanText(phone),
      p_contact_type: ['owner', 'guest', 'tenant', 'other'].includes(contact_type) ? contact_type : 'other',
      p_notes: cleanText(notes),
    };

    const rpcResponse = await client.rpc('create_or_update_contact', rpcPayload);

    if (!rpcResponse.error && rpcResponse.data) {
      await refreshWorkspaceData();
      return normalizeContact(firstResult(rpcResponse.data));
    }

    const fallbackPayload = {
      workspace_id: currentWorkspace.id,
      full_name: fullName,
      email: cleanEmail(email),
      phone: cleanText(phone),
      contact_type: ['owner', 'guest', 'tenant', 'other'].includes(contact_type) ? contact_type : 'other',
      notes: cleanText(notes),
      created_by: session.user.id,
    };

    const insertResponse = await client
      .from('contacts')
      .insert(fallbackPayload)
      .select('*')
      .single();

    if (insertResponse.error) {
      throw new Error(formatSupabaseError(insertResponse.error, 'Contact could not be saved.'));
    }

    await refreshWorkspaceData();

    return normalizeContact(insertResponse.data);
  };

  const createContact = (payload) => createOrUpdateContact(payload);
  const createOwner = (payload) => createOrUpdateContact({ ...payload, contact_type: 'owner' });
  const createGuest = (payload) => createOrUpdateContact({ ...payload, contact_type: 'guest' });

  const createBooking = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'booking');
    requireWorkspaceProperty(data.properties, payload.property_id);

    if (!cleanText(payload.guest_name)) throw new Error('Guest name is required.');
    if (!payload.check_in || !payload.check_out) throw new Error('Check-in and check-out dates are required.');
    if (payload.check_out <= payload.check_in) throw new Error('Check-out must be after check-in.');
    requireAllowedValue(payload.status || 'confirmed', ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed'], 'booking status');
    requireAllowedValue(payload.payment_status || 'unpaid', ['unpaid', 'partially_paid', 'paid'], 'payment status');

    let contact = null;

    if (payload.guest_name || payload.guest_email || payload.guest_phone) {
      contact = await createOrUpdateContact({
        full_name: payload.guest_name,
        email: payload.guest_email,
        phone: payload.guest_phone,
        contact_type: 'guest',
        notes: payload.notes,
      });
    }

    const bookingPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id,
      contact_id: contact?.id || payload.contact_id || null,
      guest_name: cleanText(payload.guest_name),
      guest_email: cleanEmail(payload.guest_email),
      guest_phone: cleanText(payload.guest_phone),
      check_in: payload.check_in,
      check_out: payload.check_out,
      guest_count: Number(payload.guest_count || 1),
      source: payload.source || 'manual',
      status: payload.status || 'confirmed',
      payment_status: payload.payment_status || 'unpaid',
      currency: payload.currency || currentWorkspace.defaultCurrency || 'USD',
      total_amount: cleanNumber(payload.total_amount),
      cleaning_fee: cleanNumber(payload.cleaning_fee),
      taxes_fees: cleanNumber(payload.taxes_fees),
      owner_payout: cleanNumber(payload.owner_payout),
      notes: cleanText(payload.notes),
      auto_create_cleaning: payload.auto_create_cleaning ?? true,
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('bookings')
      .insert(bookingPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Booking could not be saved.'));

    await refreshWorkspaceData();

    return normalizeBooking(row, data.properties);
  };

  const updateBooking = async (bookingId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'property_id',
      'contact_id',
      'guest_name',
      'guest_email',
      'guest_phone',
      'check_in',
      'check_out',
      'guest_count',
      'source',
      'status',
      'payment_status',
      'currency',
      'total_amount',
      'cleaning_fee',
      'taxes_fees',
      'owner_payout',
      'notes',
      'auto_create_cleaning',
      'cancelled_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    ['total_amount', 'cleaning_fee', 'taxes_fees', 'owner_payout'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNumber(updatePayload[key]);
    });

    if (updatePayload.status === 'cancelled' && !updatePayload.cancelled_at) {
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Booking could not be updated.'));

    await refreshWorkspaceData();

    return normalizeBooking(row, data.properties);
  };

  const createLease = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    let contact = null;

    if (payload.tenant_name || payload.tenant_email || payload.tenant_phone) {
      contact = await createOrUpdateContact({
        full_name: payload.tenant_name,
        email: payload.tenant_email,
        phone: payload.tenant_phone,
        contact_type: 'tenant',
        notes: payload.notes,
      });
    }

    const leasePayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id,
      contact_id: contact?.id || payload.contact_id || null,
      tenant_name: cleanText(payload.tenant_name),
      tenant_email: cleanEmail(payload.tenant_email),
      tenant_phone: cleanText(payload.tenant_phone),
      lease_start: payload.lease_start,
      lease_end: payload.lease_end || null,
      monthly_rent: cleanNumber(payload.monthly_rent),
      security_deposit: cleanNumber(payload.security_deposit),
      rent_payment_status: payload.rent_payment_status || 'unknown',
      lease_status: payload.lease_status || 'active',
      currency: payload.currency || currentWorkspace.defaultCurrency || 'USD',
      lease_document_file_id: payload.lease_document_file_id || null,
      notes: cleanText(payload.notes),
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('leases')
      .insert(leasePayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Lease could not be saved.'));

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const updateLease = async (leaseId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'property_id',
      'contact_id',
      'tenant_name',
      'tenant_email',
      'tenant_phone',
      'lease_start',
      'lease_end',
      'monthly_rent',
      'security_deposit',
      'rent_payment_status',
      'lease_status',
      'currency',
      'lease_document_file_id',
      'notes',
      'terminated_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    ['monthly_rent', 'security_deposit'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNumber(updatePayload[key]);
    });

    if (['terminated', 'cancelled'].includes(updatePayload.lease_status) && !updatePayload.terminated_at) {
      updatePayload.terminated_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('leases')
      .update(updatePayload)
      .eq('id', leaseId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Lease could not be updated.'));

    await refreshWorkspaceData();

    return normalizeLease(row, data.properties);
  };

  const createCleaningTask = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'cleaning');
    requireWorkspaceProperty(data.properties, payload.property_id);

    if (!payload.scheduled_for) throw new Error('Cleaning date is required.');
    requireAllowedValue(payload.status || 'scheduled', ['scheduled', 'in_progress', 'needs_inspection', 'completed'], 'cleaning status');

    if (payload.booking_id) {
      const linkedBooking = asArray(data.bookings).find((booking) => booking.id === payload.booking_id);
      if (!linkedBooking || linkedBooking.property_id !== payload.property_id) {
        throw new Error('Related booking must belong to the selected property in this workspace.');
      }
    }

    const cleaningPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id,
      booking_id: payload.booking_id || null,
      assigned_cleaner_id: payload.assigned_cleaner_id || null,
      scheduled_for: makeDateTimeFromDate(payload.scheduled_for),
      status: payload.status || 'scheduled',
      checklist_items: payload.checklist_items || payload.checklist || [],
      cleaner_notes: cleanText(payload.cleaner_notes),
      supplies_used: cleanText(payload.supplies_used),
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('cleaning_tasks')
      .insert(cleaningPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Cleaning task could not be saved.'));

    await refreshWorkspaceData();

    return normalizeCleaning(row, data.properties);
  };

  const updateCleaningTask = async (taskId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'property_id',
      'booking_id',
      'assigned_cleaner_id',
      'scheduled_for',
      'status',
      'checklist_items',
      'cleaner_notes',
      'supplies_used',
      'low_supplies_reported',
      'issue_reported',
      'started_at',
      'completed_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if (updatePayload.scheduled_for) {
      updatePayload.scheduled_for = makeDateTimeFromDate(updatePayload.scheduled_for);
    }

    if (updatePayload.status === 'completed' && !updatePayload.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    if (updatePayload.status === 'in_progress' && !updatePayload.started_at) {
      updatePayload.started_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('cleaning_tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Cleaning task could not be updated.'));

    await refreshWorkspaceData();

    return normalizeCleaning(row, data.properties);
  };

  const createMaintenanceWorkOrder = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'maintenance');
    requireWorkspaceProperty(data.properties, payload.property_id);

    if (!cleanText(payload.title)) throw new Error('Issue title is required.');
    requireAllowedValue(payload.priority || 'medium', ['low', 'medium', 'high', 'urgent'], 'priority');
    requireAllowedValue(payload.status || 'reported', ['open', 'reported', 'assigned', 'in_progress', 'waiting_parts', 'waiting_for_parts', 'completed'], 'maintenance status');

    const description = cleanText(payload.description || payload.issue_description) || 'No description provided.';

    const workOrderPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id,
      reported_by_user_id: session.user.id,
      assigned_maintenance_id: payload.assigned_maintenance_id || null,
      title: cleanText(payload.title),
      description,
      priority: payload.priority || 'medium',
      status: payload.status === 'open' ? 'reported' : payload.status || 'reported',
      estimated_cost: cleanNumber(payload.estimated_cost),
      actual_cost: cleanNumber(payload.actual_cost),
      parts_needed: cleanText(payload.parts_needed),
      due_date: payload.due_date || null,
      notes: cleanText(payload.notes),
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('maintenance_work_orders')
      .insert(workOrderPayload)
      .select('*')
      .single();

    if (insertError) {
      throw new Error(formatSupabaseError(insertError, 'Maintenance work order could not be saved.'));
    }

    await refreshWorkspaceData();

    return normalizeMaintenance(row, data.properties);
  };

  const updateMaintenanceWorkOrder = async (workOrderId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'property_id',
      'reported_by_user_id',
      'assigned_maintenance_id',
      'title',
      'description',
      'issue_description',
      'priority',
      'status',
      'estimated_cost',
      'actual_cost',
      'parts_needed',
      'due_date',
      'notes',
      'completed_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    if ('issue_description' in updatePayload) {
      updatePayload.description = updatePayload.issue_description;
      delete updatePayload.issue_description;
    }

    if (updatePayload.status === 'open') updatePayload.status = 'reported';

    ['estimated_cost', 'actual_cost'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNumber(updatePayload[key]);
    });

    if (updatePayload.status === 'completed' && !updatePayload.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data: row, error: updateError } = await client
      .from('maintenance_work_orders')
      .update(updatePayload)
      .eq('id', workOrderId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Maintenance work order could not be updated.'));
    }

    await refreshWorkspaceData();

    return normalizeMaintenance(row, data.properties);
  };

  const createSupply = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const supplyPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id || null,
      item_name: cleanText(payload.item_name),
      category: cleanText(payload.category),
      current_quantity: cleanNumber(payload.current_quantity) ?? 0,
      low_stock_threshold: cleanNumber(payload.low_stock_threshold) ?? 0,
      unit: cleanText(payload.unit) || 'unit',
      supplier_name: cleanText(payload.supplier_name),
      supplier_contact: cleanText(payload.supplier_contact),
      estimated_unit_cost: cleanNumber(payload.estimated_unit_cost),
      currency: payload.currency || currentWorkspace.defaultCurrency || 'USD',
      notes: cleanText(payload.notes),
      archived_at: payload.archived_at || null,
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('supplies')
      .insert(supplyPayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Supply could not be saved.'));

    await refreshWorkspaceData();

    return normalizeSupply(row, data.properties);
  };

  const updateSupply = async (supplyId, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const allowed = [
      'property_id',
      'item_name',
      'category',
      'current_quantity',
      'low_stock_threshold',
      'unit',
      'supplier_name',
      'supplier_contact',
      'estimated_unit_cost',
      'currency',
      'notes',
      'archived_at',
    ];

    const updatePayload = stripUnsupportedPayloadKeys(payload, allowed);

    ['current_quantity', 'low_stock_threshold', 'estimated_unit_cost'].forEach((key) => {
      if (key in updatePayload) updatePayload[key] = cleanNumber(updatePayload[key]);
    });

    const { data: row, error: updateError } = await client
      .from('supplies')
      .update(updatePayload)
      .eq('id', supplyId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) throw new Error(formatSupabaseError(updateError, 'Supply could not be updated.'));

    await refreshWorkspaceData();

    return normalizeSupply(row, data.properties);
  };

  const archiveSupply = async (supplyId, archived = true) =>
    updateSupply(supplyId, {
      archived_at: archived ? new Date().toISOString() : null,
    });

  const createInvite = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'invite');

    const token = inviteToken();
    const roleList = (payload.roles || [payload.role]).filter((role) => inviteRoleOptions.includes(role));

    if (!cleanEmail(payload.email)) throw new Error('Invitee email is required.');
    if (!roleList.length) throw new Error('Select at least one valid role for this invite.');

    const requestedPropertyIds = [
      payload.assigned_property_id,
      payload.property_id,
      ...(payload.assigned_property_ids || []),
    ].filter(Boolean);
    const uniquePropertyIds = Array.from(new Set(requestedPropertyIds));
    const needsPropertyScope = roleList.some((role) => scopedInviteRoles.includes(role));
    const assignedPropertyIds = needsPropertyScope
      ? uniquePropertyIds.filter((propertyId) => asArray(data.properties).some((property) => property.id === propertyId))
      : [];

    if (needsPropertyScope && uniquePropertyIds.length !== assignedPropertyIds.length) {
      throw new Error('Assigned properties must be existing properties in this workspace.');
    }

    const invitePayload = {
      workspace_id: currentWorkspace.id,
      email: cleanEmail(payload.email),
      roles: roleList,
      assigned_property_ids: assignedPropertyIds,
      token,
      workspace_code: getWorkspaceCode(currentWorkspace),
      message: cleanText(payload.message),
      status: 'pending',
      expires_at: payload.expires_at ? new Date(payload.expires_at).toISOString() : null,
      invited_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('workspace_invites')
      .insert(invitePayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'Invite could not be created.'));

    await refreshWorkspaceData();

    return row;
  };

  const createWorkspaceInvite = createInvite;
  const inviteTeamMember = createInvite;

  const createReport = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    assertWorkspaceActionRole(currentUser, memberships, currentWorkspace, 'report');

    const reportPayload = {
      workspace_id: currentWorkspace.id,
      property_id: payload.property_id || null,
      title: cleanText(payload.title) || 'Owner report',
      report_type: payload.report_type || 'owner_report',
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      notes: cleanText(payload.notes),
      status: payload.status || 'draft',
      created_by: session.user.id,
    };

    const { data: row, error: insertError } = await client
      .from('owner_reports')
      .insert(reportPayload)
      .select('*')
      .single();

    if (insertError) {
      throw new Error(formatSupabaseError(insertError, 'Report could not be saved. Confirm the owner_reports columns exist.'));
    }

    await refreshWorkspaceData();

    return normalizeReport(row);
  };

  const createOwnerReport = createReport;

  const createExpense = async () => {
    throw new Error(
      'Expense saving requires a dedicated expenses table. Create that table first, then connect this action.',
    );
  };

  const createWorkspaceExpense = createExpense;

  const uploadWorkspaceFile = async ({
    file,
    propertyId,
    property_id,
    cleaningTaskId,
    cleaning_task_id,
    maintenanceWorkOrderId,
    maintenance_work_order_id,
    category = 'property_document',
  }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    if (!file) {
      throw new Error('Choose a file before uploading.');
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `${currentWorkspace.id}/${Date.now()}-${safeFileName}`;
    const bucket = 'propflow-private';

    const uploadResponse = await client.storage.from(bucket).upload(storagePath, file, {
      upsert: false,
    });

    if (uploadResponse.error) {
      throw new Error(formatSupabaseError(uploadResponse.error, 'File upload failed.'));
    }

    const filePayload = {
      workspace_id: currentWorkspace.id,
      property_id: propertyId || property_id || null,
      cleaning_task_id: cleaningTaskId || cleaning_task_id || null,
      maintenance_work_order_id: maintenanceWorkOrderId || maintenance_work_order_id || null,
      uploaded_by: session.user.id,
      bucket,
      path: storagePath,
      file_name: file.name,
      file_type: file.type || null,
      file_size: file.size || null,
      category,
    };

    const { data: row, error: insertError } = await client
      .from('file_uploads')
      .insert(filePayload)
      .select('*')
      .single();

    if (insertError) throw new Error(formatSupabaseError(insertError, 'File record could not be saved.'));

    await refreshWorkspaceData();

    return normalizeFileUpload(row);
  };

  const markNotificationRead = async (notificationId) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);

    const { data: row, error: updateError } = await client
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', notificationId)
      .eq('workspace_id', currentWorkspace.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Notification could not be updated.'));
    }

    await refreshWorkspaceData();

    return row;
  };

  const contextValue = useMemo(
    () => ({
      isSupabaseConfigured,
      session,
      authLoading,
      loading: authLoading,
      currentUser,
      memberships,
      workspaces,
      currentWorkspace,
      data,
      error,
      loadAccount,
      refreshWorkspaceData,
      setCurrentWorkspace,
      signIn,
      signUp,
      signOut,
      createWorkspace,
      joinWorkspace,
      createProperty,
      updateProperty,
      archiveProperty,
      createBooking,
      updateBooking,
      createLease,
      updateLease,
      createCleaningTask,
      updateCleaningTask,
      createMaintenanceWorkOrder,
      updateMaintenanceWorkOrder,
      createContact,
      createOwner,
      createGuest,
      createInvite,
      createWorkspaceInvite,
      inviteTeamMember,
      createSupply,
      updateSupply,
      archiveSupply,
      createReport,
      createOwnerReport,
      createExpense,
      createWorkspaceExpense,
      uploadWorkspaceFile,
      markNotificationRead,
    }),
    [
      session,
      authLoading,
      currentUser,
      memberships,
      workspaces,
      currentWorkspace,
      data,
      error,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used inside AppProvider.');
  }

  return context;
}
