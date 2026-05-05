import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './routes/AppRouter.jsx';
import { AppProvider } from './lib/AppContext.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <AppRouter />
    </AppProvider>
  </React.StrictMode>,
);
