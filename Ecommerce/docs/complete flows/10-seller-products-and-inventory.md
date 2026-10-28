# Seller Products and Inventory

## What Is This?

Sellers manage their product catalog and stock levels through the seller portal. This includes adding new products, editing existing ones, uploading photos, and tracking inventory. This document explains every product and stock management feature.

---

## Who Uses This?

**Approved sellers** managing their shop's product catalog.

---

## What Can You Do?

- Add new products with details and photos
- Edit or remove existing products
- Manage stock quantities
- View stock change history
- See which products are low on stock

---

## Adding a Product

### Step-by-step

1. Seller goes to Products → Add Product
2. Seller fills in product details:
   - **Name** — product name shown to customers
   - **Description** — details about the product
   - **Category** — select from platform categories
   - **Price** — selling price
   - **MRP** — original/maximum retail price (for showing discount)
   - **Unit** — e.g., 500ml, 1kg, pack of 6
3. Seller uploads product photos
4. Seller sets initial stock quantity
5. Seller saves the product

### Product moderation

Depending on platform settings, new products may need **admin approval** before they appear to customers. Until approved, product status shows as "pending moderation."

---

## Editing Products

Sellers can update any product they have listed:

- Change name, description, price, MRP
- Add or replace photos
- Change category
- Update stock quantity
- Activate or deactivate a product (hide from customers without deleting)

Changes take effect immediately for customers browsing the shop.

---

## Removing Products

Sellers can delete products they no longer sell. Deleted products disappear from the customer app. Products in active orders are not affected — only future orders.

---

## Stock Management

### Current stock

Each product has a stock count — how many units are available to sell.

### How stock changes

| Event                         | Stock change                                |
| ----------------------------- | ------------------------------------------- |
| Seller manually adjusts stock | Updated to new value                        |
| Customer places order         | Stock reserved (reduced)                    |
| Order cancelled               | Stock released (restored)                   |
| Order delivered               | Stock permanently reduced                   |
| Return completed              | Stock may be restored if item is resellable |

### Stock history

Sellers can view a log of all stock changes — what changed, when, and why (manual adjustment, order placed, order cancelled, etc.).

### Low stock alerts

Sellers should monitor products running low to avoid disappointing customers with out-of-stock items at checkout.

---

## Product Photos

### Uploading images

- Sellers upload photos from their device
- Images are stored in a cloud image service
- Multiple photos per product supported
- First photo is the main image shown in listings

### Photo guidelines

- Clear, well-lit product images sell better
- Admin may reject products with inappropriate images

---

## Product Listing Page

The seller's product management page shows:

- All listed products in a table or grid
- Product name, price, stock, status (active/inactive/pending)
- Quick actions: edit, adjust stock, deactivate

---

## What Happens Behind the Scenes

- Product data is linked to the seller's shop — customers only see products from shops in their delivery range
- Stock is checked in real time when customers add to cart and at checkout
- When stock reaches zero, product shows as "out of stock" to customers
- Stock reservation happens at order placement — prevents overselling
- Category assignment connects products to the platform's category tree for browsing and search

---

## Important Rules

- Sellers can only manage their own products — not other shops' products
- Prices are set by the seller — platform may add fees on top at checkout
- Stock must be accurate — overselling leads to cancelled orders and unhappy customers
- Product must be in an approved category
- Admin can moderate or remove inappropriate products

---

## What If Something Goes Wrong?

| Problem                           | What happens                                            |
| --------------------------------- | ------------------------------------------------------- |
| Product out of stock during order | Order may be cancelled for that item; customer notified |
| Wrong price set                   | Seller can edit — affects future orders only            |
| Product rejected by admin         | Seller notified; must fix and resubmit                  |
| Stock shows wrong count           | Seller can manually adjust and check stock history      |

---

_Next → [Seller Orders and Fulfillment](11-seller-orders-and-fulfillment.md)_
