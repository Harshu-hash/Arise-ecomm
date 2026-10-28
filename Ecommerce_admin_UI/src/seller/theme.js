/**
 * The seller panel's distinct accent, so the two apps never look identical.
 * Kept in its own module (not App.jsx) to avoid a circular import, since the
 * layout components that use it are themselves reached through App's router.
 */
export const SELLER_ACCENT = '#4F46E5';
export const SELLER_ACCENT_HOVER = '#6366F1';
