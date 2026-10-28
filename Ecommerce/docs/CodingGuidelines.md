# Coding Guidelines

## File Rules

- Maximum **250 lines** per file (enforced by ESLint `max-lines`). Split larger files.
- One responsibility per file: one component, one hook, one service, one utility.
- Every folder that is a module exposes an `index.js` barrel.

## Architecture Rules

- No business logic in screens. Screens render state and call hooks.
- No API calls in components. Flow: Screen → Hook → RTK Query/Redux → API layer → Axios.
- Server state lives in RTK Query only. Never copy API responses into slices manually.
- No Context API for global business state — Redux Toolkit only. Contexts are allowed for
  non-business UI concerns (toast host, keyboard).
- Never import a private file from another feature; use the feature's `index.js`.

## Values and Styling

- No hardcoded values or magic numbers: use `@constants` and `@theme` tokens.
- No hardcoded colors: use semantic theme tokens (works in light and dark mode).
- No inline styles except trivial one-liners; use `StyleSheet.create` in a sibling `*.styles.js`.

## Imports

- Absolute aliases only (`@app`, `@core`, `@shared`, `@features`, `@services`, `@store`,
  `@utils`, `@assets`, `@configs`, ...). Never `../../../../`.

## Performance

- Lists: FlashList with `estimatedItemSize`, pagination / infinite scroll.
- Memoize: `React.memo` for pure components, `useMemo`/`useCallback` for referential stability.
- Images: Fast Image with caching; prefetch above-the-fold images.
- Debounce search inputs; lazy-load heavy screens with dynamic imports.

## Forms and Validation

- React Hook Form for form state; Zod schemas for validation.
- Shared schemas in `src/validators/`, feature schemas in `features/<name>/validators/`.

## Quality Gates

- ESLint + Prettier run on every commit via Husky + lint-staged. Commits with lint errors fail.
- Write tests next to logic-heavy modules; cross-feature tests live in `src/tests/`.
