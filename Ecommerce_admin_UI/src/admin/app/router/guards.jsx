import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/auth/sessionStore';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import NoAccess from '@ui/components/NoAccess';
import { canSeeNavItem, firstAllowedPath, navItemForLocation, requiredKeysFor } from '@admin/nav/access';

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

/** Shows the 403 page when the current URL belongs to a sidebar item the admin has no permission for. */
export function RequireNavAccess() {
  const permissions = useSessionStore((s) => s.permissions);
  const { pathname } = useLocation();
  const item = navItemForLocation(pathname);

  if (item && !canSeeNavItem(item, permissions)) {
    // landing on '/' without dashboard access: go to the first page that is allowed rather than a dead end
    const home = pathname === '/' ? firstAllowedPath(permissions) : null;
    return home ? <Navigate to={home} replace /> : <NoAccess required={requiredKeysFor(item)} />;
  }
  return <Outlet />;
}
