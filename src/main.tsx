/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { initClientMonitoring, Sentry } from './monitoring.ts';

const monitoringEnabled = initClientMonitoring();

const queryClient = new QueryClient();

const getErrorMessage = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : String(msg ?? '');
  }
  return String(error);
};

const isChunkLoadFailure = (error: unknown): boolean => {
  const msg = getErrorMessage(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|Expected a JavaScript-or-Wasm module script/i.test(
    msg,
  );
};

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadFailure(event.reason)) return;
    const key = 'elevated_chunk_reload_once';
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');
    window.location.reload();
  });
}

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
