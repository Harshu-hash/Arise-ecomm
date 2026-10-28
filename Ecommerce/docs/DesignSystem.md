# Design System

Single design language for the entire app. Implemented in `src/theme/` (tokens) and
`src/shared/` (components). No screen may use raw colors, ad-hoc font sizes, or random spacing.

## Color

Brand primary is a deep desaturated blue (`#2A4BA0`) — trustworthy and premium, in the family of
established marketplaces without copying any. The accent is warm amber (`#F9B023`), reserved
exclusively for offers, ratings and promotional highlights so it keeps its meaning. Everything
else is a cool neutral ramp. Status colors are muted (Google-style greens/reds), never neon.

- Semantic tokens only: components read `colors.textSecondary`, never `palette.grey600`.
- Both modes ship day one: `lightTheme.js` and `darkTheme.js` are key-for-key mirrors.
- Discount/price-drop text uses `priceDiscount`; ratings use `rating`; both remapped in dark mode.

## Typography

System font (SF Pro / Roboto) for native feel and zero load cost. Twelve-step scale defined in
`typography.js`: `headingXl/Lg/Md/Sm`, `bodyLg/Md/Sm`, `caption`, `button`, `label`, `price(+Lg)`,
`offer`. Headings use tighter letter-spacing and semibold/bold weights; body stays regular for
readability. All text renders through `<AppText variant="..." color="...">` — the `Text`
primitive is never used directly.

## Spacing, Radius, Elevation

- Spacing: 4pt grid — 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (`spacing.xxs` … `spacing.massive`).
  Screens use `screenPadding` (16) horizontally.
- Radius: 4–20 plus pill. Cards use 16, controls 12, badges 4. Nothing oversized.
- Elevation: five soft levels (`level0`–`level4`). Cards sit at level 1, sheets at level 3,
  floating CTAs at level 4. No giant shadows; iOS shadows are low-opacity and tight.

## Iconography

One family: **Feather** — consistent stroke weight, minimal, premium. FontAwesome is permitted
only for star glyphs in `RatingStars` (Feather has no half-star). Never mix other icon sets.

## Motion

Subtle and purposeful only (`animations.js`): press feedback scales to 0.97 over 100–150ms with
a standard-curve easing; skeletons pulse opacity (no harsh shimmer bands); durations capped at
400ms. Powered by Reanimated. Decoration-only animation is banned.

## Components (`src/shared/`)

| Component                          | Purpose                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `AppText`                          | Sole text primitive; enforces scale + semantic colors; caps font scaling at 1.4x  |
| `PressableScale`                   | Standard press feedback for all tappables                                         |
| `Screen`                           | Themed background, safe area, status bar for every screen                         |
| `AppButton`                        | primary / secondary / outlined / text / danger · lg / md / sm · loading, disabled |
| `IconButton`                       | Circular icon actions (plain / tonal / surface) with 44pt targets                 |
| `TextField`                        | Label, focus ring, error/helper text, password toggle; RHF-ready                  |
| `QuantityStepper`                  | Cart quantity control with min/max clamping                                       |
| `SearchBar`                        | Real input, or navigational "fake" bar for Home                                   |
| `Chip`                             | Filters/variants; selected state uses subtle brand tint                           |
| `Badge`                            | discount / warning / error / info / accent / neutral intents                      |
| `Avatar`                           | Image or initials fallback; sm / md / lg                                          |
| `RatingStars`                      | Stars + value + count in one accessible unit                                      |
| `PriceText`                        | Price + strikethrough MRP + computed % off; single price presentation             |
| `SectionHeader`                    | Title + "See all" for every Home section                                          |
| `EmptyState` / `ErrorState`        | Guiding icon + title + message + CTA; ErrorState adds retry                       |
| `Skeleton` / `ProductCardSkeleton` | Loading placeholders matching real layouts                                        |
| `FullScreenLoader`                 | Blocking operations only (payment, order placement)                               |
| `ProductCard` / `CategoryCard`     | Marketplace grid card and category tile                                           |
| `Divider`                          | hairline rows / thick section bands                                               |

## Accessibility

44pt minimum touch targets (`touchTarget` token), `accessibilityRole`/`Label`/`State` on all
interactive components, font scaling supported (capped to protect layouts), contrast-checked
palettes in both modes, color never the only signal (discounts also say "% off").

## Hard Rules

No glassmorphism, no neumorphism, no gradient washes, no giant shadows, no oversized radii,
no raw hex in components, no direct `Text`/`TouchableOpacity` usage — use the shared library.
