import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/auth/sessionStore';
import FullPageSpinner from '@ui/components/FullPageSpinner';

/** Blocks the app shell until the session is known, then routes by status. */
export function RequireAuth() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />;

  if (status === 'anonymous' || status === 'pending_2fa') {
    // Preserve where they were headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (status === 'pending_password_change' && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

/** Keeps signed-in users out of the login screens. */
export function RequireAnonymous() {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);

  if (status === 'loading') return <FullPageSpinner label="Loading…" />;
  if (status === 'authenticated') return <Navigate to={user?.defaultLanding ?? '/'} replace />;
  return <Outlet />;
}
