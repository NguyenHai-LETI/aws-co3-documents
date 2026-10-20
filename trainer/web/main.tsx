/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { DataProvider } from './lib/store.tsx';
import './styles.css';
import './styles-runner.css';
import './styles-insights.css';
import './styles-search.css';
import './styles-learning.css';
import './styles-quality.css';
import './styles-tools.css';

// [v5] π Installable app: the app-shell service worker (web/public/sw.js) runs with the production build only, in a secure
// context (this machine, or a LAN device over HTTPS). The dev server removes one left by `npm start` on the same origin,
// so HMR never sits behind a cached shell.
if ('serviceWorker' in navigator && window.isSecureContext) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  } else {
    void navigator.serviceWorker
      .getRegistrations()
      .then((list) => list.forEach((r) => void r.unregister()))
      .catch(() => undefined);
  }
}

// A page loaded before a rebuild may ask for chunks that no longer exist (the server keeps one previous build's assets):
// reload once to get the current build — the flag (shared with App.tsx lazyPage) prevents a loop, and is cleared once
// the page has run for a while.
const RELOAD_FLAG = 'trainer.chunkReload';
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return; // no storage: never risk a loop
  }
  event.preventDefault();
  window.location.reload();
});
setTimeout(() => {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // storage unavailable
  }
}, 10_000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>,
);
