import React from 'react';
import { AlertTriangle, ClipboardCheck, DollarSign, LockKeyhole, PackagePlus, ShieldCheck, ShoppingCart } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const inventoryManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const inventoryCostRoles = [...inventoryManagerRoles, roles.ACCOUNTANT];
const cleanerInventoryRoles = [roles.CLEANER];

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function getItemQuantity(item) {
  return Number(item?.current_quantity ?? item?.currentQuantity ?? 0);
}

function getItemThreshold(item) {
  return Number(item?.low_stock_threshold ?? item?.lowStockThreshold ?? 0);
}

function isLowStock(item) {
  const quantity = getItemQuantity(item);
  const threshold = getItemThreshold(item);
  return quantity <= 0 || quantity <= threshold || item?.status === 'low_stock' || item?.status === 'out_of_stock';
}

function getRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, inventoryManagerRoles)) {
    return 'Workspace Owners, Property Managers, and Hosts can manage supply records when workspace permissions allow it.';
  }

  if (hasAnyRole(currentUser, [roles.ACCOUNTANT])) {
    return 'Accountants should see supply cost context, totals, and receipts without operational reorder controls.';
  }

  if (hasAnyRole(currentUser, cleanerInventoryRoles)) {
    return 'Cleaners should only see assigned cleaning supplies, usage notes, and low-stock reporting prompts.';
  }

  return 'Inventory visibility should remain restricted unless the role has an operational or finance reason to view supplies.';
}

export function InventorySafetyNotice() {
  const { currentUser, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const supplies = Array.isArray(data?.inventoryItems) ? data.inventoryItems : [];
  const lowStockCount = supplies.filter(isLowStock).length;
  const canManageInventory = hasAnyRole(currentUser, inventoryManagerRoles);
  const canViewCosts = hasAnyRole(currentUser, inventoryCostRoles);

  return (
    <section className="card inventory-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Inventory and supplies safety</p>
          <h3>Supply tracking readiness</h3>
          <p>
            Inventory views use existing workspace records only. Reorder automation, purchase workflows,
            and supplier integrations are intentionally not connected yet.
          </p>
        </div>
        <PackagePlus size={22} className="muted" />
      </div>

      <div className="inventory-safety-grid">
        <div className="inventory-safety-card">
          <PackagePlus size={18} />
          <span>
            <strong>Supply records</strong>
            <small>{supplies.length ? `${supplies.length} workspace supply record${supplies.length === 1 ? '' : 's'} found.` : 'No supply records found yet. Show a clean empty state and add-supply prompt.'}</small>
          </span>
          <StatusBadge tone={supplies.length ? 'info' : 'warning'}>{supplies.length ? 'workspace scoped' : 'empty'}</StatusBadge>
        </div>

        <div className="inventory-safety-card">
          <AlertTriangle size={18} />
          <span>
            <strong>Low-stock warnings</strong>
            <small>Low-stock alerts should be generated from real quantities and thresholds only.</small>
          </span>
          <StatusBadge tone={lowStockCount ? 'warning' : 'success'}>{lowStockCount ? `${lowStockCount} low` : 'none'}</StatusBadge>
        </div>

        <div className="inventory-safety-card">
          <ClipboardCheck size={18} />
          <span>
            <strong>Supplies used</strong>
            <small>Supplies-used tracking should connect to cleaning tasks later. Do not invent usage records.</small>
          </span>
          <StatusBadge tone="warning">placeholder</StatusBadge>
        </div>

        <div className="inventory-safety-card">
          <ShoppingCart size={18} />
          <span>
            <strong>Reorder actions</strong>
            <small>Purchase orders, supplier checkout, and reorder automation are not connected yet.</small>
          </span>
          <StatusBadge tone="warning">disabled</StatusBadge>
        </div>

        <div className="inventory-safety-card">
          <DollarSign size={18} />
          <span>
            <strong>Cost visibility</strong>
            <small>{canViewCosts ? 'This role may view inventory cost context when workspace-scoped.' : 'This role should not see detailed cost controls unless explicitly allowed.'}</small>
          </span>
          <StatusBadge tone={canViewCosts ? 'info' : 'warning'}>{canViewCosts ? 'visible' : 'limited'}</StatusBadge>
        </div>

        <div className="inventory-safety-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{getRoleMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={canManageInventory ? 'success' : 'info'}>{primaryRole || 'role checked'}</StatusBadge>
        </div>
      </div>

      <div className="helper inventory-safety-helper">
        <LockKeyhole size={16} />
        Before enabling automation, enforce workspace_id scoping, role-safe cost visibility, task-linked usage records, audit history, and disabled public supplier actions.
      </div>
    </section>
  );
}
