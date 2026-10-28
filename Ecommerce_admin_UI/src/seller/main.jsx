import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiBaseUrl } from '@core/api/axiosInstance';
import App from '@seller/app/App';
import '../shared/styles/global.css';

// Point the shared HTTP client at the seller API namespace before anything
// renders. The admin app keeps the default (`/api/admin/v1`).
setApiBaseUrl('/api/seller/v1');

async function boot() {
  if (import.meta.env.VITE_API_MODE === 'mock') {
    const { startMockServer } = await import('@seller/mocks/browser');
    await startMockServer();
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
