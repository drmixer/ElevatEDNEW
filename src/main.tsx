import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { initClientMonitoring, Sentry } from './monitoring.ts';

const monitoringEnabled = initClientMonitoring();

const queryClient = new QueryClient();

const ErrorFallback = () => (
  <div className="app-error-state">
    <h1>Something went wrong</h1>
    <p>Please refresh the page. If the issue persists, contact support.</p>
  </div>
);

const AppTree = (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

const RootTree = monitoringEnabled ? (
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>{AppTree}</Sentry.ErrorBoundary>
) : (
  AppTree
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {RootTree}
  </StrictMode>
);
