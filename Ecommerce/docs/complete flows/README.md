# Quick Commerce Platform — Documentation

Welcome! This is the complete guide to understanding how a quick commerce delivery platform works — from shopping and checkout to delivery, payments, and day-to-day business operations.

These documents are written in **simple, everyday language**. No technical background is needed. Whether you are a business owner, product manager, or someone who wants to build a similar system, this guide explains **what the platform does** and **how every part fits together**.

---

## What Is This Platform?

This is a **quick commerce** system — like ordering groceries or daily essentials from nearby shops and getting them delivered to your door in minutes. It connects four groups of people:

- **Customers** who shop and place orders
- **Sellers** (local shops) who prepare orders
- **Delivery partners** (riders) who pick up and deliver
- **Admins** who run and manage the whole business

Everything runs through one connected system with four different web apps — one for each group.

---

## Who Should Read This?

- Someone planning to build a quick commerce business
- New team members joining the project
- Business analysts who need to understand every feature and flow
- Product owners who want a full picture of what the system can do

---

## How to Read These Docs

You can read in order (recommended for first-time readers) or jump to any topic using the map below.

### Recommended reading order

1. Start with the big picture → [What Is Quick Commerce?](01-what-is-quick-commerce.md)
2. Learn who uses the system → [Who Uses the Platform?](02-who-uses-the-platform.md)
3. Understand how it is built → [How the System Is Built](03-how-the-system-is-built.md)
4. Follow the full order journey → [Complete Order Lifecycle](21-order-lifecycle-complete.md)
5. Then explore each area in detail (customer, seller, delivery, admin)

---

## Quick Topic Finder

| I want to understand…                           | Read this                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| What quick commerce is and how it makes money   | [01 — What Is Quick Commerce?](01-what-is-quick-commerce.md)                |
| Customer, seller, rider, and admin roles        | [02 — Who Uses the Platform?](02-who-uses-the-platform.md)                  |
| How all the parts connect                       | [03 — How the System Is Built](03-how-the-system-is-built.md)               |
| Browsing products, cart, wishlist               | [04 — Customer Shopping](04-customer-shopping.md)                           |
| Checkout, coupons, online pay, cash on delivery | [05 — Checkout and Payment](05-customer-checkout-and-payment.md)            |
| Order tracking and live map                     | [06 — Orders and Tracking](06-customer-orders-and-tracking.md)              |
| Wallet, refunds, returns                        | [07 — Wallet and Refunds](07-customer-wallet-and-refunds.md)                |
| Login, profile, support, reviews                | [08 — Account and Support](08-customer-account-and-support.md)              |
| Seller sign-up and shop setup                   | [09 — Seller Onboarding](09-seller-onboarding-and-store.md)                 |
| Products and stock                              | [10 — Products and Inventory](10-seller-products-and-inventory.md)          |
| Seller order handling                           | [11 — Seller Orders](11-seller-orders-and-fulfillment.md)                   |
| Seller earnings and withdrawals                 | [12 — Seller Earnings](12-seller-earnings-and-withdrawals.md)               |
| Rider sign-up and going online                  | [13 — Delivery Partner Onboarding](13-delivery-partner-onboarding.md)       |
| Pickup, delivery, and return trips              | [14 — Delivery Daily Workflow](14-delivery-partner-daily-workflow.md)       |
| Rider earnings and cash collection              | [15 — Delivery Earnings and Cash](15-delivery-partner-earnings-and-cash.md) |
| Admin dashboard and operations                  | [16 — Admin Dashboard](16-admin-dashboard-and-operations.md)                |
| Categories, offers, coupons, content            | [17 — Admin Catalog and Content](17-admin-catalog-and-content.md)           |
| Managing customers, sellers, riders             | [18 — Admin Users](18-admin-users-sellers-and-riders.md)                    |
| Admin order and return management               | [19 — Admin Orders and Returns](19-admin-orders-and-returns.md)             |
| Platform money, payouts, cash hub               | [20 — Admin Finance](20-admin-finance-and-wallets.md)                       |
| Full order story from click to delivery         | [21 — Order Lifecycle](21-order-lifecycle-complete.md)                      |
| How payments work                               | [22 — Payments Explained](22-payments-explained.md)                         |
| Notifications and alerts                        | [23 — Notifications](23-notifications-and-alerts.md)                        |
| Live tracking and maps                          | [24 — Live Tracking](24-live-tracking-and-maps.md)                          |
| Coupons, offers, marketing                      | [25 — Coupons and Marketing](25-coupons-offers-and-marketing.md)            |
| Support tickets and reviews                     | [26 — Support and Reviews](26-support-tickets-and-reviews.md)               |
| Platform settings and configuration             | [27 — Settings](27-settings-and-platform-config.md)                         |
| Automatic background tasks                      | [28 — Background Automation](28-background-jobs-and-automation.md)          |
| Login, security, and safety                     | [29 — Security and Login](29-security-and-login.md)                         |
| Running the platform                            | [30 — Deployment and Running](30-deployment-and-running.md)                 |
| Terms and definitions                           | [31 — Glossary](31-glossary.md)                                             |

---

## The Four Web Apps

| App           | Who uses it        | What it is for                               |
| ------------- | ------------------ | -------------------------------------------- |
| Customer app  | Shoppers           | Browse, order, pay, track delivery           |
| Seller portal | Shop owners        | Manage products, accept orders, earn money   |
| Delivery app  | Riders             | Accept jobs, navigate, deliver, collect cash |
| Admin console | Business operators | Run the platform, manage users, handle money |

All four apps connect to the same central system. A customer places an order, the seller sees it instantly, a nearby rider gets notified, and the admin can watch everything from their dashboard.

---

## Document List

| #   | Document                                                                       |
| --- | ------------------------------------------------------------------------------ |
| 01  | [What Is Quick Commerce?](01-what-is-quick-commerce.md)                        |
| 02  | [Who Uses the Platform?](02-who-uses-the-platform.md)                          |
| 03  | [How the System Is Built](03-how-the-system-is-built.md)                       |
| 04  | [Customer Shopping](04-customer-shopping.md)                                   |
| 05  | [Customer Checkout and Payment](05-customer-checkout-and-payment.md)           |
| 06  | [Customer Orders and Tracking](06-customer-orders-and-tracking.md)             |
| 07  | [Customer Wallet and Refunds](07-customer-wallet-and-refunds.md)               |
| 08  | [Customer Account and Support](08-customer-account-and-support.md)             |
| 09  | [Seller Onboarding and Store](09-seller-onboarding-and-store.md)               |
| 10  | [Seller Products and Inventory](10-seller-products-and-inventory.md)           |
| 11  | [Seller Orders and Fulfillment](11-seller-orders-and-fulfillment.md)           |
| 12  | [Seller Earnings and Withdrawals](12-seller-earnings-and-withdrawals.md)       |
| 13  | [Delivery Partner Onboarding](13-delivery-partner-onboarding.md)               |
| 14  | [Delivery Partner Daily Workflow](14-delivery-partner-daily-workflow.md)       |
| 15  | [Delivery Partner Earnings and Cash](15-delivery-partner-earnings-and-cash.md) |
| 16  | [Admin Dashboard and Operations](16-admin-dashboard-and-operations.md)         |
| 17  | [Admin Catalog and Content](17-admin-catalog-and-content.md)                   |
| 18  | [Admin Users, Sellers, and Riders](18-admin-users-sellers-and-riders.md)       |
| 19  | [Admin Orders and Returns](19-admin-orders-and-returns.md)                     |
| 20  | [Admin Finance and Wallets](20-admin-finance-and-wallets.md)                   |
| 21  | [Complete Order Lifecycle](21-order-lifecycle-complete.md)                     |
| 22  | [Payments Explained](22-payments-explained.md)                                 |
| 23  | [Notifications and Alerts](23-notifications-and-alerts.md)                     |
| 24  | [Live Tracking and Maps](24-live-tracking-and-maps.md)                         |
| 25  | [Coupons, Offers, and Marketing](25-coupons-offers-and-marketing.md)           |
| 26  | [Support Tickets and Reviews](26-support-tickets-and-reviews.md)               |
| 27  | [Settings and Platform Config](27-settings-and-platform-config.md)             |
| 28  | [Background Jobs and Automation](28-background-jobs-and-automation.md)         |
| 29  | [Security and Login](29-security-and-login.md)                                 |
| 30  | [Deployment and Running](30-deployment-and-running.md)                         |
| 31  | [Glossary](31-glossary.md)                                                     |

---

_Start here → [What Is Quick Commerce?](01-what-is-quick-commerce.md)_
