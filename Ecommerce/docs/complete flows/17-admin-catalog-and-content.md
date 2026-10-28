# Admin Catalog and Content

## What Is This?

Admins control what customers see when they shop — categories, products, home page layout, offers, coupons, and FAQs. This document covers all catalog management and content/marketing tools.

---

## Who Uses This?

**Platform administrators** managing the product catalog and customer-facing content.

---

## What Can You Do?

- Manage three-level category hierarchy
- Moderate products across all sellers
- Configure home page sections and banners
- Create and manage offers and coupons
- Manage FAQs
- Send broadcast notifications
- Moderate customer reviews

---

## Category Management

### Three-level hierarchy

| Level            | Example |
| ---------------- | ------- |
| Header category  | Grocery |
| Level 2 category | Dairy   |
| Subcategory      | Milk    |

### What admins can do

- Create, edit, and delete categories at each level
- Upload category images and icons
- Set display order (which categories appear first)
- View hierarchy in a tree/drag-and-drop layout
- Assign parent-child relationships

### Why it matters

Categories organize the entire product catalog. Customers browse by category, and sellers assign products to categories when listing them.

---

## Product Management

### Across all sellers

Admin can see every product listed by every seller on the platform.

### Moderation

- **Approve** new products before they go live (if moderation is enabled)
- **Reject** products that violate policies
- **Edit** product details if needed
- **Remove** inappropriate listings

### Product list shows

- Product name, seller, category, price, stock, status
- Filter by seller, category, or status

---

## Content Management (Experience Studio)

The home page is not static — admin configures what customers see.

### Home page sections

- Create curated product rows (e.g., "Top Picks", "Fresh Arrivals")
- Choose which products appear in each section
- Set section order on the home page
- Enable or disable sections

### Hero banners

- Upload large promotional banners
- Link banners to categories, products, or offers
- Set banner order and visibility

### Hero categories per page

- Configure which categories are highlighted on different pages
- Customize the shopping experience per section

### Shop by store

- Configure which sellers appear in the "shop by store" section
- Set display order and visibility

---

## Offers Management

### Offer banners

- Create promotional offer images
- Set title, description, image, and link
- Activate or deactivate offers

### Offer sections

- Group related offers together
- Display as sections on the offers page
- Control order and visibility

---

## Coupon Management

### Creating coupons

Admin sets:

- **Coupon code** — what customer types at checkout
- **Discount type** — percentage off or flat amount off
- **Discount value** — how much off
- **Minimum order value** — cart must be at least this amount
- **Maximum discount cap** — limit on how much can be saved
- **Expiry date** — when the coupon stops working
- **Usage limit** — how many times total and per customer
- **Active/inactive** — toggle on or off

### Managing coupons

- View all coupons and their usage stats
- Edit or deactivate expired or unused coupons
- See how many times each coupon has been used

---

## FAQ Management

- Add, edit, and delete frequently asked questions
- Set question and answer text
- Control display order
- FAQs appear on the customer app's help section

---

## Notification Composer

Admin can send broadcast notifications to users:

- **Title and message** — what the notification says
- **Target audience** — all customers, all sellers, all riders, or everyone
- **Send** — notification delivered as in-app alert and push notification

Useful for announcements, promotions, and important updates.

---

## Review Moderation

Customer product reviews go through admin approval:

- **Pending reviews** — waiting for moderation
- **Approve** — review becomes visible on product page
- **Reject** — review is hidden (inappropriate, spam, fake)

---

## What Happens Behind the Scenes

- Category changes reflect immediately in customer app browsing
- Product moderation controls what customers can see and buy
- Home page sections load dynamically from admin configuration
- Coupon validation happens server-side at checkout — admin rules are enforced exactly
- Broadcast notifications are queued and sent to all targeted users

---

## Important Rules

- Category structure affects all sellers — changes impact the whole catalog
- Deactivating a category hides all products in it
- Coupons cannot be overridden by customers — server validates everything
- Broadcast notifications should be used sparingly to avoid annoying users
- Review moderation protects product page quality

---

## What If Something Goes Wrong?

| Problem                          | What to do                                          |
| -------------------------------- | --------------------------------------------------- |
| Product showing wrong category   | Edit product or category assignment                 |
| Coupon not working for customers | Check expiry, usage limits, and minimum order value |
| Home page section empty          | Add products to the section in Experience Studio    |
| Too many pending reviews         | Process moderation queue regularly                  |

---

_Next → [Admin Users, Sellers, and Riders](18-admin-users-sellers-and-riders.md)_
