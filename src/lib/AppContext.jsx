import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { roles } from '../data/constants.js';
import { resolvePrimaryRole } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabase.js';

const AppContext = createContext(null);
const emptyData = { properties: [], cleaningTasks: [], maintenanceWorkOrders: [], bookings: [], leases: [], contacts: [], notifications: [], ownerReports: [], fileUploads: [], invites: [], members: [], supplies: [] };
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

function normalizeSupply(row) {
  return {
    ...row,
    propertyId: row.property_id,
    itemName: row.item_name,
    currentQuantity: row.current_quantity,
    lowStockThreshold: row.low_stock_threshold,
    supplierName: row.supplier_name,
    estimatedUnitCost: row.estimated_unit_cost,
  };
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
