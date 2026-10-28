# Architecture

## Style

The project combines **Feature-Based (Vertical Slice) Architecture** with **Clean Architecture
principles**:

- Each feature under `src/features/` is a self-contained vertical slice: API, state, screens,
  components, hooks, services, validators, styles and assets all live inside the feature.
- Cross-cutting infrastructure (HTTP, storage, sockets, analytics, logging, permissions) lives in
  `src/core/` and contains **no business logic**.
- Reusable presentation lives in `src/shared/` and contains **no feature knowledge**.

Dependency direction (only downward imports are allowed):

```
features  →  shared, core, services, store, theme, constants, utils
shared    →  theme, constants, utils
core      →  configs, constants
```

## Data Flow

```
Screen → Hook → RTK Query / Redux slice → Feature API layer → Axios instance (core/api) → Backend
```

- **Server state** is owned by RTK Query (caching, invalidation, refetching). API responses are
  never manually copied into slices.
- **Client state** (cart draft, UI toggles, session role) is owned by feature slices combined in
  `src/store/rootReducer.js`.
- Screens never import Axios and never contain business logic; they render state and dispatch
  intents through hooks.

## Feature Isolation

- Every feature exposes a single public surface: its `index.js` barrel.
- Importing a private file from another feature (e.g. `@features/cart/redux/cart.slice`) is
  forbidden; import `@features/cart` instead.
- This allows features listed in the roadmap (multi-vendor, subscriptions, rentals, loyalty,
  video shopping, ...) to be added or deleted without touching the rest of the app.

## Key Decisions

| Decision                                         | Rationale                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| RTK Query for server state                       | Removes hand-written thunks/caching; consistent loading/error states       |
| MMKV over AsyncStorage                           | ~30x faster synchronous storage; needed for startup and offline cache      |
| Axios + interceptors in `core/api`               | Single place for auth tokens, refresh, retries, error normalization        |
| Role-based navigators (Customer/Seller/Delivery) | Seller and delivery-partner apps can grow without touching customer flows  |
| Central theme tokens                             | Light/dark mode and rebranding without touching feature code               |
| Central permissions module                       | One rationale/blocked-state flow for camera, location, notifications, etc. |
| Offline queue + sync in `database/`              | Mutations survive connectivity loss; replayed by `sync.js`                 |

## Startup Sequence

1. `index.js` registers `src/app/App.js`.
2. `app/bootstrap/` initializes infrastructure: MMKV, Firebase, crash reporting, notifications,
   network listener, socket client.
3. `app/providers/` composes Redux, Theme, Localization, GestureHandler, SafeArea and the global
   ErrorBoundary.
4. `app/startup/` restores the session, decides the initial route, hides the splash screen.
5. `navigation/RootNavigator.js` routes to Auth / Customer / Seller / Delivery stacks by role.
