# Notifications and Alerts

## What Is This?

The platform keeps everyone informed through notifications — order updates, new job offers, support replies, and promotional messages. This document explains every type of notification, who receives them, and how they are delivered.

---

## Who Should Read This?

Anyone who wants to understand how the platform communicates with users in real time.

---

## Types of Notifications

### 1. In-app notifications

Messages that appear inside the app — usually behind a bell icon. User opens the app and sees a list of notifications.

### 2. Push notifications

Alerts that appear on the user's phone even when the app is closed. Requires the user to allow notifications on their device.

### 3. Real-time popups

Instant on-screen alerts that appear without the user doing anything:

- Seller: new order popup with accept button
- Rider: new delivery job offer
- Customer: delivery code display

### 4. Text message codes

Short codes sent via SMS for:

- Login verification
- Delivery confirmation codes

---

## Who Gets What

| Event                           | Customer | Seller | Rider             | Admin    |
| ------------------------------- | -------- | ------ | ----------------- | -------- |
| Order placed                    | Yes      | Yes    | —                 | Optional |
| Payment confirmed               | Yes      | —      | —                 | —        |
| Seller accepted order           | Yes      | —      | —                 | —        |
| Seller did not accept (timeout) | Yes      | —      | —                 | —        |
| Rider assigned                  | Yes      | Yes    | —                 | —        |
| Order ready for pickup          | —        | —      | Yes (job offer)   | —        |
| Out for delivery                | Yes      | —      | —                 | —        |
| Delivered                       | Yes      | Yes    | Yes               | —        |
| Order cancelled                 | Yes      | Yes    | Yes (if assigned) | —        |
| Return requested                | —        | Yes    | —                 | —        |
| Return pickup assigned          | —        | —      | Yes               | —        |
| Refund processed                | Yes      | —      | —                 | —        |
| New delivery job broadcast      | —        | —      | Yes               | —        |
| Support reply                   | Yes      | —      | —                 | Yes      |
| Withdrawal processed            | —        | Yes    | Yes               | —        |
| Broadcast announcement          | Yes      | Yes    | Yes               | —        |

---

## Customer Notifications

### Order updates

Customers receive notifications at every major order stage:

- "Your order has been placed"
- "Shop is preparing your order"
- "Delivery partner is on the way"
- "Your order has been delivered"

### Delivery code

When the rider is near, customer receives the delivery code — either as an in-app display or push notification.

### Promotional

Marketing messages about offers, coupons, and deals (if customer has not opted out).

### Support

When admin replies to a support ticket.

---

## Seller Notifications

### New order alert

The most critical notification — a popup with sound when a customer places an order. Shows:

- Order items and quantities
- Customer address
- Payment type
- Accept button with countdown timer

### Order status updates

- Rider assigned to pick up
- Order delivered
- Return requested by customer

### Financial

- Withdrawal request processed
- Earnings summary (if configured)

---

## Rider Notifications

### New job offer

When a shop marks an order ready, nearby online riders receive a broadcast:

- Shop name and location
- Delivery address and distance
- Estimated earnings
- Accept or skip buttons

### Active delivery updates

- Navigation prompts
- Delivery code ready for customer

### Financial

- Earnings credited after delivery
- Withdrawal processed
- Reminder to submit COD cash

---

## Admin Notifications

### Support

- New support ticket created
- Customer replied to a ticket

### Operations

- Unusual order activity (if configured)
- Pending approvals count

---

## Notification Preferences

Customers can control their notification settings:

- Enable or disable push notifications
- Choose which types of alerts to receive
- Promotional messages can be opted out

Sellers and riders typically receive all operational notifications (cannot disable new order alerts).

---

## How Notifications Are Delivered

### Instant (real-time)

Order status changes, new order popups, and support messages are delivered instantly using live connection technology. No delay, no refresh needed.

### Queued (push)

Phone push notifications go through a queue to ensure reliable delivery even during high traffic. If the first attempt fails, the system retries.

### Text messages

Login codes and delivery codes are sent via SMS service. These are separate from in-app and push notifications.

---

## What Happens Behind the Scenes

- When an event occurs (order placed, rider assigned, etc.), the system determines who needs to be notified
- In-app and real-time notifications are sent immediately
- Push notifications are queued and sent via the phone notification service
- Text messages are sent via the SMS service
- Each notification is logged for debugging

---

## Important Rules

- Sellers must receive new order alerts — cannot be disabled
- Riders must receive job offers when online — cannot be disabled
- Push notifications require user permission on their device
- Text message codes expire after a few minutes
- Promotional notifications should respect user preferences

---

_Next → [Live Tracking and Maps](24-live-tracking-and-maps.md)_
