# How the System Is Built

## What Is This?

This document explains how the quick commerce platform is put together — in plain language, without technical details. Think of it as a map of how all the pieces connect so that a customer order in one part of the city reaches the right shop and the right rider at the right time.

---

## The Big Picture

The platform has three main layers:

1. **Web apps** — what people see and use on their phones or computers
2. **Central system** — the brain that handles orders, payments, and notifications
3. **Outside services** — payment partners, maps, text messages, and live location tracking

```
People (customers, sellers, riders, admins)
        ↓
   Four web apps
        ↓
   Central system (main server + background workers)
        ↓
   Database + task scheduler + outside services
```

---

## The Four Web Apps

All four apps are part of one website but show different screens depending on who logs in:

| App           | Best used on            | Purpose                   |
| ------------- | ----------------------- | ------------------------- |
| Customer app  | Phone or computer       | Shopping and ordering     |
| Seller portal | Computer or tablet      | Shop management           |
| Delivery app  | Phone (mobile-friendly) | Deliveries and navigation |
| Admin console | Computer                | Business operations       |

Customers use the main home page. Sellers, riders, and admins each have their own section of the website.

---

## The Central System

### Main server

This is the brain of the platform. Every action — placing an order, accepting a delivery, updating stock — goes through the main server. It:

- Receives requests from all four apps
- Checks who is making the request and whether they are allowed
- Saves and reads order, user, and product information
- Sends instant updates to the right people
- Triggers payments and money movements
- Starts background tasks when needed

### Database

A secure storage system that keeps records of:

- All users (customers, sellers, riders, admins)
- All products and categories
- All orders and their current status
- All money movements (wallets, payments, payouts)
- Support tickets, reviews, coupons, and settings

Nothing is lost — every order and every payment is recorded.

### Background workers

Some tasks should not slow down the customer experience. These run separately in the background:

- Sending push notifications to phones
- Running timers (seller must accept in 60 seconds, find a rider in 60 seconds)
- Processing withdrawal batches
- Cleaning up old live location data
- Verifying that money records are correct

### Task scheduler

A clock that runs regular checks:

- Are there stuck orders that should have been cancelled?
- Has the return window ended so seller money can be released?
- Are there pending payouts to process?

---

## Outside Services

The platform connects to several external services:

| Service                   | What it does                                            |
| ------------------------- | ------------------------------------------------------- |
| Payment partner           | Handles online payments (UPI, cards, wallets)           |
| Maps service              | Turns addresses into map locations and shows routes     |
| Text message service      | Sends login codes and delivery codes to phones          |
| Push notification service | Sends alerts to phones even when the app is closed      |
| Live location service     | Shows where the rider is moving on the map in real time |
| Image storage service     | Stores product photos and document uploads              |

---

## How Information Flows in Real Time

When something important happens, everyone who needs to know finds out instantly — without refreshing the page.

**Example: Customer places an order**

1. Customer taps "Place Order" in the customer app
2. Main server saves the order and calculates the price
3. Main server instantly notifies the seller's app — a popup appears with the new order
4. Main server starts a 60-second timer — if seller does not accept, order auto-cancels
5. Customer sees "Order Placed" on their screen

**Example: Rider is on the way**

1. Rider's phone sends location updates while delivering
2. Live location service stores the rider's position
3. Customer's order tracking page shows the rider moving on the map — automatically updated
4. Seller can also see the rider's progress on their tracking screen

---

## How the System Handles Multiple Shops in One Order

Sometimes a customer buys items from two different shops in one checkout. The system handles this smoothly:

- Customer sees **one checkout** and pays **one total amount**
- Behind the scenes, the system creates **separate orders** — one per shop
- Each shop only sees and manages their own part
- Each part may get a different delivery partner
- Refunds and returns are handled per shop order

This is called a **multi-shop checkout** — convenient for the customer, organized for the shops.

---

## How the System Stays Reliable

### Separate processes in production

In a live business, the platform runs as three separate services:

| Service           | Job                                |
| ----------------- | ---------------------------------- |
| Main server       | Handles all user requests          |
| Background worker | Processes heavy and queued tasks   |
| Scheduler         | Runs timed checks and regular jobs |

If the worker is busy sending notifications, the main server still accepts new orders without slowing down.

### Health checks

The system can report whether it is running properly — useful for monitoring and fixing problems quickly.

### Automatic safety nets

If a timer fails or a notification is missed, backup scheduled checks catch stuck orders and fix them.

---

## What You Need to Run This Platform

To operate the system in production, a business needs:

- A **cloud server** to run the main system
- A **database** to store all records
- A **cache/task service** for background jobs and speed
- Accounts with a **payment partner**, **maps provider**, **text message provider**, and **image storage**
- A **web hosting** service for the customer-facing website
- A **live location service** for delivery tracking

Details on setting this up are in [Deployment and Running](30-deployment-and-running.md).

---

## Summary

| Component         | Plain-language description             |
| ----------------- | -------------------------------------- |
| Customer app      | Where people shop                      |
| Seller portal     | Where shops manage products and orders |
| Delivery app      | Where riders get and complete jobs     |
| Admin console     | Where operators run the business       |
| Main server       | The brain — handles every action       |
| Database          | Stores all records permanently         |
| Background worker | Handles notifications and heavy tasks  |
| Scheduler         | Runs timed checks automatically        |
| Payment partner   | Processes online payments              |
| Live location     | Powers the delivery map                |
| Text messages     | Sends login and delivery codes         |

---

_Next → [Customer Shopping](04-customer-shopping.md) — or read the full order story in [Complete Order Lifecycle](21-order-lifecycle-complete.md)_
