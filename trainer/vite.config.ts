import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * [v5] π Installable app in the production build only: the manifest link, touch icon and theme colour go into
 * index.html, and web/public (manifest, service worker, icons) is copied to the build root. The dev server
 * (npm run dev) never registers the service worker (web/main.tsx).
 */
function pwa(): Plugin {
  return {
    name: 'trainer-pwa',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/icon-192.png' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: '#2a78d6' }, injectTo: 'head' },
    ],
  };
}

export default defineConfig({
  plugins: [react(), pwa()],
  publicDir: 'web/public',
  build: { outDir: 'dist', emptyOutDir: true },
});
