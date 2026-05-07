import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { roles } from '../data/constants.js';
import { resolvePrimaryRole } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabase.js';

const AppContext = createContext(null);
const emptyData = { properties: [], cleaningTasks: [], maintenanceWorkOrders: [], bookings: [], leases: [], contacts: [], supplies: [], notifications: [], ownerReports: [], fileUploads: [], invites: [], members: [] };
const customerAssignableRoles = new Set([roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT, roles.OWNER, roles.CLEANER, roles.MAINTENANCE]);
const storageKey = 'propflow.currentWorkspaceId';

function normalizeWorkspace(row) {
  if (!row) return null;
  return { ...row, defaultCurrency: row.default_currency || row.defaultCurrency || 'USD', code: row.company_code || row.code };
}

function firstResult(data) {
  return Array.isArray(data) ? data[0] : data;
}

function normalizeProperty(row) {
  return { ...row, rentalType: row.rental_type, propertyType: row.property_type, nightlyRate: row.nightly_rate, monthlyRent: row.monthly_rent, squareFeet: row.square_feet, assignedOwnerId: row.assigned_owner_id, archivedAt: row.archived_at };
}

function normalizeCleaning(row, properties = []) {
  const property = properties.find((item) => item.id === row.property_id);
  return { ...row, property: property?.name || 'Unassigned property', propertyId: row.property_id, assignedCleanerId: row.assigned_cleaner_id, scheduledFor: row.scheduled_for, checklist: row.checklist_items || [], cleanerNotes: row.cleaner_notes, suppliesUsed: row.supplies_used };
}

function normalizeMaintenance(row, properties = []) {
  const property = properties.find((item) => item.id === row.property_id);
  return { ...row, property: property?.name || 'Unassigned property', propertyId: row.property_id, assignedMaintenanceId: row.assigned_maintenance_id, estimatedCost: row.estimated_cost, actualCost: row.actual_cost, partsNeeded: row.parts_needed, due: row.due_date };
}

function normalizeBooking(row, properties = []) {
  const property = properties.find((item) => item.id === row.property_id);
  return { ...row, property: property?.name || 'Unassigned property', propertyId: row.property_id, contactId: row.contact_id, guestName: row.guest_name, guestEmail: row.guest_email, guestPhone: row.guest_phone, checkIn: row.check_in, checkOut: row.check_out, guestCount: row.guest_count, paymentStatus: row.payment_status, totalAmount: row.total_amount, cleaningFee: row.cleaning_fee, taxesFees: row.taxes_fees, ownerPayout: row.owner_payout, autoCreateCleaning: row.auto_create_cleaning, cancelledAt: row.cancelled_at };
}

function normalizeLease(row, properties = []) {
  const property = properties.find((item) => item.id === row.property_id);
  return { ...row, property: property?.name || 'Unassigned property', propertyId: row.property_id, contactId: row.contact_id, tenantName: row.tenant_name, tenantEmail: row.tenant_email, tenantPhone: row.tenant_phone, leaseStart: row.lease_start, leaseEnd: row.lease_end, monthlyRent: row.monthly_rent, securityDeposit: row.security_deposit, rentPaymentStatus: row.rent_payment_status, leaseStatus: row.lease_status, leaseDocumentFileId: row.lease_document_file_id, terminatedAt: row.terminated_at };
}

function normalizeSupply(row, properties = []) {
  const property = properties.find((item) => item.id === row.property_id);
  return { ...row, property: property?.name || 'Workspace supply', propertyId: row.property_id, itemName: row.item_name, currentQuantity: row.current_quantity, lowStockThreshold: row.low_stock_threshold, supplierName: row.supplier_name, supplierContact: row.supplier_contact, estimatedUnitCost: row.estimated_unit_cost, archivedAt: row.archived_at };
}

function normalizeMember(row) {
  const profile = row.profiles || row.profile || null;
  return { ...row, profile, profiles: profile };
}

function inviteToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using database-backed actions.');
  return supabase;
}

function formatSupabaseError(error, fallback = 'The database action failed.') {
  if (!error) return fallback;
  const message = error.message || error.details || error.hint || fallback;
  const parts = [message];
  if (error.details && !message.includes(error.details)) parts.push(error.details);
  if (error.hint && !parts.some((part) => part.includes(error.hint))) parts.push(error.hint);
  return parts.filter(Boolean).join(' ');
}

function requireWorkspaceSession(workspace, activeSession) {
  if (!workspace?.id) throw new Error('No workspace selected. Select or create a workspace before saving.');
  if (!activeSession?.user?.id) throw new Error('Your session expired. Sign in again before saving.');
}

function cleanNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildContactUpdatePayload(payload, contact) {
  const nextPayload = { ...payload };

  if (contact?.id) {
    nextPayload.contact_id = contact.id;
  } else if (Object.prototype.hasOwnProperty.call(payload, 'contact_id')) {
    nextPayload.contact_id = payload.contact_id || null;
  }

  return nextPayload;
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
    if (!supabase || !workspace?.id) { setData(emptyData); return { ok: true, warnings: [] }; }

    const makeWorkspaceQuery = (label, key, query, normalize = (rows) => rows || [], core = false) => ({ label, key, query, normalize, core });
    const workspaceQueries = [
      makeWorkspaceQuery('properties', 'properties', supabase.from('properties').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }), (rows) => (rows || []).map(normalizeProperty), true),
      makeWorkspaceQuery('workspace members', 'members', supabase.from('workspace_members').select('*, profiles:profiles!workspace_members_user_id_fkey(full_name, email)').eq('workspace_id', workspace.id).order('created_at', { ascending: true }), (rows) => (rows || []).map(normalizeMember)),
      makeWorkspaceQuery('bookings', 'bookings', supabase.from('bookings').select('*').eq('workspace_id', workspace.id).order('check_in', { ascending: true }), (rows, props) => (rows || []).map((row) => normalizeBooking(row, props))),
      makeWorkspaceQuery('leases', 'leases', supabase.from('leases').select('*').eq('workspace_id', workspace.id).order('lease_start', { ascending: true }), (rows, props) => (rows || []).map((row) => normalizeLease(row, props))),
      makeWorkspaceQuery('contacts', 'contacts', supabase.from('contacts').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false })),
      makeWorkspaceQuery('cleaning tasks', 'cleaningTasks', supabase.from('cleaning_tasks').select('*').eq('workspace_id', workspace.id).order('scheduled_for', { ascending: true }), (rows, props) => (rows || []).map((row) => normalizeCleaning(row, props))),
      makeWorkspaceQuery('maintenance work orders', 'maintenanceWorkOrders', supabase.from('maintenance_work_orders').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }), (rows, props) => (rows || []).map((row) => normalizeMaintenance(row, props))),
      makeWorkspaceQuery('supplies', 'supplies', supabase.from('supplies').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }), (rows, props) => (rows || []).map((row) => normalizeSupply(row, props))),
   makeWorkspaceQuery('workspace invites', 'invites', supabase.from('workspace_invites').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })),
makeWorkspaceQuery('file uploads', 'fileUploads', supabase.from('file_uploads').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })),
makeWorkspaceQuery('notifications', 'notifications', supabase.from('notifications').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })),
makeWorkspaceQuery('owner reports', 'ownerReports', supabase.from('owner_reports').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })),
    ];

    const settledResponses = await Promise.allSettled(workspaceQueries.map(({ query }) => query));
    const nextData = { ...emptyData };
    const warnings = [];
    const coreErrors = [];
    const responseByKey = {};

    workspaceQueries.forEach((workspaceQuery, index) => {
      const settled = settledResponses[index];
      const rejectedError = settled.status === 'rejected' ? settled.reason : null;
      const response = settled.status === 'fulfilled' ? settled.value : { data: [], error: rejectedError };
      responseByKey[workspaceQuery.key] = response;

      if (response.error) {
        const message = `${workspaceQuery.label}: ${formatSupabaseError(response.error)}`;
        if (workspaceQuery.core) coreErrors.push(message);
        else warnings.push(message);
        console.error(`[PropFlow] Could not load ${workspaceQuery.label}`, response.error);
      }
    });

    const props = responseByKey.properties?.error ? [] : workspaceQueries.find(({ key }) => key === 'properties').normalize(responseByKey.properties?.data || []);
    nextData.properties = props;

    workspaceQueries.forEach((workspaceQuery) => {
      if (workspaceQuery.key === 'properties') return;
      const response = responseByKey[workspaceQuery.key];
      nextData[workspaceQuery.key] = response?.error ? [] : workspaceQuery.normalize(response?.data || [], props);
    });

    setData(nextData);

    if (coreErrors.length || warnings.length) {
      const message = coreErrors.length
        ? `We loaded your account, but core workspace data could not be loaded. Please refresh or contact support. (${coreErrors.join('; ')})`
        : `We loaded your account, but some workspace data could not be loaded. Please refresh or contact support. (${warnings.join('; ')})`;
      setError(message);
      return { ok: false, error: message, coreErrors, warnings };
    }

    setError('');
    return { ok: true, warnings: [] };
  };

  const loadAccount = async (activeSession = session) => {
    if (!supabase || !activeSession?.user) { setAuthLoading(false); return null; }
    setAuthLoading(true);
    setError('');

    let accountState = null;

    try {
      const user = activeSession.user;
      const profilePayload = { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'PropFlow user' };
      const { error: upsertError } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (upsertError) console.error('[PropFlow] Could not upsert profile during account load', upsertError);

      const [profileResult, memberResult] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('workspace_members').select('*, workspaces(*)').eq('user_id', user.id).order('created_at', { ascending: true }),
      ]);

      const profileRes = profileResult.status === 'fulfilled' ? profileResult.value : { data: null, error: profileResult.reason };
      const memberRes = memberResult.status === 'fulfilled' ? memberResult.value : { data: [], error: memberResult.reason };
      const accountErrors = [];

      if (profileRes.error) {
        console.error('[PropFlow] Could not load profile during account load', profileRes.error);
        accountErrors.push(`profile: ${formatSupabaseError(profileRes.error)}`);
      }

      if (memberRes.error) {
        console.error('[PropFlow] Could not load workspace memberships during account load', memberRes.error);
        accountErrors.push(`workspace membership: ${formatSupabaseError(memberRes.error)}`);
      }

      const activeMemberships = memberRes.error ? [] : (memberRes.data || []).filter((m) => m.status !== 'revoked');
      const normalizedWorkspaces = activeMemberships.map((m) => normalizeWorkspace(m.workspaces)).filter(Boolean);
      const preferredId = localStorage.getItem(storageKey);
      const selectedMembership = activeMemberships.find((m) => m.workspace_id === preferredId) || activeMemberships[0];
      const profile = profileRes.data || profilePayload;
      const selectedWorkspace = normalizeWorkspace(selectedMembership?.workspaces);
      const userRoles = profile.is_propflow_admin ? [roles.ADMIN] : (selectedMembership?.roles || []);
      const nextUser = {
        id: user.id,
        email: user.email,
        name: profile.full_name || profile.email,
        status: profile.status || selectedMembership?.status || 'active',
        roles: userRoles,
        primaryRole: resolvePrimaryRole(userRoles),
        workspaceId: selectedWorkspace?.id,
        isPropFlowAdmin: Boolean(profile.is_propflow_admin),
      };

      setSession(activeSession);
      setMemberships(activeMemberships);
      setWorkspaces(normalizedWorkspaces);
      setCurrentWorkspaceState(selectedWorkspace || null);
      setCurrentUser(nextUser);

      if (selectedWorkspace) {
        await refreshWorkspaceData(selectedWorkspace);
      } else {
        setData(emptyData);
      }

      if (accountErrors.length) {
        setError(`We loaded your account, but some workspace data could not be loaded. Please refresh or contact support. (${accountErrors.join('; ')})`);
      }

      accountState = { currentUser: nextUser, memberships: activeMemberships, workspaces: normalizedWorkspaces, currentWorkspace: selectedWorkspace || null };
      return accountState;
    } catch (loadError) {
      console.error('[PropFlow] Account load failed', loadError);
      setError(`We could not finish loading your workspace. Please refresh or contact support. (${formatSupabaseError(loadError)})`);
      if (activeSession?.user) {
        const user = activeSession.user;
        setSession(activeSession);
        setCurrentUser((existingUser) => existingUser || {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'PropFlow user',
          status: 'active',
          roles: [],
          primaryRole: resolvePrimaryRole([]),
          workspaceId: undefined,
          isPropFlowAdmin: false,
        });
      }
      return accountState;
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }
    let mounted = true;
    supabase.auth.getSession()
      .then(({ data: authData }) => mounted && loadAccount(authData.session))
      .catch((sessionError) => {
        console.error('[PropFlow] Session load failed', sessionError);
        if (mounted) { setError(formatSupabaseError(sessionError, 'Could not check your session.')); setAuthLoading(false); }
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) loadAccount(nextSession); });
    return () => { mounted = false; subscription?.subscription?.unsubscribe?.(); };
  }, []);

  const setCurrentWorkspace = async (workspaceId) => {
    const membership = memberships.find((item) => item.workspace_id === workspaceId);
    if (!membership) throw new Error('You do not belong to that workspace.');
    localStorage.setItem(storageKey, workspaceId);
    const selectedWorkspace = normalizeWorkspace(membership.workspaces || workspaces.find((workspace) => workspace.id === workspaceId));
    setCurrentWorkspaceState(selectedWorkspace);
    setCurrentUser((user) => ({ ...user, roles: membership.roles || [], primaryRole: resolvePrimaryRole(membership.roles || []), workspaceId }));
    return refreshWorkspaceData(selectedWorkspace);
  };

  const signIn = async (email, password) => {
    const client = requireSupabase();
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(formatSupabaseError(authError, 'Login failed.'));
    await loadAccount(authData.session);
    return authData;
  };

  const signUp = async ({ email, password, fullName }) => {
    const client = requireSupabase();
    const { data: authData, error: authError } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (authError) throw new Error(formatSupabaseError(authError, 'Signup failed.'));
    if (authData.session) await loadAccount(authData.session);
    return authData;
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(storageKey);
    setSession(null); setCurrentUser(null); setMemberships([]); setWorkspaces([]); setCurrentWorkspaceState(null); setData(emptyData);
  };

  const createWorkspace = async (payload) => {
    const client = requireSupabase();
    const activeSession = session || (await client.auth.getSession()).data.session;
    if (!activeSession?.user) throw new Error('Sign in before creating a workspace.');

    const rpcPayload = {
      p_name: payload.name?.trim(),
      p_business_type: payload.business_type || payload.businessType || 'property_management',
      p_country: payload.country || null,
      p_default_currency: payload.default_currency || payload.defaultCurrency || 'USD',
      p_business_email: payload.business_email || payload.businessEmail || activeSession.user.email,
      p_phone: payload.phone || null,
      p_website: payload.website || null,
      p_property_count_estimate: cleanNumber(payload.property_count_estimate || payload.propertyCountEstimate),
      p_plan: payload.plan || 'starter',
    };

    const { data: rpcData, error: rpcError } = await client.rpc('create_workspace_with_owner', rpcPayload);
    if (rpcError) throw new Error(formatSupabaseError(rpcError, 'Workspace creation failed.'));

    const workspace = normalizeWorkspace(firstResult(rpcData));
    localStorage.setItem(storageKey, workspace.id);
    await loadAccount(activeSession);
    return workspace;
  };

  const createInvite = async ({ email, roles: inviteRoles, assignedPropertyIds = [], expiresAt = null, message = '', permissionLevel = 'standard' }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const safeRoles = (inviteRoles || []).filter((role) => customerAssignableRoles.has(role));
    if (!safeRoles.length) throw new Error('Choose at least one customer workspace role.');
    const token = inviteToken();
    const { data: invite, error: inviteError } = await client.from('workspace_invites').insert({
      workspace_id: currentWorkspace.id,
      email: email.toLowerCase().trim(),
      roles: safeRoles,
      assigned_property_ids: assignedPropertyIds,
      expires_at: expiresAt || null,
      message,
      permission_level: permissionLevel,
      token,
      invited_by: session.user.id,
      status: 'pending',
    }).select('*').single();
    if (inviteError) throw new Error(formatSupabaseError(inviteError, 'Invite creation failed.'));
    await refreshWorkspaceData();
    return invite;
  };

  const joinWorkspace = async ({ token, code }) => {
    const client = requireSupabase();
    const activeSession = session || (await client.auth.getSession()).data.session;
    if (!activeSession?.user?.email) throw new Error('Sign in with the invited email before joining a workspace.');
    let query = client.from('workspace_invites').select('*').eq('email', activeSession.user.email.toLowerCase()).eq('status', 'pending');
    if (token) query = query.eq('token', token.trim());
    if (code) {
      const workspaceRes = await client.from('workspaces').select('id').eq('company_code', code.trim()).maybeSingle();
      if (workspaceRes.error) throw new Error(formatSupabaseError(workspaceRes.error, 'Workspace code lookup failed.'));
      if (!workspaceRes.data) throw new Error('No workspace found for that code.');
      query = query.eq('workspace_id', workspaceRes.data.id);
    }
    const { data: invite, error: inviteError } = await query.maybeSingle();
    if (inviteError) throw new Error(formatSupabaseError(inviteError, 'Invite lookup failed.'));
    if (!invite) throw new Error('No valid invite exists for this email. Ask the workspace owner to send you an invite.');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired. Ask the workspace owner for a new invite.');

    const { error: memberError } = await client.from('workspace_members').upsert({ workspace_id: invite.workspace_id, user_id: activeSession.user.id, roles: invite.roles, status: 'active', invited_by: invite.invited_by }, { onConflict: 'workspace_id,user_id' });
    if (memberError) throw new Error(formatSupabaseError(memberError, 'Joining workspace failed.'));
    await client.from('workspace_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id);
    localStorage.setItem(storageKey, invite.workspace_id);
    return loadAccount(activeSession);
  };

  const createProperty = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const { data: property, error: propertyError } = await client.from('properties').insert({ ...payload, workspace_id: currentWorkspace.id, created_by: session.user.id }).select('*').single();
    if (propertyError) throw new Error(formatSupabaseError(propertyError, 'Property creation failed.'));
    await refreshWorkspaceData();
    return normalizeProperty(property);
  };

  const updateProperty = async (id, payload) => {
    const client = requireSupabase();
    const { data: property, error: propertyError } = await client.from('properties').update(payload).eq('id', id).eq('workspace_id', currentWorkspace.id).select('*').single();
    if (propertyError) throw new Error(formatSupabaseError(propertyError, 'Property update failed.'));
    await refreshWorkspaceData();
    return normalizeProperty(property);
  };

  const archiveProperty = async (id, archived = true) => updateProperty(id, { status: archived ? 'archived' : 'active', archived_at: archived ? new Date().toISOString() : null });

  const createBooking = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const contact = await upsertContact({ full_name: payload.guest_name, email: payload.guest_email, phone: payload.guest_phone, contact_type: 'guest' });
    const { data: booking, error: bookingError } = await client.from('bookings').insert({ ...payload, workspace_id: currentWorkspace.id, contact_id: contact?.id || null, created_by: session.user.id }).select('*').single();
    if (bookingError) throw new Error(formatSupabaseError(bookingError, 'Booking creation failed.'));
    await refreshWorkspaceData();
    return booking;
  };

  const updateBooking = async (id, payload) => {
  const client = requireSupabase();
  requireWorkspaceSession(currentWorkspace, session);

  if (!id) throw new Error('Select a booking before saving changes.');

  const contact = await upsertContact({
    full_name: payload.guest_name,
    email: payload.guest_email,
    phone: payload.guest_phone,
    contact_type: 'guest',
  });

  const updatePayload = buildContactUpdatePayload(payload, contact);

  const { data: booking, error: bookingError } = await client
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .eq('workspace_id', currentWorkspace.id)
    .select('*')
    .single();

  if (bookingError) throw new Error(formatSupabaseError(bookingError, 'Booking update failed.'));

  await refreshWorkspaceData();
  return booking;
};

  const createLease = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const contact = await upsertContact({ full_name: payload.tenant_name, email: payload.tenant_email, phone: payload.tenant_phone, contact_type: 'tenant' });
    const { data: lease, error: leaseError } = await client.from('leases').insert({ ...payload, workspace_id: currentWorkspace.id, contact_id: contact?.id || null, created_by: session.user.id }).select('*').single();
    if (leaseError) throw new Error(formatSupabaseError(leaseError, 'Lease creation failed.'));
    await refreshWorkspaceData();
    return lease;
  };

  const updateLease = async (id, payload) => {
  const client = requireSupabase();
  requireWorkspaceSession(currentWorkspace, session);

  if (!id) throw new Error('Select a lease before saving changes.');

  const contact = await upsertContact({
    full_name: payload.tenant_name,
    email: payload.tenant_email,
    phone: payload.tenant_phone,
    contact_type: 'tenant',
  });

  const updatePayload = buildContactUpdatePayload(payload, contact);

  const { data: lease, error: leaseError } = await client
    .from('leases')
    .update(updatePayload)
    .eq('id', id)
    .eq('workspace_id', currentWorkspace.id)
    .select('*')
    .single();

  if (leaseError) throw new Error(formatSupabaseError(leaseError, 'Lease update failed.'));

  await refreshWorkspaceData();
  return lease;
};

  const upsertContact = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    if (!payload.full_name?.trim()) return null;
    const { data: contact, error: contactError } = await client.rpc('create_or_update_contact', { p_workspace_id: currentWorkspace.id, p_full_name: payload.full_name, p_email: payload.email || null, p_phone: payload.phone || null, p_contact_type: payload.contact_type || 'other', p_notes: payload.notes || null });
    if (contactError) throw new Error(formatSupabaseError(contactError, 'Contact update failed.'));
    return firstResult(contact);
  };

  const createCleaningTask = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const { data: task, error: taskError } = await client.from('cleaning_tasks').insert({ ...payload, workspace_id: currentWorkspace.id, created_by: session.user.id }).select('*').single();
    if (taskError) throw new Error(formatSupabaseError(taskError, 'Cleaning task creation failed.'));
    await refreshWorkspaceData();
    return task;
  };

 const updateCleaningTask = async (id, payload) => {
  const client = requireSupabase();
  requireWorkspaceSession(currentWorkspace, session);

  if (!id) throw new Error('Select a cleaning task before saving changes.');

  const { data: task, error: taskError } = await client
    .from('cleaning_tasks')
    .update(payload)
    .eq('id', id)
    .eq('workspace_id', currentWorkspace.id)
    .select('*')
    .single();

  if (taskError) throw new Error(formatSupabaseError(taskError, 'Cleaning task update failed.'));

  await refreshWorkspaceData();
  return task;
};

 const updateMaintenanceWorkOrder = async (id, payload) => {
  const client = requireSupabase();
  requireWorkspaceSession(currentWorkspace, session);

  if (!id) throw new Error('Select a maintenance work order before saving changes.');

  const { data: work, error: workError } = await client
    .from('maintenance_work_orders')
    .update(payload)
    .eq('id', id)
    .eq('workspace_id', currentWorkspace.id)
    .select('*')
    .single();

  if (workError) throw new Error(formatSupabaseError(workError, 'Maintenance work order update failed.'));

  await refreshWorkspaceData();
  return work;
};

  const computeSupplyStatus = (payload) => {
    if (payload.archived_at) return 'archived';
    const quantity = Number(payload.current_quantity ?? 0);
    const threshold = Number(payload.low_stock_threshold ?? 0);
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= threshold) return 'low_stock';
    return 'in_stock';
  };

  const cleanSupplyPayload = (payload, archivedAt = payload.archived_at ?? null) => {
    const quantity = cleanNumber(payload.current_quantity);
    const threshold = cleanNumber(payload.low_stock_threshold);
    const cost = cleanNumber(payload.estimated_unit_cost);
    const nextPayload = {
      property_id: payload.property_id || null,
      item_name: payload.item_name?.trim() || '',
      category: payload.category?.trim() || null,
      current_quantity: quantity ?? 0,
      low_stock_threshold: threshold ?? 0,
      unit: payload.unit?.trim() || 'unit',
      supplier_name: payload.supplier_name?.trim() || null,
      supplier_contact: payload.supplier_contact?.trim() || null,
      estimated_unit_cost: cost,
      currency: payload.currency?.trim() || currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD',
      notes: payload.notes?.trim() || null,
      archived_at: archivedAt,
    };
    nextPayload.status = computeSupplyStatus(nextPayload);
    return nextPayload;
  };

  const recordSupplyActivity = async (client, supply, action) => {
    if (!currentWorkspace?.id || !session?.user?.id || !supply?.id) return;
    const { error: activityError } = await client.from('activity_logs').insert({
      workspace_id: currentWorkspace.id,
      actor_user_id: session.user.id,
      action,
      metadata: { supply_id: supply.id, item_name: supply.item_name, status: supply.status },
    });
    if (activityError) console.warn('[PropFlow] Could not record supply activity', activityError);
  };

  const maybeCreateSupplyNotification = async (client, supply) => {
    if (!currentWorkspace?.id || !session?.user?.id || !supply?.id || !['low_stock', 'out_of_stock'].includes(supply.status)) return;
    const { error: notificationError } = await client.from('notifications').insert({
      workspace_id: currentWorkspace.id,
      recipient_user_id: session.user.id,
      type: 'inventory_alert',
      message: `${supply.item_name} is ${supply.status === 'out_of_stock' ? 'out of stock' : 'low on stock'}.`,
      metadata: { supply_id: supply.id, item_name: supply.item_name, status: supply.status },
    });
    if (notificationError) console.warn('[PropFlow] Could not create supply notification', notificationError);
  };

  const createSupply = async (payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const supplyPayload = cleanSupplyPayload(payload, null);
    const { data: supply, error: supplyError } = await client.from('supplies').insert({ ...supplyPayload, workspace_id: currentWorkspace.id, created_by: session.user.id }).select('*').single();
    if (supplyError) throw new Error(formatSupabaseError(supplyError, 'Supply creation failed.'));
    await recordSupplyActivity(client, supply, 'supply_created');
    await maybeCreateSupplyNotification(client, supply);
    await refreshWorkspaceData();
    return normalizeSupply(supply, data.properties || []);
  };

  const updateSupply = async (id, payload) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const supplyPayload = cleanSupplyPayload(payload, payload.archived_at ?? null);
    const { data: supply, error: supplyError } = await client.from('supplies').update(supplyPayload).eq('id', id).eq('workspace_id', currentWorkspace.id).select('*').single();
    if (supplyError) throw new Error(formatSupabaseError(supplyError, 'Supply update failed.'));
    await recordSupplyActivity(client, supply, 'supply_updated');
    await maybeCreateSupplyNotification(client, supply);
    await refreshWorkspaceData();
    return normalizeSupply(supply, data.properties || []);
  };

  const archiveSupply = async (id, archived = true) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const archivedAt = archived ? new Date().toISOString() : null;
    const { data: existing, error: existingError } = await client.from('supplies').select('*').eq('id', id).eq('workspace_id', currentWorkspace.id).maybeSingle();
    if (existingError) throw new Error(formatSupabaseError(existingError, 'Supply lookup failed.'));
    if (!existing) throw new Error('Supply item was not found in the current workspace.');
    const nextStatus = archived ? 'archived' : computeSupplyStatus({ ...existing, archived_at: null });
    const { data: supply, error: supplyError } = await client.from('supplies').update({ archived_at: archivedAt, status: nextStatus }).eq('id', id).eq('workspace_id', currentWorkspace.id).select('*').single();
    if (supplyError) throw new Error(formatSupabaseError(supplyError, archived ? 'Supply archive failed.' : 'Supply restore failed.'));
    await recordSupplyActivity(client, supply, archived ? 'supply_archived' : 'supply_restored');
    await maybeCreateSupplyNotification(client, supply);
    await refreshWorkspaceData();
    return normalizeSupply(supply, data.properties || []);
  };

  const uploadWorkspaceFile = async ({ file, category, relatedTable, relatedId, propertyId }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    if (!file) throw new Error('Choose a file before uploading.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
   const uploadId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const path = `${currentWorkspace.id}/${category}/${uploadId}-${safeName}`;
    const { error: uploadError } = await client.storage.from('propflow-private').upload(path, file, { upsert: false });
    if (uploadError) throw new Error(formatSupabaseError(uploadError, 'File upload failed.'));
    const { data: upload, error: metadataError } = await client.from('file_uploads').insert({ workspace_id: currentWorkspace.id, property_id: propertyId || null, category, related_table: relatedTable || null, related_id: relatedId || null, bucket: 'propflow-private', path, filename: file.name, mime_type: file.type, size_bytes: file.size, uploaded_by: session.user.id }).select('*').single();
    if (metadataError) throw new Error(formatSupabaseError(metadataError, 'File metadata save failed.'));
    await refreshWorkspaceData();
    return upload;
  };

  const value = useMemo(() => ({
    isSupabaseConfigured, supabase, session, authLoading, currentUser, memberships, workspaces, currentWorkspace, data, error,
    signIn, signUp, signOut, loadAccount, setCurrentWorkspace, createWorkspace, createInvite, joinWorkspace,
    createProperty, updateProperty, archiveProperty,
    createBooking, updateBooking, createLease, updateLease, upsertContact,
    createSupply, updateSupply, archiveSupply,
    createCleaningTask, updateCleaningTask, createMaintenanceWorkOrder, updateMaintenanceWorkOrder,
    uploadWorkspaceFile, refreshWorkspaceData,
  }), [session, authLoading, currentUser, memberships, workspaces, currentWorkspace, data, error]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
