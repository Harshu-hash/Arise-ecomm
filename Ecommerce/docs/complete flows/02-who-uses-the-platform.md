# Who Uses the Platform?

## What Is This?

The quick commerce platform serves four different types of users. Each person gets their own app or portal designed for their specific job. This document explains who they are, what they can do, and what restrictions apply.

---

## Overview

| Role             | App they use     | Main goal                                 |
| ---------------- | ---------------- | ----------------------------------------- |
| Customer         | Customer web app | Buy products and get fast delivery        |
| Seller           | Seller portal    | List products, fulfill orders, earn money |
| Delivery partner | Delivery web app | Pick up and deliver orders, earn per trip |
| Admin            | Admin console    | Run and manage the entire platform        |

---

## Customers

### Who are they?

Anyone who wants to order groceries, essentials, or other products for quick delivery to their home or office.

### What can they do?

- Browse products by category, search, or shop
- Add items to cart and wishlist
- Set delivery location and saved addresses
- Apply coupons and use wallet balance at checkout
- Pay online or choose cash on delivery
- Track orders in real time on a live map
- Cancel orders (before certain stages)
- Request returns on delivered orders
- Rate and review products
- Contact support through chat
- Manage profile and notification settings

### What can they NOT do?

- Access seller, delivery, or admin areas
- Change product prices or stock
- Approve their own refunds without going through the return process
- See other customers' orders or data

### How do they log in?

With their **phone number** and a **text message code** — no password needed.

---

## Sellers (Shop Owners)

### Who are they?

Local shop owners or partner stores that sell products through the platform.

### What can they do?

- Sign up and submit their shop for approval
- Add, edit, and manage products
- Manage stock levels
- Receive and accept new orders (with a time limit)
- Mark orders as ready for pickup
- Confirm when a rider picks up an order
- Approve or reject customer return requests
- Track delivery progress for their orders
- View earnings, wallet balance, and transaction history
- Request withdrawals to their bank account
- View sales analytics

### What can they NOT do?

- Fulfill orders until **admin approves** their application
- Assign delivery partners manually (the system does this)
- Change platform fees or delivery charges
- Access other sellers' data
- Process customer payments directly

### Approval requirement

New sellers must complete sign-up, verify their phone and email, and wait for **admin approval** before they can list products and receive orders. Until approved, they see a "pending approval" screen.

### How do they log in?

With **phone number and text message code**, plus **email verification** during sign-up.

---

## Delivery Partners (Riders)

### Who are they?

People who deliver orders on bikes, scooters, or other vehicles. They work as independent partners of the platform.

### What can they do?

- Sign up and submit documents for approval
- Go **online** or **offline** to control when they receive jobs
- See nearby delivery opportunities and accept or skip them
- Navigate to shops and customer addresses
- Confirm pickup and delivery using codes
- Collect cash on delivery from customers
- Submit collected cash to the platform
- View earnings, order history, and wallet balance
- Request bank withdrawals
- Manage profile, vehicle info, bank details, and documents

### What can they NOT do?

- Start delivering until **admin approves** their application
- Receive jobs while offline
- Mark an order delivered without the customer's delivery code
- Keep cash collected from customers without eventually submitting it
- Change delivery fees or order details

### Approval requirement

New riders must upload identity documents, vehicle details, and bank information. Admin reviews and approves or rejects the application.

### How do they log in?

With **phone number and text message code**.

---

## Admins (Platform Operators)

### Who are they?

The business team that owns and operates the platform — managers, operations staff, finance team, and support agents.

### What can they do?

- View dashboard with orders, revenue, and active fleet
- Approve or reject seller and rider applications
- Manage all customers, sellers, and delivery partners
- View and manage every order across the platform
- Handle returns and trigger refunds
- Manage categories, products, offers, coupons, and home page content
- Send broadcast notifications
- Moderate product reviews
- Manage support tickets and reply to customers
- View and process all financial transactions
- Settle cash collected by riders
- Process seller and rider withdrawal requests
- Configure platform settings (fees, timeouts, branding)
- Track all active riders on a live fleet map

### What can they NOT do?

- (By design, admins have the broadest access — restrictions are set by business policy, not the app itself)

### How do they log in?

With **email and password** — different from the phone-based login used by customers, sellers, and riders.

---

## How Roles Stay Separate

Each person only sees their own app area:

- A customer logging in sees the shopping app — not the admin panel
- A seller cannot open the delivery app or change another shop's products
- A rider cannot access seller order management
- An admin can see everything but uses a separate login system

The system checks who you are every time you perform an action, so one role cannot accidentally (or intentionally) do another role's job.

---

## Summary: Who Does What in an Order

| Step                                 | Who is involved                                       |
| ------------------------------------ | ----------------------------------------------------- |
| Customer places order                | Customer                                              |
| Shop receives and accepts order      | Seller                                                |
| System finds a rider                 | System (automatic)                                    |
| Rider picks up from shop             | Delivery partner                                      |
| Rider delivers to customer           | Delivery partner                                      |
| Money is settled                     | System (automatic) + Admin (for withdrawals and cash) |
| Customer requests return (if needed) | Customer → Seller → Rider → Admin                     |

---

_Next → [How the System Is Built](03-how-the-system-is-built.md)_
