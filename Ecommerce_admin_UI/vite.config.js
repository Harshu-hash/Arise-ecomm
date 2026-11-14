import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * The admin app owns the site root ('/', '/orders', …); the seller app is a
 * second SPA mounted under '/seller' (its router uses basename '/seller').
 * Vite's built-in history fallback only serves one index.html, so this
 * middleware routes any '/seller…' document request to seller.html for both
 * the dev server and `vite preview`. Non-document requests (assets) pass
 * through untouched, since only navigations send `Accept: text/html`.
 */
function sellerSpaFallback() {
  const rewrite = (req, _res, next) => {
    const accept = req.headers?.accept ?? '';
    const pathname = (req.url ?? '').split('?')[0];
    if (accept.includes('text/html') && (pathname === '/seller' || pathname.startsWith('/seller/'))) {
      req.url = '/seller.html';
    }
    next();
  };
  return {
    name: 'seller-spa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

const alias = {
  // Shared foundation (cross-module)
  '@core': path.resolve(__dirname, 'src/shared/core'),
  '@ui': path.resolve(__dirname, 'src/shared/ui'),
  '@theme': path.resolve(__dirname, 'src/shared/theme'),
  '@mocks': path.resolve(__dirname, 'src/shared/mocks'),
  // Modules
  '@admin': path.resolve(__dirname, 'src/admin'),
  '@seller': path.resolve(__dirname, 'src/seller'),
};

export default defineConfig({
  plugins: [react(), sellerSpaFallback()],
  resolve: { alias },
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist',
    // Production source maps expose internal routes and mock/demo strings.
    // Keep them available only for explicit non-production diagnostics.
    sourcemap: process.env.VITE_ENABLE_SOURCEMAPS === 'true',
    rollupOptions: {
      // Two independent apps, one project: admin (index.html, served at root)
      // and seller (seller.html, served under /seller) each get their own
      // bundle. A seller never downloads admin code or vice-versa.
      input: {
        admin: path.resolve(__dirname, 'index.html'),
        seller: path.resolve(__dirname, 'seller.html'),
      },
      output: {
        // Only genuinely shared, stable libraries are pinned to their own
        // chunks. Ant Design is deliberately NOT pinned: letting Rollup split
        // it naturally keeps heavy widgets (DatePicker, Table) in the route
        // chunks that actually use them rather than in the initial payload.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          sheets: ['xlsx', 'papaparse'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/test/setup.js'],
    css: false,
  },
});
