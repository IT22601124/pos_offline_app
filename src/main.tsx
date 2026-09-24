import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoutes from './appRouter/app_route';
import { initializeOfflineDatabase } from './offline/seed';

// Initialize offline DB seed data on application startup
initializeOfflineDatabase().catch((err) => {
  console.error('Failed to initialize offline database:', err);
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);

