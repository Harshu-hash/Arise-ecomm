# Naming Conventions

## Folders

- Feature folders: `camelCase` — `flashSale`, `recentlyViewed`.
- Shared component folders: `PascalCase` when they hold a single component (`EmptyState/`),
  `camelCase` for groups (`buttons/`, `inputs/`).

## Files

| Kind          | Pattern                  | Example                   |
| ------------- | ------------------------ | ------------------------- |
| Component     | `PascalCase.js`          | `ProductCard.js`          |
| Screen        | `PascalCaseScreen.js`    | `ProductDetailsScreen.js` |
| Hook          | `useCamelCase.js`        | `useProductList.js`       |
| RTK Query api | `<feature>.api.js`       | `product.api.js`          |
| Endpoints     | `<feature>.endpoints.js` | `product.endpoints.js`    |
| Queries       | `<feature>.query.js`     | `product.query.js`        |
| Mapper        | `<feature>.mapper.js`    | `product.mapper.js`       |
| Slice         | `<feature>.slice.js`     | `cart.slice.js`           |
| Selectors     | `<feature>.selectors.js` | `cart.selectors.js`       |
| Service       | `<name>.service.js`      | `payment.service.js`      |
| Permission    | `<name>.permission.js`   | `camera.permission.js`    |
| Validator     | `<name>.schema.js`       | `login.schema.js`         |
| Styles        | `<Component>.styles.js`  | `ProductCard.styles.js`   |
| Constants     | `camelCase.js`           | `routes.js`               |
| Navigator     | `PascalCaseNavigator.js` | `CustomerNavigator.js`    |

## Symbols

- Components and navigators: `PascalCase`.
- Hooks: `useCamelCase`.
- Functions and variables: `camelCase`.
- Constants and enums: `SCREAMING_SNAKE_CASE` (`API_TIMEOUT_MS`, `ROUTES.PRODUCT_DETAILS`).
- Redux: slice name matches feature (`cart`), actions in `camelCase` (`itemAdded`),
  selectors prefixed with `select` (`selectCartTotal`).
- Zod schemas: suffix `Schema` (`loginSchema`).
- Event names (socket/analytics): `snake_case` (`order_status_updated`).

## Booleans and Handlers

- Booleans: `is/has/can/should` prefixes (`isLoading`, `hasStock`).
- Event props: `on` prefix (`onPress`); handlers: `handle` prefix (`handleSubmit`).
