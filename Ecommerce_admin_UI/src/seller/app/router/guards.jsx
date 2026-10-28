import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/auth/sessionStore';
import { useCan } from '@core/rbac/useCan';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import NoAccess from '@ui/components/NoAccess';

/** Blocks the app shell until the session is known, then routes by status. */
export function RequireAuth() {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />;
  if (status === 'anonymous' || status === 'pending_2fa') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (status === 'pending_password_change' && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

/** Keeps signed-in sellers out of the login screens. */
export function RequireAnonymous() {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);

  if (status === 'loading') return <FullPageSpinner label="Loading…" />;
  if (status === 'authenticated') return <Navigate to={user?.defaultLanding ?? '/'} replace />;
  return <Outlet />;
}

/** Route-level permission gate — renders the 403 page in place of the route. */
export function RequirePermission({ perm, mode = 'any', children }) {
  const can = useCan();
  if (!perm || can(perm, mode)) return children ?? <Outlet />;
  return <NoAccess required={Array.isArray(perm) ? perm : [perm]} />;
}

/**
 * The main shell is for active sellers only. A seller who has not finished (or
 * whose application is still under review) is sent to the onboarding wizard,
 * so half-set-up accounts can never reach screens that assume a live store.
 */
export function RequireActiveSeller() {
  const user = useSessionStore((s) => s.user);
  if (user && !user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** The inverse: once onboarding is complete, the wizard redirects home. */
export function RequireOnboarding() {
  const user = useSessionStore((s) => s.user);
  if (user?.onboardingComplete) return <Navigate to="/" replace />;
  return <Outlet />;
}
