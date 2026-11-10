/**
 * The seller panel's brand accent, used on its logo mark and sign-in panel so
 * the two apps stay distinguishable. Kept in its own module (not App.jsx) to
 * avoid a circular import, since the layout components that use it are
 * themselves reached through App's router.
 */
export const SELLER_ACCENT = '#4F46E5';
