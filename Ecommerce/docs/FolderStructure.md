# Folder Structure

## Root

| Path                                          | Responsibility                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `android/`, `ios/`                            | Native platform projects                                                     |
| `src/`                                        | All JavaScript application code                                              |
| `assets/`                                     | Static assets linked into native builds (fonts via `react-native.config.js`) |
| `docs/`                                       | Documentation                                                                |
| `scripts/`                                    | Tooling scripts (e.g. `generate-structure.ps1`)                              |
| `.env`, `.env.development`, `.env.production` | Environment variables (react-native-config)                                  |
| `babel.config.js`                             | Preset, path aliases, Reanimated plugin                                      |
| `metro.config.js`                             | Bundler config                                                               |
| `.eslintrc.js`, `.prettierrc`, `.husky/`      | Code quality gates                                                           |
| `index.js`                                    | Entry point                                                                  |

## src/

| Folder          | Responsibility                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`          | Application shell: `App.js`, `providers/`, `startup/`, `bootstrap/`, `errorBoundary/`                                                                                  |
| `core/`         | Infrastructure only (api, storage, network, analytics, logger, notifications, firebase, socket, permissions, crashReporting, errorHandler, device). No business logic. |
| `shared/`       | Reusable, feature-agnostic UI (buttons, inputs, cards, modals, skeletons, EmptyState, ...)                                                                             |
| `features/`     | Vertical slices — one folder per business feature                                                                                                                      |
| `navigation/`   | Root/Auth/Customer/Seller/Delivery navigators, tabs, drawer, deep linking, helpers                                                                                     |
| `hooks/`        | App-wide generic hooks (useDebounce, useAppState, ...)                                                                                                                 |
| `contexts/`     | Non-business React contexts only (e.g. keyboard, toast host)                                                                                                           |
| `services/`     | Cross-feature orchestration services (auth, payment, upload, analytics, ...)                                                                                           |
| `database/`     | MMKV access, TTL cache, offline queue, sync engine                                                                                                                     |
| `store/`        | Redux store assembly: `index.js`, `rootReducer.js`, `middleware.js`                                                                                                    |
| `styles/`       | Global style helpers built on theme tokens                                                                                                                             |
| `assets/`       | JS-imported assets (images, icons, lottie animations, fonts)                                                                                                           |
| `constants/`    | api, routes, colors, fonts, spacing, regex, storage keys, payment, firebase, permissions, animations                                                                   |
| `configs/`      | api/env/firebase/theme/app config + feature flags                                                                                                                      |
| `utils/`        | Pure generic utilities (formatters, math, date)                                                                                                                        |
| `helpers/`      | App-aware helpers that may combine utils with app knowledge                                                                                                            |
| `types/`        | JSDoc typedefs and enums (JS project — no TypeScript)                                                                                                                  |
| `validators/`   | Shared Zod schemas (feature-specific schemas live inside features)                                                                                                     |
| `localization/` | i18n bootstrap + `languages/*.json`                                                                                                                                    |
| `permissions/`  | Per-permission modules + central `permissionManager.js`                                                                                                                |
| `theme/`        | Palette, light/dark themes, typography, spacing, radius, elevation, ThemeProvider                                                                                      |
| `tests/`        | Cross-feature unit and integration tests                                                                                                                               |
| `mocks/`        | Mock data and API mocks for tests/dev                                                                                                                                  |

## Every feature (`src/features/<name>/`)

| Folder/File                                                 | Responsibility                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `api/`                                                      | `<name>.api.js` (RTK Query slice), `<name>.endpoints.js`, `<name>.query.js`, `<name>.mapper.js` |
| `components/`                                               | Feature-private components                                                                      |
| `hooks/`                                                    | Feature hooks — the only bridge between screens and state                                       |
| `navigation/`                                               | Feature stack/screens registration                                                              |
| `redux/`                                                    | `<name>.slice.js`, `<name>.selectors.js` (client state only)                                    |
| `screens/`                                                  | Screens — rendering only, no business logic                                                     |
| `services/`                                                 | Feature business services                                                                       |
| `utils/`, `constants/`, `validators/`, `assets/`, `styles/` | Feature-scoped counterparts of the global folders                                               |
| `index.js`                                                  | Public API. **The only file other features may import.**                                        |

## Current features

auth, home, category, product, search, cart, wishlist, checkout, payment, orders, tracking,
notifications, profile, seller, reviews, wallet, referral, support, chat, address, settings,
language, offers, brands, flashSale, recentlyViewed, maintenance, appUpdate, splash, onboarding.
