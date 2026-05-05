import { roles } from './constants.js';

export const plans = [
  { name: 'Starter', price: '$49', subtitle: 'Small hosts / 1–3 properties', propertyLimit: 3, userLimit: 5, features: ['Short & long-term rentals', 'Owner reports', 'Cleaning workflows'] },
  { name: 'Growth', price: '$149', subtitle: 'Property managers / 4–15 properties', propertyLimit: 15, userLimit: 25, featured: true, features: ['Multi-workspace controls', 'Maintenance tracking', 'Revenue dashboards'] },
  { name: 'Pro', price: '$349', subtitle: '16+ properties', propertyLimit: 60, userLimit: 100, features: ['Advanced reports', 'Priority workflows', 'Multi-role operations'] },
  { name: 'Enterprise', price: 'Custom', subtitle: 'Real estate companies', propertyLimit: 'Custom', userLimit: 'Custom', features: ['Custom onboarding', 'Security review', 'Dedicated support'] },
];

export const demoUsers = [
  { id: 'u-admin', name: 'Avery Admin', email: 'admin@propflow.demo', roles: [roles.ADMIN], status: 'active' },
  { id: 'u-owner-admin', name: 'Morgan Lee', email: 'owner@propflow.demo', roles: [roles.OWNER_ADMIN], status: 'active' },
  { id: 'u-manager', name: 'Priya Shah', email: 'manager@propflow.demo', roles: [roles.PROPERTY_MANAGER], status: 'active' },
  { id: 'u-host', name: 'Carlos Grant', email: 'host@propflow.demo', roles: [roles.HOST], status: 'active' },
  { id: 'u-owner', name: 'Nia Campbell', email: 'propertyowner@propflow.demo', roles: [roles.OWNER], status: 'active' },
  { id: 'u-cleaner', name: 'Tasha Brown', email: 'cleaner@propflow.demo', roles: [roles.CLEANER], status: 'active' },
  { id: 'u-maint', name: 'Devon Wright', email: 'maintenance@propflow.demo', roles: [roles.MAINTENANCE], status: 'active' },
  { id: 'u-suspended', name: 'Suspended User', email: 'suspended@propflow.demo', roles: [roles.HOST], status: 'suspended' },
];

export const workspaces = [
  { id: 'w-1', name: 'Blue Harbor Stays', code: 'BLUE-2026', country: 'Jamaica', defaultCurrency: 'USD', subscription: { plan: 'Growth', status: 'active', billingPeriod: 'monthly', trial: false, propertyLimit: 15, userLimit: 25 } },
  { id: 'w-2', name: 'Northline Rentals', code: 'NORTH-RENT', country: 'Canada', defaultCurrency: 'CAD', subscription: { plan: 'Starter', status: 'trialing', billingPeriod: 'monthly', trial: true, propertyLimit: 3, userLimit: 5 } },
];

export const teamMembers = [
  { id: 'tm-1', userId: 'u-owner-admin', name: 'Morgan Lee', roles: [roles.OWNER_ADMIN], status: 'active' },
  { id: 'tm-2', userId: 'u-manager', name: 'Priya Shah', roles: [roles.PROPERTY_MANAGER, roles.HOST], status: 'active' },
  { id: 'tm-3', userId: 'u-cleaner', name: 'Tasha Brown', roles: [roles.CLEANER], status: 'active' },
  { id: 'tm-4', userId: 'u-maint', name: 'Devon Wright', roles: [roles.MAINTENANCE], status: 'active' },
  { id: 'tm-5', userId: 'u-owner', name: 'Nia Campbell', roles: [roles.OWNER], status: 'active' },
];

export const propertyOwners = [
  { id: 'po-1', workspaceId: 'w-1', name: 'Nia Campbell', email: 'nia@example.com', phone: '+1 876 555 0124', payoutPreference: 'Monthly ACH' },
  { id: 'po-2', workspaceId: 'w-1', name: 'Harbor Trust LLC', email: 'finance@harbortrust.example', phone: '+1 876 555 0199', payoutPreference: 'Quarterly wire' },
];

export const properties = [
  { id: 'p-1', workspaceId: 'w-1', name: 'Seaside Villa', address: '18 Ocean View Road', city: 'Montego Bay', country: 'Jamaica', type: 'Villa', rentalType: 'Short-term', bedrooms: 4, bathrooms: 3.5, maxGuests: 10, ownerId: 'po-1', owner: 'Nia Campbell', cleaner: 'Tasha Brown', maintenanceCrew: 'Devon Wright', rate: 420, currency: 'USD', status: 'Active', occupancy: 82, revenue: 28400, expenses: 7700, notes: 'Premium Airbnb property with pool and ocean view.' },
  { id: 'p-2', workspaceId: 'w-1', name: 'Kingston Garden Flat', address: '41 Hope Road', city: 'Kingston', country: 'Jamaica', type: 'Apartment', rentalType: 'Both', bedrooms: 2, bathrooms: 2, maxGuests: 5, ownerId: 'po-2', owner: 'Harbor Trust LLC', cleaner: 'Tasha Brown', maintenanceCrew: 'Devon Wright', rate: 1850, currency: 'USD', status: 'Active', occupancy: 74, revenue: 15800, expenses: 4300, notes: 'Flexible monthly and furnished short-stay unit.' },
  { id: 'p-3', workspaceId: 'w-1', name: 'Ocho Rios Townhome', address: '7 Fern Gully Lane', city: 'Ocho Rios', country: 'Jamaica', type: 'Townhome', rentalType: 'Long-term', bedrooms: 3, bathrooms: 2, maxGuests: 6, ownerId: 'po-1', owner: 'Nia Campbell', cleaner: 'Unassigned', maintenanceCrew: 'Devon Wright', rate: 2400, currency: 'USD', status: 'Maintenance hold', occupancy: 61, revenue: 9800, expenses: 5100, notes: 'Long-term lease renews in June.' },
];

export const guests = [
  { id: 'g-1', workspaceId: 'w-1', name: 'Olivia Martin', email: 'olivia@example.com', phone: '+1 212 555 0162', lastStay: 'Seaside Villa', source: 'Airbnb', lifetimeValue: 5200 },
  { id: 'g-2', workspaceId: 'w-1', name: 'Ethan Clarke', email: 'ethan@example.com', phone: '+44 20 5555 0198', lastStay: 'Kingston Garden Flat', source: 'Direct', lifetimeValue: 3100 },
  { id: 'g-3', workspaceId: 'w-1', name: 'Maya Johnson', email: 'maya@example.com', phone: '+1 876 555 0176', lastStay: 'Ocho Rios Townhome', source: 'Corporate lease', lifetimeValue: 9600 },
];

export const bookings = [
  { id: 'b-1', workspaceId: 'w-1', guest: 'Olivia Martin', propertyId: 'p-1', property: 'Seaside Villa', checkIn: '2026-05-09', checkOut: '2026-05-14', source: 'Airbnb', total: 2600, cleaningFee: 180, platformFee: 390, status: 'Upcoming', paymentStatus: 'Paid', notes: 'Anniversary trip.' },
  { id: 'b-2', workspaceId: 'w-1', guest: 'Ethan Clarke', propertyId: 'p-2', property: 'Kingston Garden Flat', checkIn: '2026-05-05', checkOut: '2026-05-12', source: 'Direct', total: 1450, cleaningFee: 120, platformFee: 0, status: 'Checked in', paymentStatus: 'Deposit paid', notes: 'Direct booking snapshot candidate.' },
  { id: 'b-3', workspaceId: 'w-1', guest: 'Maya Johnson', propertyId: 'p-3', property: 'Ocho Rios Townhome', checkIn: '2026-04-01', checkOut: '2026-06-30', source: 'Corporate lease', total: 7200, cleaningFee: 0, platformFee: 0, status: 'Checked in', paymentStatus: 'Paid', notes: 'Long-term rental.' },
];

export const cleaningChecklistItems = ['Strip and replace linens', 'Sanitize kitchen and bathrooms', 'Restock toiletries and coffee', 'Photo proof uploaded', 'Final guest-ready walkthrough'];
export const cleaningTasks = [
  { id: 'c-1', workspaceId: 'w-1', propertyId: 'p-1', property: 'Seaside Villa', cleaner: 'Tasha Brown', due: '2026-05-14 11:00', status: 'Not started', checklist: cleaningChecklistItems, issue: '' },
  { id: 'c-2', workspaceId: 'w-1', propertyId: 'p-2', property: 'Kingston Garden Flat', cleaner: 'Tasha Brown', due: '2026-05-05 15:00', status: 'In progress', checklist: cleaningChecklistItems.slice(0, 4), issue: 'Guest requested extra towels.' },
  { id: 'c-3', workspaceId: 'w-1', propertyId: 'p-3', property: 'Ocho Rios Townhome', cleaner: 'Unassigned', due: '2026-05-07 10:00', status: 'Blocked / issue found', checklist: cleaningChecklistItems, issue: 'Water leak near laundry room.' },
];

export const maintenanceWorkOrders = [
  { id: 'm-1', workspaceId: 'w-1', propertyId: 'p-3', property: 'Ocho Rios Townhome', title: 'Laundry room water leak', assignee: 'Devon Wright', vendor: 'Internal', priority: 'Critical', status: 'In progress', partsNeeded: 'Supply hose, shutoff valve', estimatedCost: 450, actualCost: 180, due: '2026-05-05', notes: 'Urgent issue created from cleaner report.' },
  { id: 'm-2', workspaceId: 'w-1', propertyId: 'p-1', property: 'Seaside Villa', title: 'Pool pump service', assignee: 'Devon Wright', vendor: 'AquaCare Ltd', priority: 'Medium', status: 'Assigned', partsNeeded: 'Filter cartridge', estimatedCost: 260, actualCost: 0, due: '2026-05-08', notes: 'Preventative maintenance.' },
  { id: 'm-3', workspaceId: 'w-1', propertyId: 'p-2', property: 'Kingston Garden Flat', title: 'Replace smart lock batteries', assignee: 'External vendor', vendor: 'SecureStay', priority: 'High', status: 'Waiting on parts', partsNeeded: 'AA lithium batteries', estimatedCost: 80, actualCost: 52, due: '2026-05-06', notes: 'Guest check-in reminder depends on completion.' },
];

export const financialSeries = [
  { month: 'Jan', revenue: 21800, expenses: 7200, profit: 14600, occupancy: 68, maintenance: 1200, cleaning: 84 },
  { month: 'Feb', revenue: 24600, expenses: 7900, profit: 16700, occupancy: 71, maintenance: 900, cleaning: 88 },
  { month: 'Mar', revenue: 30200, expenses: 9300, profit: 20900, occupancy: 79, maintenance: 2100, cleaning: 91 },
  { month: 'Apr', revenue: 28600, expenses: 8400, profit: 20200, occupancy: 76, maintenance: 1600, cleaning: 89 },
  { month: 'May', revenue: 33750, expenses: 10150, profit: 23600, occupancy: 82, maintenance: 2400, cleaning: 94 },
];
export const profitBreakdown = [{ name: 'Owner payout', value: 14200 }, { name: 'Management fees', value: 5100 }, { name: 'Cleaning margin', value: 1600 }, { name: 'Maintenance reserve', value: 2700 }];
export const bookingSources = [{ name: 'Airbnb', value: 48 }, { name: 'Direct', value: 28 }, { name: 'Booking.com', value: 14 }, { name: 'Long-term', value: 10 }];
export const priorityBreakdown = [{ name: 'Low', value: 5 }, { name: 'Medium', value: 8 }, { name: 'High', value: 4 }, { name: 'Urgent', value: 2 }, { name: 'Critical', value: 1 }];

export const ownerReports = [
  { id: 'r-1', workspaceId: 'w-1', ownerId: 'po-1', owner: 'Nia Campbell', property: 'Seaside Villa', type: 'Monthly owner report', period: 'April 2026', status: 'Ready', emailEnabled: true, payout: 10450 },
  { id: 'r-2', workspaceId: 'w-1', ownerId: 'po-2', owner: 'Harbor Trust LLC', property: 'Kingston Garden Flat', type: 'Property performance report', period: 'April 2026', status: 'Draft', emailEnabled: true, payout: 6200 },
];

export const notifications = [
  { id: 'n-1', workspaceId: 'w-1', type: 'New booking', message: 'Olivia Martin booked Seaside Villa for May 9–14.', tone: 'info', time: '12 min ago' },
  { id: 'n-2', workspaceId: 'w-1', type: 'Cleaner assigned', message: 'Tasha Brown assigned to Kingston Garden Flat turnover.', tone: 'success', time: '38 min ago' },
  { id: 'n-3', workspaceId: 'w-1', type: 'Cleaning overdue', message: 'Ocho Rios Townhome cleaning is blocked by a reported leak.', tone: 'warning', time: '1 hr ago' },
  { id: 'n-4', workspaceId: 'w-1', type: 'Maintenance issue reported', message: 'Laundry room water leak created a critical work order.', tone: 'error', time: '2 hr ago' },
  { id: 'n-5', workspaceId: 'w-1', type: 'Urgent issue created', message: 'Critical leak flagged for Devon Wright.', tone: 'error', time: '2 hr ago' },
  { id: 'n-6', workspaceId: 'w-1', type: 'Owner report ready', message: 'Nia Campbell April owner report is ready.', tone: 'success', time: 'Yesterday' },
  { id: 'n-7', workspaceId: 'w-1', type: 'Guest check-in reminder', message: 'Ethan Clarke checks in today at Kingston Garden Flat.', tone: 'info', time: 'Today' },
  { id: 'n-8', workspaceId: 'w-1', type: 'Guest check-out reminder', message: 'Seaside Villa checkout scheduled for May 14.', tone: 'info', time: 'Today' },
  { id: 'n-9', workspaceId: 'w-1', type: 'Maintenance job completed', message: 'Smart lock inspection completed at Kingston Garden Flat.', tone: 'success', time: 'Yesterday' },
  { id: 'n-10', workspaceId: 'w-1', type: 'Report emailed', message: 'Monthly owner report emailed to Nia Campbell.', tone: 'success', time: 'Apr 30' },
];

export const reportTypes = ['Monthly owner report', 'Property performance report', 'Revenue report', 'Expense report', 'Cleaning report', 'Maintenance report'];
