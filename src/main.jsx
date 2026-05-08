import React from 'react';
import { createRoot } from 'react-dom/client';

import { CreateActionProvider } from './components/CreateActionProvider.jsx';
import { SmartNumberFormatting } from './components/SmartNumberFormatting.jsx';
import { AppProvider } from './lib/AppContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';
import './styles/global.css';
import './styles/topbar-polish.css';
import './styles/mobile-responsiveness.css';
import './styles/form-validation-polish.css';
import './styles/environment-setup.css';
import './styles/notification-alerts.css';
import './styles/reports-export.css';
import './styles/billing-safety.css';
import './styles/upload-safety.css';
import './styles/audit-safety.css';
import './styles/onboarding-setup.css';

const routeAliases = {
  '/accounting-dashboard': '/accountant-dashboard',
};

function applyInitialRouteAlias() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const canonicalPath = routeAliases[currentPath];

  if (!canonicalPath) return;

  window.history.replaceState({}, '', `${canonicalPath}${window.location.search}${window.location.hash}`);
}

applyInitialRouteAlias();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <CreateActionProvider>
        <SmartNumberFormatting />
        <AppRouter />
      </CreateActionProvider>
    </AppProvider>
  </React.StrictMode>,
);
