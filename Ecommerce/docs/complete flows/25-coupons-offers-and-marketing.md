# Coupons, Offers, and Marketing

## What Is This?

Marketing tools help the business attract customers and increase order values. This document covers coupons, promotional offers, home page content, and shop-by-store features.

---

## Who Uses This?

- **Customers** applying coupons and browsing offers
- **Admins** creating and managing all marketing content

---

## Coupons

### What is a coupon?

A code that customers enter at checkout to get a discount on their order.

### Coupon types

| Type            | Example             |
| --------------- | ------------------- |
| Percentage off  | 20% off your order  |
| Flat amount off | ₹100 off your order |

### Coupon rules (set by admin)

| Rule                 | Description                                  |
| -------------------- | -------------------------------------------- |
| Minimum order value  | Cart must be at least ₹500 to use the coupon |
| Maximum discount cap | 20% off but maximum ₹200 discount            |
| Expiry date          | Coupon works until December 31               |
| Total usage limit    | Can be used 1,000 times across all customers |
| Per-user limit       | Each customer can use it only once           |
| Active/inactive      | Admin can turn coupon on or off anytime      |

### How customers use coupons

1. Customer adds items to cart and goes to checkout
2. Customer types coupon code in the coupon field
3. System validates the code instantly
4. If valid: discount applied to total
5. If invalid: error message (expired, already used, minimum not met, etc.)

### Why server-side validation matters

The discount is calculated on the server — not on the customer's phone. This means:

- Customers cannot fake a discount
- Expired coupons do not work
- Usage limits are enforced accurately
- Minimum order rules are checked against actual cart total

---

## Offers

### Offer banners

Large promotional images displayed on the home page and offers page:

- Festival sales ("Diwali Special — 50% Off")
- Category promotions ("Fresh Fruits Week")
- New shop launches

Each banner can link to a category, product, or offer section.

### Offer sections

Groups of related offers displayed together:

- "Today's Deals"
- "Weekend Specials"
- "New Arrivals on Sale"

Admin creates sections and adds offer banners to them.

---

## Experience Sections (Home Page Content)

The home page is dynamically configured by admin:

### Curated product rows

Admin picks specific products to feature:

- "Breakfast Essentials" — bread, milk, eggs, butter
- "Late Night Cravings" — chips, noodles, ice cream
- "Monsoon Specials" — umbrellas, snacks, tea

### Hero banners

Large rotating banners at the top of the home page. Admin uploads images and sets links.

### Hero categories

Featured category icons highlighted on specific pages.

### Why this matters

The home page is the first thing customers see. Well-curated sections drive discovery and increase order values.

---

## Shop by Store

Customers can browse products organized by shop/seller:

- See all partner shops in their delivery area
- Tap a shop to see all their products
- Useful for customers who prefer a specific local store

Admin configures which shops appear and in what order.

---

## Admin Marketing Tools Summary

| Tool                    | Purpose                            |
| ----------------------- | ---------------------------------- |
| Coupons                 | Discount codes for checkout        |
| Offer banners           | Promotional images                 |
| Offer sections          | Grouped promotions                 |
| Experience sections     | Curated home page product rows     |
| Hero banners            | Large home page banners            |
| Hero categories         | Featured category highlights       |
| Shop by store           | Browse by seller                   |
| Broadcast notifications | Push promotional messages to users |

---

## What Happens Behind the Scenes

- Coupon validation happens at checkout on the server
- Home page sections load from admin configuration — changes appear immediately
- Offer banners can be scheduled with start and end dates
- Usage counters track how many times each coupon has been used

---

## Important Rules

- One coupon per order (typically)
- Coupon discount cannot exceed order total
- Expired coupons are rejected automatically
- Admin can deactivate a coupon instantly
- Promotional content should be updated regularly to stay fresh

---

## What If Something Goes Wrong?

| Problem                 | What happens                                    |
| ----------------------- | ----------------------------------------------- |
| Coupon code not working | Check expiry, usage limits, minimum order value |
| Discount seems wrong    | Server calculates exactly — check coupon rules  |
| Home page section empty | Admin needs to add products to the section      |
| Offer banner outdated   | Admin should update or deactivate old banners   |

---

_Next → [Support Tickets and Reviews](26-support-tickets-and-reviews.md)_
