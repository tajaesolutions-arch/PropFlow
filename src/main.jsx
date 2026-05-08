import React from 'react';
import { createRoot } from 'react-dom/client';

import { CreateActionProvider } from './components/CreateActionProvider.jsx';
import { SmartNumberFormatting } from './components/SmartNumberFormatting.jsx';
import { AppProvider } from './lib/AppContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';
import './styles/global.css';

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
