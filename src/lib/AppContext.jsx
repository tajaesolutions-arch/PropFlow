import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { roles } from '../data/constants.js';
import { resolvePrimaryRole } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabase.js';

const AppContext = createContext(null);
const emptyData = { properties: [], cleaningTasks: [], maintenanceWorkOrders: [], bookings: [], notifications: [], ownerReports: [], fileUploads: [], invites: [], members: [] };
const customerAssignableRoles = new Set([roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT, roles.OWNER, roles.CLEANER, roles.MAINTENANCE]);
const storageKey = 'propflow.currentWorkspaceId';

function normalizeWorkspace(row) {
  if (!row) return null;
  return { ...row, defaultCurrency: row.default_currency || row.defaultCurrency || 'USD', code: row.company_code || row.code };
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

function inviteToken() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using database-backed actions.');
  return supabase;
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
    const [propertiesRes, cleaningRes, maintenanceRes, invitesRes, membersRes, filesRes] = await Promise.all([
      supabase.from('properties').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('cleaning_tasks').select('*').eq('workspace_id', workspace.id).order('scheduled_for', { ascending: true }),
      supabase.from('maintenance_work_orders').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('workspace_invites').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('workspace_members').select('*, profiles(full_name, email)').eq('workspace_id', workspace.id).order('created_at', { ascending: true }),
      supabase.from('file_uploads').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
    ]);
    const props = (propertiesRes.data || []).map(normalizeProperty);
    setData({
      ...emptyData,
      properties: props,
      cleaningTasks: (cleaningRes.data || []).map((row) => normalizeCleaning(row, props)),
      maintenanceWorkOrders: (maintenanceRes.data || []).map((row) => normalizeMaintenance(row, props)),
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

    const { data: workspace, error: workspaceError } = await client.rpc('create_workspace_with_owner', rpcPayload);
    if (workspaceError) throw new Error(workspaceError.message || 'Workspace creation failed. Please try again or contact support.');

    await loadAccount(session);
    return normalizeWorkspace(workspace);
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

  const value = useMemo(() => ({ session, authLoading, currentUser, currentWorkspace, workspaces, memberships, data, error, isSupabaseConfigured, signIn, signUp, signOut, loadAccount, setCurrentWorkspace, createWorkspace, acceptInvite, createInvite, createProperty, updateProperty, archiveProperty, restoreProperty, createCleaningTask, updateCleaningTask, createMaintenanceWorkOrder, updateMaintenanceWorkOrder, uploadFile }), [session, authLoading, currentUser, currentWorkspace, workspaces, memberships, data, error]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
