import { Outlet } from 'react-router-dom';
import { useBootstrapSession } from '@core/auth/useBootstrapSession';
import FullPageSpinner from '@ui/components/FullPageSpinner';

/**
 * Exchanges the stored refresh token for a live session before any guard runs,
 * so a reload on a deep link does not bounce to /login and lose the
 * destination. Shared with the admin app via `@core/auth`.
 */
export default function SessionBootstrap() {
  const status = useBootstrapSession();
  if (status === 'loading') {
    return (
      <div style={{ height: '100vh' }}>
        <FullPageSpinner label="Starting Arise Seller…" />
      </div>
    );
  }
  return <Outlet />;
}
