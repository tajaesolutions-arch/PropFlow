import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './routes/AppRouter.jsx';
import { AppProvider } from './lib/AppContext.jsx';
import { CreateActionProvider } from './components/CreateActionProvider.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <CreateActionProvider>
        <AppRouter />
      </CreateActionProvider>
    </AppProvider>
  </React.StrictMode>,
);
