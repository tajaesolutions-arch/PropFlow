import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { roles } from '../data/constants.js';
import { resolvePrimaryRole } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabase.js';

const AppContext = createContext(null);
const emptyData = { properties: [], cleaningTasks: [], maintenanceWorkOrders: [], bookings: [], leases: [], contacts: [], notifications: [], ownerReports: [], fileUploads: [], invites: [], members: [] };
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

function inviteToken() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  if (!workspace?.id) throw new Error('Select or create a workspace before saving bookings.');
  if (!activeSession?.user?.id) throw new Error('Sign in again before saving bookings.');
}

function cleanNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
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
    if (!supabase || !workspace?.id) { setData(emptyData); return; }
    const workspaceQueries = [
      ['properties', supabase.from('properties').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })],
      ['cleaning tasks', supabase.from('cleaning_tasks').select('*').eq('workspace_id', workspace.id).order('scheduled_for', { ascending: true })],
      ['maintenance work orders', supabase.from('maintenance_work_orders').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })],
      ['bookings', supabase.from('bookings').select('*').eq('workspace_id', workspace.id).order('check_in', { ascending: true })],
      ['leases', supabase.from('leases').select('*').eq('workspace_id', workspace.id).order('lease_start', { ascending: true })],
      ['contacts', supabase.from('contacts').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false })],
      ['workspace invites', supabase.from('workspace_invites').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })],
      ['workspace members', supabase.from('workspace_members').select('*, profiles(full_name, email)').eq('workspace_id', workspace.id).order('created_at', { ascending: true })],
      ['file uploads', supabase.from('file_uploads').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false })],
    ];
    const [propertiesRes, cleaningRes, maintenanceRes, bookingsRes, leasesRes, contactsRes, invitesRes, membersRes, filesRes] = await Promise.all(workspaceQueries.map(([, query]) => query));
    const failedQuery = workspaceQueries.find(([label], index) => [propertiesRes, cleaningRes, maintenanceRes, bookingsRes, leasesRes, contactsRes, invitesRes, membersRes, filesRes][index].error);
    if (failedQuery) {
      const failedIndex = workspaceQueries.indexOf(failedQuery);
      const failedResponse = [propertiesRes, cleaningRes, maintenanceRes, bookingsRes, leasesRes, contactsRes, invitesRes, membersRes, filesRes][failedIndex];
      throw new Error(`Could not load ${failedQuery[0]}: ${formatSupabaseError(failedResponse.error)}`);
    }
    const props = (propertiesRes.data || []).map(normalizeProperty);
    setData({
      ...emptyData,
      properties: props,
      cleaningTasks: (cleaningRes.data || []).map((row) => normalizeCleaning(row, props)),
      maintenanceWorkOrders: (maintenanceRes.data || []).map((row) => normalizeMaintenance(row, props)),
      bookings: (bookingsRes.data || []).map((row) => normalizeBooking(row, props)),
      leases: (leasesRes.data || []).map((row) => normalizeLease(row, props)),
      contacts: contactsRes.data || [],
      invites: invitesRes.data || [],
      members: membersRes.data || [],
      fileUploads: filesRes.data || [],
    });
  };

  const loadAccount = async (activeSession = session) => {
    if (!supabase || !activeSession?.user) { setAuthLoading(false); return; }
    setAuthLoading(true);
    setError('');
    const user = activeSession.user;
    const profilePayload = { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'PropFlow user' };
    await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    const [profileRes, memberRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('workspace_members').select('*, workspaces(*)').eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);
    const activeMemberships = (memberRes.data || []).filter((m) => m.status !== 'revoked');
    const normalizedWorkspaces = activeMemberships.map((m) => normalizeWorkspace(m.workspaces)).filter(Boolean);
    const preferredId = localStorage.getItem(storageKey);
    const selectedMembership = activeMemberships.find((m) => m.workspace_id === preferredId) || activeMemberships[0];
    const profile = profileRes.data || profilePayload;
    const selectedWorkspace = normalizeWorkspace(selectedMembership?.workspaces);
    const userRoles = profile.is_propflow_admin ? [roles.ADMIN] : (selectedMembership?.roles || []);
    setSession(activeSession);
    setMemberships(activeMemberships);
    setWorkspaces(normalizedWorkspaces);
    setCurrentWorkspaceState(selectedWorkspace || null);
    setCurrentUser({
      id: user.id,
      email: user.email,
      name: profile.full_name || profile.email,
      status: profile.status || selectedMembership?.status || 'active',
      roles: userRoles,
      primaryRole: resolvePrimaryRole(userRoles),
      workspaceId: selectedWorkspace?.id,
      isPropFlowAdmin: Boolean(profile.is_propflow_admin),
    });
    await refreshWorkspaceData(selectedWorkspace);
    setAuthLoading(false);
    return { currentUser: {
      id: user.id,
      email: user.email,
      name: profile.full_name || profile.email,
      status: profile.status || selectedMembership?.status || 'active',
      roles: userRoles,
      primaryRole: resolvePrimaryRole(userRoles),
      workspaceId: selectedWorkspace?.id,
      isPropFlowAdmin: Boolean(profile.is_propflow_admin),
    }, memberships: activeMemberships, workspaces: normalizedWorkspaces, currentWorkspace: selectedWorkspace || null };
  };

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }
    let mounted = true;
    supabase.auth.getSession().then(({ data: authData }) => mounted && loadAccount(authData.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) loadAccount(nextSession); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email, password) => {
    const client = requireSupabase();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  };

  const signUp = async ({ email, password, fullName }) => {
    const client = requireSupabase();
    const { error: signUpError } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (signUpError) throw signUpError;
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setCurrentUser(null); setCurrentWorkspaceState(null); setMemberships([]); setWorkspaces([]); setData(emptyData);
  };

  const setCurrentWorkspace = async (workspace) => {
    if (!workspace) return;
    localStorage.setItem(storageKey, workspace.id);
    setCurrentWorkspaceState(workspace);
    const membership = memberships.find((m) => m.workspace_id === workspace.id);
    setCurrentUser((user) => ({ ...user, roles: membership?.roles || user.roles, primaryRole: resolvePrimaryRole(membership?.roles || user.roles), workspaceId: workspace.id }));
    await refreshWorkspaceData(workspace);
  };

  const createWorkspace = async (payload) => {
    const client = requireSupabase();
    if (!session?.user) throw new Error('Sign in before creating a workspace.');

    const rpcPayload = {
      p_name: payload.name,
      p_business_type: payload.business_type || null,
      p_country: payload.country,
      p_default_currency: payload.default_currency,
      p_business_email: payload.business_email || null,
      p_phone: payload.phone || null,
      p_website: payload.website || null,
      p_property_count_estimate: cleanNumber(payload.property_count_estimate),
      p_plan_placeholder: payload.plan_placeholder || null,
      p_company_code: payload.company_code || null,
    };

    const applyCreatedWorkspaceState = (workspace, membership) => {
      if (!workspace?.id) return;
      const ownerRoles = Array.from(new Set([...(membership?.roles || []), roles.OWNER_ADMIN]));
      const ownerMembership = {
        ...(membership || {}),
        workspace_id: workspace.id,
        user_id: session.user.id,
        roles: ownerRoles,
        status: membership?.status || 'active',
        workspaces: membership?.workspaces || workspace,
      };

      localStorage.setItem(storageKey, workspace.id);
      setCurrentWorkspaceState(workspace);
      setWorkspaces((existing) => {
        const others = existing.filter((item) => item.id !== workspace.id);
        return [...others, workspace];
      });
      setMemberships((existing) => {
        const others = existing.filter((item) => item.workspace_id !== workspace.id);
        return [...others, ownerMembership];
      });
      setCurrentUser((user) => ({
        id: user?.id || session.user.id,
        email: user?.email || session.user.email,
        name: user?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'PropFlow user',
        status: 'active',
        roles: ownerRoles,
        primaryRole: resolvePrimaryRole(ownerRoles),
        workspaceId: workspace.id,
        isPropFlowAdmin: Boolean(user?.isPropFlowAdmin),
      }));
    };

    const throwWorkspaceReloadError = (message) => {
      const reloadError = new Error(message);
      reloadError.workspaceCreated = true;
      throw reloadError;
    };

    const { data: workspaceResult, error: workspaceError } = await client.rpc('create_workspace_with_owner', rpcPayload);
    if (workspaceError) throw new Error(workspaceError.message || 'Workspace creation failed. Please try again or contact support.');

    const newWorkspace = normalizeWorkspace(firstResult(workspaceResult));
    if (!newWorkspace?.id) {
      try {
        const account = await loadAccount(session);
        if (account?.currentWorkspace?.id) {
          localStorage.setItem(storageKey, account.currentWorkspace.id);
          await refreshWorkspaceData(account.currentWorkspace);
          return account.currentWorkspace;
        }
      } catch (error) {
        setAuthLoading(false);
        throwWorkspaceReloadError('Workspace created. Refreshing your dashboard…');
      }
      throwWorkspaceReloadError('Workspace created. Refreshing your dashboard…');
    }

    const { data: membership } = await client
      .from('workspace_members')
      .select('*, workspaces(*)')
      .eq('workspace_id', newWorkspace.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    const normalizedMembership = membership ? { ...membership, workspaces: membership.workspaces || newWorkspace } : null;
    applyCreatedWorkspaceState(newWorkspace, normalizedMembership);

    try {
      await refreshWorkspaceData(newWorkspace);
      const account = await loadAccount(session);
      const accountWorkspace = account?.workspaces?.find((workspace) => workspace.id === newWorkspace.id) || account?.currentWorkspace;
      const finalWorkspace = normalizeWorkspace(accountWorkspace) || newWorkspace;
      const finalMembership = account?.memberships?.find((item) => item.workspace_id === finalWorkspace.id) || normalizedMembership;
      applyCreatedWorkspaceState(finalWorkspace, finalMembership);
      await refreshWorkspaceData(finalWorkspace);
      return finalWorkspace;
    } catch (error) {
      applyCreatedWorkspaceState(newWorkspace, normalizedMembership);
      setAuthLoading(false);
      throwWorkspaceReloadError('Workspace created. Refreshing your dashboard…');
    }
  };

  const acceptInvite = async (codeOrToken) => {
    const client = requireSupabase();
    const email = session?.user?.email?.toLowerCase();
    const now = new Date().toISOString();
    const { data: invites, error: inviteError } = await client.from('workspace_invites').select('*').or(`token.eq.${codeOrToken},workspace_code.eq.${codeOrToken}`).eq('email', email).eq('status', 'pending');
    if (inviteError) throw inviteError;
    const invite = (invites || []).find((item) => !item.expires_at || item.expires_at > now);
    if (!invite) throw new Error('No valid invite was found for your email. Check the code, invite link, expiration date, or ask an admin for a new invite.');
    await client.from('workspace_members').upsert({ workspace_id: invite.workspace_id, user_id: session.user.id, roles: invite.roles, status: 'active' }, { onConflict: 'workspace_id,user_id' });
    await client.from('workspace_invites').update({ status: 'accepted', accepted_at: now, accepted_by: session.user.id }).eq('id', invite.id);
    await client.from('activity_logs').insert({ workspace_id: invite.workspace_id, actor_user_id: session.user.id, action: 'invite.accepted', metadata: { invite_id: invite.id } });
    await loadAccount(session);
  };

  const createInvite = async ({ email, roles: inviteRoles, expires_at, message, assigned_property_ids }) => {
    const client = requireSupabase();
    const safeRoles = (inviteRoles || []).filter((role) => customerAssignableRoles.has(role));
    if (!safeRoles.length) throw new Error('Choose at least one customer-assignable workspace role.');
    const token = inviteToken();
    const record = { workspace_id: currentWorkspace.id, email: email.toLowerCase(), roles: safeRoles, token, workspace_code: currentWorkspace.code, expires_at: expires_at || null, message, assigned_property_ids: assigned_property_ids || [], invited_by: session.user.id, status: 'pending' };
    const { data: invite, error: inviteError } = await client.from('workspace_invites').insert(record).select('*').single();
    if (inviteError) throw inviteError;
    await client.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'user.invited', metadata: { email, roles: safeRoles } });
    await refreshWorkspaceData();
    return { ...invite, link: `${window.location.origin}/workspace-setup?invite=${token}` };
  };

  const createProperty = async (payload) => {
    const { data: row, error: propertyError } = await supabase.from('properties').insert({ ...payload, workspace_id: currentWorkspace.id, created_by: session.user.id }).select('*').single();
    if (propertyError) throw propertyError;
    await supabase.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'property.created', metadata: { property_id: row.id } });
    await refreshWorkspaceData();
    return normalizeProperty(row);
  };

  const updateProperty = async (id, payload) => {
    const { error: propertyError } = await supabase.from('properties').update(payload).eq('id', id).eq('workspace_id', currentWorkspace.id);
    if (propertyError) throw propertyError;
    await supabase.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'property.updated', metadata: { property_id: id } });
    await refreshWorkspaceData();
  };

  const archiveProperty = (id) => updateProperty(id, { status: 'archived', archived_at: new Date().toISOString() });
  const restoreProperty = (id) => updateProperty(id, { status: 'active', archived_at: null });

  const createCleaningTask = async (payload) => {
    const { error: taskError } = await supabase.from('cleaning_tasks').insert({ ...payload, workspace_id: currentWorkspace.id, created_by: session.user.id });
    if (taskError) throw taskError;
    await supabase.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'cleaning_task.created', metadata: { property_id: payload.property_id } });
    await refreshWorkspaceData();
  };

  const updateCleaningTask = async (id, payload) => {
    const { error: taskError } = await supabase.from('cleaning_tasks').update(payload).eq('id', id).eq('workspace_id', currentWorkspace.id);
    if (taskError) throw taskError;
    await refreshWorkspaceData();
  };

  const createMaintenanceWorkOrder = async (payload) => {
    const { error: workOrderError } = await supabase.from('maintenance_work_orders').insert({ ...payload, workspace_id: currentWorkspace.id, created_by: session.user.id, reported_by_user_id: session.user.id });
    if (workOrderError) throw workOrderError;
    await supabase.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'maintenance_work_order.created', metadata: { property_id: payload.property_id } });
    await refreshWorkspaceData();
  };

  const updateMaintenanceWorkOrder = async (id, payload) => {
    const { error: workOrderError } = await supabase.from('maintenance_work_orders').update(payload).eq('id', id).eq('workspace_id', currentWorkspace.id);
    if (workOrderError) throw workOrderError;
    await refreshWorkspaceData();
  };


  const friendlyBookingError = (error) => {
    const message = formatSupabaseError(error, 'The booking or lease could not be saved.');
    const lower = message.toLowerCase();
    if (lower.includes('overlap') || lower.includes('already has') || lower.includes('active lease') || error?.code === '23P01') return new Error(message);
    if (error?.code === '42501' || lower.includes('row-level security') || lower.includes('permission')) return new Error(`Permission denied while saving: ${message}`);
    if (error?.code === '23502' || lower.includes('null value')) return new Error(`Missing required booking field: ${message}`);
    if (error?.code === '23503' || lower.includes('foreign key')) return new Error(`The selected workspace, property, contact, or user could not be linked: ${message}`);
    if (error instanceof Error) return new Error(message);
    return new Error(message);
  };

  const bookingRecordFromPayload = (payload, contactId) => ({
    workspace_id: currentWorkspace.id,
    property_id: payload.property_id,
    contact_id: contactId || null,
    guest_name: payload.guest_name?.trim(),
    guest_email: payload.guest_email?.trim() || null,
    guest_phone: payload.guest_phone?.trim() || null,
    check_in: payload.check_in,
    check_out: payload.check_out,
    guest_count: cleanNumber(payload.guest_count),
    source: payload.source || 'manual',
    status: payload.status || 'confirmed',
    payment_status: payload.payment_status || 'unpaid',
    currency: payload.currency || defaultCurrencyForProperty(payload.property_id),
    total_amount: cleanNumber(payload.total_amount),
    cleaning_fee: cleanNumber(payload.cleaning_fee),
    taxes_fees: cleanNumber(payload.taxes_fees),
    owner_payout: cleanNumber(payload.owner_payout),
    notes: payload.notes?.trim() || null,
    auto_create_cleaning: payload.auto_create_cleaning !== false,
    created_by: session.user.id,
  });

  const defaultCurrencyForProperty = (propertyId) => data.properties.find((property) => property.id === propertyId)?.currency || currentWorkspace?.defaultCurrency || 'USD';

  const createOrUpdateContact = async ({ full_name, email, phone, contact_type, notes }) => {
    const client = requireSupabase();
    requireWorkspaceSession(currentWorkspace, session);
    const { data: contact, error: contactError } = await client.rpc('create_or_update_contact', { p_workspace_id: currentWorkspace.id, p_full_name: full_name?.trim(), p_email: email?.trim() || null, p_phone: phone?.trim() || null, p_contact_type: contact_type, p_notes: notes?.trim() || null });
    if (contactError) throw contactError;
    return contact;
  };

  const loadBookings = () => refreshWorkspaceData();
  const loadLeases = () => refreshWorkspaceData();

  const createBooking = async (payload) => {
    const client = requireSupabase();
    try {
      requireWorkspaceSession(currentWorkspace, session);
      const contact = await createOrUpdateContact({ full_name: payload.guest_name, email: payload.guest_email, phone: payload.guest_phone, contact_type: 'guest', notes: payload.notes });
      const record = bookingRecordFromPayload(payload, contact?.id);
      const { data: row, error: bookingError } = await client.from('bookings').insert(record).select('*').single();
      if (bookingError) throw bookingError;

      const { error: activityError } = await client.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'booking.created', metadata: { booking_id: row.id, property_id: row.property_id } });
      const warnings = [];
      if (activityError) warnings.push(`Activity log was not recorded: ${formatSupabaseError(activityError)}`);

      if (record.auto_create_cleaning && row.status !== 'cancelled') {
        const { data: cleaningTask, error: cleaningError } = await client.from('cleaning_tasks').select('id').eq('workspace_id', currentWorkspace.id).eq('booking_id', row.id).maybeSingle();
        if (cleaningError) warnings.push(`Booking was created, but cleaning task verification failed: ${formatSupabaseError(cleaningError)}`);
        if (!cleaningError && !cleaningTask) warnings.push('Booking was created, but no checkout cleaning task was found. Please create one manually or check the booking cleaning automation trigger.');
      }

      try {
        await refreshWorkspaceData();
      } catch (refreshError) {
        const normalizedBooking = normalizeBooking(row, data.properties);
        setData((current) => ({ ...current, bookings: current.bookings.some((booking) => booking.id === row.id) ? current.bookings : [...current.bookings, normalizedBooking] }));
        warnings.push(`Booking was created, but the bookings table could not refresh automatically: ${formatSupabaseError(refreshError)}`);
      }
      return { booking: normalizeBooking(row, data.properties), warning: warnings.join(' ') };
    } catch (error) {
      throw friendlyBookingError(error);
    }
  };

  const updateBooking = async (id, payload) => {
    const client = requireSupabase();
    try {
      requireWorkspaceSession(currentWorkspace, session);
      const patch = { ...payload };
      if (payload.guest_name || payload.guest_email || payload.guest_phone) {
        const contact = await createOrUpdateContact({ full_name: payload.guest_name, email: payload.guest_email, phone: payload.guest_phone, contact_type: 'guest', notes: payload.notes });
        patch.contact_id = contact?.id || null;
      }
      const { error: bookingError } = await client.from('bookings').update(patch).eq('id', id).eq('workspace_id', currentWorkspace.id);
      if (bookingError) throw bookingError;
      await refreshWorkspaceData();
    } catch (error) {
      throw friendlyBookingError(error);
    }
  };

  const cancelBooking = async (id) => updateBooking(id, { status: 'cancelled', cancelled_at: new Date().toISOString() });

  const createLease = async (payload) => {
    const client = requireSupabase();
    try {
      requireWorkspaceSession(currentWorkspace, session);
      const contact = await createOrUpdateContact({ full_name: payload.tenant_name, email: payload.tenant_email, phone: payload.tenant_phone, contact_type: 'tenant', notes: payload.notes });
      const record = { ...payload, contact_id: contact?.id || null, currency: payload.currency || defaultCurrencyForProperty(payload.property_id), workspace_id: currentWorkspace.id, created_by: session.user.id };
      const { data: row, error: leaseError } = await client.from('leases').insert(record).select('*').single();
      if (leaseError) throw leaseError;
      await client.from('activity_logs').insert({ workspace_id: currentWorkspace.id, actor_user_id: session.user.id, action: 'lease.created', metadata: { lease_id: row.id, property_id: row.property_id } });
      await refreshWorkspaceData();
      return normalizeLease(row, data.properties);
    } catch (error) {
      throw friendlyBookingError(error);
    }
  };

  const updateLease = async (id, payload) => {
    const client = requireSupabase();
    try {
      requireWorkspaceSession(currentWorkspace, session);
      const patch = { ...payload };
      if (payload.tenant_name || payload.tenant_email || payload.tenant_phone) {
        const contact = await createOrUpdateContact({ full_name: payload.tenant_name, email: payload.tenant_email, phone: payload.tenant_phone, contact_type: 'tenant', notes: payload.notes });
        patch.contact_id = contact?.id || null;
      }
      const { error: leaseError } = await client.from('leases').update(patch).eq('id', id).eq('workspace_id', currentWorkspace.id);
      if (leaseError) throw leaseError;
      await refreshWorkspaceData();
    } catch (error) {
      throw friendlyBookingError(error);
    }
  };

  const terminateLease = async (id, lease_status = 'terminated') => updateLease(id, { lease_status, terminated_at: new Date().toISOString() });

  const uploadFile = async ({ file, category, property_id, cleaning_task_id, maintenance_work_order_id }) => {
    const client = requireSupabase();
    if (!file) throw new Error('Choose a file before uploading.');
    if (!currentWorkspace?.id) throw new Error('Select a workspace before uploading files.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const path = `${currentWorkspace.id}/${property_id || 'workspace'}/${category}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await client.storage.from('propflow-private').upload(path, file);
    if (uploadError) throw uploadError;
    const { error: metadataError } = await client.from('file_uploads').insert({ workspace_id: currentWorkspace.id, property_id, cleaning_task_id, maintenance_work_order_id, uploaded_by: session.user.id, bucket: 'propflow-private', path, file_name: file.name, file_type: file.type, file_size: file.size, category });
    if (metadataError) throw metadataError;
    await refreshWorkspaceData();
  };

  const value = useMemo(() => ({ session, authLoading, currentUser, currentWorkspace, workspaces, memberships, data, error, isSupabaseConfigured, signIn, signUp, signOut, loadAccount, setCurrentWorkspace, createWorkspace, acceptInvite, createInvite, createProperty, updateProperty, archiveProperty, restoreProperty, createCleaningTask, updateCleaningTask, createMaintenanceWorkOrder, updateMaintenanceWorkOrder, createOrUpdateContact, loadBookings, loadLeases, createBooking, updateBooking, cancelBooking, createLease, updateLease, terminateLease, uploadFile }), [session, authLoading, currentUser, currentWorkspace, workspaces, memberships, data, error]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
