# Generates the complete project folder structure per Folder_structure.md.
# Idempotent: never overwrites existing files.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Make-Dir([string]$p) {
    New-Item -ItemType Directory -Force -Path (Join-Path $root $p) | Out-Null
}

function Make-Stub([string]$p, [string]$c = "") {
    $full = Join-Path $root $p
    $parent = Split-Path -Parent $p
    if ($parent) { Make-Dir $parent }
    if (-not (Test-Path $full)) {
        Set-Content -Path $full -Value $c -Encoding UTF8
    }
}

function Make-Keep([string]$p) {
    Make-Dir $p
    Make-Stub "$p/.gitkeep"
}

# ---------------------------------------------------------------- root
Make-Keep "android"
Make-Keep "ios"
Make-Keep "assets/fonts"
Make-Keep "assets/images"
Make-Keep "assets/animations"
Make-Keep "assets/icons"
Make-Dir  "docs"
Make-Dir  "scripts"

# ---------------------------------------------------------------- src top level
$srcDirs = @(
    "app", "core", "shared", "features", "navigation", "hooks", "contexts",
    "services", "database", "store", "styles", "assets", "constants",
    "configs", "utils", "helpers", "types", "validators", "localization",
    "permissions", "theme", "tests", "mocks"
)
foreach ($d in $srcDirs) { Make-Dir "src/$d" }

# ---------------------------------------------------------------- app
Make-Stub "src/app/App.js" "// Root application component. Composes providers, bootstrap and navigation.`nexport {};"
Make-Stub "src/app/providers/index.js" "// AppProviders: Redux, Theme, Localization, GestureHandler, SafeArea, ErrorBoundary."
Make-Stub "src/app/startup/index.js" "// Startup tasks executed once on app launch (splash, auth restore, remote config)."
Make-Stub "src/app/bootstrap/index.js" "// Bootstrap: initialize core infrastructure (firebase, storage, notifications, socket)."
Make-Stub "src/app/errorBoundary/ErrorBoundary.js" "// Global React error boundary. Reports to crashReporting and shows fallback UI."
Make-Stub "src/app/errorBoundary/index.js" "export { default } from './ErrorBoundary';"

# ---------------------------------------------------------------- core (infrastructure only, no business logic)
$coreDirs = @(
    "api", "storage", "network", "analytics", "logger", "notifications",
    "firebase", "socket", "permissions", "crashReporting", "errorHandler", "device"
)
foreach ($d in $coreDirs) {
    Make-Dir "src/core/$d"
    Make-Stub "src/core/$d/index.js" "// core/$d - infrastructure module. No business logic allowed here."
}
Make-Stub "src/core/api/axiosInstance.js" "// Configured Axios instance (baseURL, timeouts) used by all feature APIs."
Make-Stub "src/core/api/interceptors.js" "// Request/response interceptors: auth token, refresh, logging, error normalization."
Make-Stub "src/core/api/baseQuery.js" "// RTK Query baseQuery built on top of the Axios instance."
Make-Stub "src/core/storage/mmkvStorage.js" "// MMKV instance + typed get/set/remove wrappers."
Make-Stub "src/core/network/networkListener.js" "// Connectivity listener (online/offline) exposed to the app."
Make-Stub "src/core/socket/socketClient.js" "// Socket.io client: connect, disconnect, event subscription helpers."

# ---------------------------------------------------------------- shared (reusable UI only)
$sharedDirs = @(
    "components", "layouts", "ui", "icons", "images", "fonts", "animations",
    "modals", "bottomSheets", "cards", "forms", "loaders", "headers",
    "footers", "badges", "chips", "avatars", "rating", "price", "buttons",
    "inputs", "skeletons", "EmptyState", "ErrorState", "Pagination", "SearchBar"
)
foreach ($d in $sharedDirs) {
    Make-Dir "src/shared/$d"
    Make-Stub "src/shared/$d/index.js" "// shared/$d - reusable, feature-agnostic UI. Never place feature code here."
}
Make-Stub "src/shared/index.js" "// Public barrel for all shared UI modules."

# ---------------------------------------------------------------- features
$features = @(
    "auth", "home", "category", "product", "search", "cart", "wishlist",
    "checkout", "payment", "orders", "tracking", "notifications", "profile",
    "seller", "reviews", "wallet", "referral", "support", "chat", "address",
    "settings", "language", "offers", "brands", "flashSale", "recentlyViewed",
    "maintenance", "appUpdate", "splash", "onboarding"
)
$featureSubDirs = @(
    "api", "components", "hooks", "navigation", "redux", "screens",
    "services", "utils", "constants", "validators", "assets", "styles"
)
foreach ($f in $features) {
    foreach ($sd in $featureSubDirs) { Make-Dir "src/features/$f/$sd" }

    Make-Stub "src/features/$f/index.js" "// Public API of the '$f' feature. Other features may ONLY import from this file."
    Make-Stub "src/features/$f/api/$f.api.js" "// RTK Query api slice for '$f' (injected endpoints)."
    Make-Stub "src/features/$f/api/$f.endpoints.js" "// Endpoint path constants for '$f'."
    Make-Stub "src/features/$f/api/$f.query.js" "// Query/mutation definitions for '$f'."
    Make-Stub "src/features/$f/api/$f.mapper.js" "// Maps backend DTOs to app models for '$f'."
    Make-Stub "src/features/$f/redux/$f.slice.js" "// Redux Toolkit slice for '$f' client state (server state lives in RTK Query)."
    Make-Stub "src/features/$f/redux/$f.selectors.js" "// Memoized selectors for '$f' state."

    foreach ($sd in @("components", "hooks", "navigation", "screens", "services", "utils", "constants", "validators", "assets", "styles")) {
        Make-Stub "src/features/$f/$sd/.gitkeep"
    }
}

# ---------------------------------------------------------------- navigation
Make-Stub "src/navigation/RootNavigator.js" "// Decides between Auth / Customer / Seller / Delivery stacks based on session role."
Make-Stub "src/navigation/AuthNavigator.js" "// Stack for unauthenticated flows: login, register, OTP, forgot password."
Make-Stub "src/navigation/CustomerNavigator.js" "// Main customer stack wrapping bottom tabs and modal screens."
Make-Stub "src/navigation/SellerNavigator.js" "// Seller-facing stack."
Make-Stub "src/navigation/DeliveryNavigator.js" "// Delivery-partner-facing stack."
Make-Stub "src/navigation/BottomTabs.js" "// Bottom tab navigator: Home, Categories, Cart, Orders, Profile."
Make-Stub "src/navigation/DrawerNavigator.js" "// Drawer navigator for secondary destinations."
Make-Stub "src/navigation/ModalNavigator.js" "// Group of screens presented modally (filters, pickers, previews)."
Make-Stub "src/navigation/linking.js" "// Deep linking configuration (prefixes + screen path map)."
Make-Stub "src/navigation/navigationRef.js" "// createNavigationContainerRef instance for navigation outside React components."
Make-Stub "src/navigation/navigationHelpers.js" "// navigate/push/reset/goBack helpers built on navigationRef."
Make-Stub "src/navigation/index.js" "// Barrel for navigators and helpers."

# ---------------------------------------------------------------- store
Make-Stub "src/store/index.js" "// configureStore: rootReducer + middleware + RTK Query setup listeners."
Make-Stub "src/store/rootReducer.js" "// Combines feature slices and RTK Query reducers."
Make-Stub "src/store/middleware.js" "// Custom middleware list (api middleware, logger in dev, analytics)."

# ---------------------------------------------------------------- configs
Make-Stub "src/configs/api.config.js" "// API base URLs, timeouts, retry policy per environment."
Make-Stub "src/configs/env.config.js" "// Reads react-native-config env vars, exposes a validated ENV object."
Make-Stub "src/configs/firebase.config.js" "// Firebase project options per environment."
Make-Stub "src/configs/featureFlags.js" "// Local + remote feature flags (multiVendor, wallet, chat, videoShopping...)."
Make-Stub "src/configs/theme.config.js" "// Theme mode defaults and persistence key."
Make-Stub "src/configs/app.config.js" "// App-level constants: name, version gates, support links, store URLs."
Make-Stub "src/configs/index.js" "// Barrel for configs."

# ---------------------------------------------------------------- constants
$constants = @("api", "routes", "colors", "fonts", "spacing", "regex", "storage", "payment", "firebase", "permissions", "animations")
foreach ($c in $constants) {
    Make-Stub "src/constants/$c.js" "// $c constants. Never hardcode these values elsewhere."
}
Make-Stub "src/constants/index.js" "// Barrel for constants."

# ---------------------------------------------------------------- services
$services = @("auth", "payment", "notification", "location", "upload", "camera", "gallery", "voice", "analytics")
foreach ($s in $services) {
    Make-Stub "src/services/$s.service.js" "// $s service: orchestrates core modules + third-party SDKs. One responsibility."
}
Make-Stub "src/services/index.js" "// Barrel for services."

# ---------------------------------------------------------------- database
Make-Stub "src/database/mmkv.js" "// MMKV database access layer (re-exports core/storage instance with domain helpers)."
Make-Stub "src/database/cache.js" "// TTL-based response/image cache built on MMKV."
Make-Stub "src/database/offline.js" "// Offline queue for mutations performed without connectivity."
Make-Stub "src/database/sync.js" "// Sync engine: replays offline queue when connectivity is restored."
Make-Stub "src/database/index.js" "// Barrel for database modules."

# ---------------------------------------------------------------- localization
Make-Stub "src/localization/i18n.js" "// i18n bootstrap: language detection, fallback, MMKV persistence."
Make-Stub "src/localization/index.js" "// Barrel: t(), useTranslation, changeLanguage."
Make-Stub "src/localization/languages/en.json" "{}"
Make-Stub "src/localization/languages/hi.json" "{}"

# ---------------------------------------------------------------- permissions
$perms = @("camera", "gallery", "location", "notification", "microphone", "storage", "bluetooth")
foreach ($p in $perms) {
    Make-Stub "src/permissions/$p.permission.js" "// $p permission: check + request + blocked handling."
}
Make-Stub "src/permissions/permissionManager.js" "// Central manager: request(permission), openSettings, rationale dialogs."
Make-Stub "src/permissions/index.js" "// Barrel for permissions."

# ---------------------------------------------------------------- theme
Make-Stub "src/theme/palette.js" "// Raw color palette. Only theme files may import this."
Make-Stub "src/theme/lightTheme.js" "// Light mode semantic tokens."
Make-Stub "src/theme/darkTheme.js" "// Dark mode semantic tokens."
Make-Stub "src/theme/typography.js" "// Font families, sizes, weights, line heights."
Make-Stub "src/theme/spacing.js" "// Spacing scale (4pt grid)."
Make-Stub "src/theme/radius.js" "// Border radius scale."
Make-Stub "src/theme/elevation.js" "// Shadow/elevation presets."
Make-Stub "src/theme/animations.js" "// Duration/easing tokens for Reanimated."
Make-Stub "src/theme/ThemeProvider.js" "// Theme context provider + useTheme hook (light/dark switching)."
Make-Stub "src/theme/index.js" "// Barrel for theme."

# ---------------------------------------------------------------- misc src folders
Make-Stub "src/styles/globalStyles.js" "// App-wide StyleSheet helpers built from theme tokens."
Make-Stub "src/styles/index.js" "// Barrel for styles."
Make-Keep "src/hooks"
Make-Keep "src/contexts"
Make-Keep "src/utils"
Make-Keep "src/helpers"
Make-Keep "src/types"
Make-Keep "src/validators"
Make-Keep "src/mocks"
Make-Keep "src/tests/unit"
Make-Keep "src/tests/integration"
Make-Keep "src/assets/images"
Make-Keep "src/assets/icons"
Make-Keep "src/assets/animations"
Make-Keep "src/assets/fonts"

Write-Host "Folder structure generated successfully."

