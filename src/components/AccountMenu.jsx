import React from 'react';
import { UserRound } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { roleLabels } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';
export function AccountMenu() {
  const { currentUser } = useApp();
  return <button className="account-menu" onClick={() => navigate('/account')}><UserRound size={18} /><span>{currentUser?.name}<small>{roleLabels[currentUser?.roles?.[0]]}</small></span></button>;
}
