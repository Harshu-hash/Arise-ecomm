# Settings and Platform Configuration

## What Is This?

The platform has many configurable settings that control how the business operates — fees, timeouts, branding, delivery rules, and more. This document explains what can be configured and how those settings affect the day-to-day experience.

---

## Who Uses This?

**Platform administrators** configuring how the business runs.

---

## What Can Be Configured?

### Platform settings

- **App name and branding** — what customers see as the business name
- **Logo and colors** — visual identity
- **Contact information** — support phone, email
- **Social media links** — if displayed in the app
- **Legal pages** — terms of service, privacy policy content

### Delivery settings

- **Delivery fee rules** — base fee, per-kilometer charge, maximum cap
- **Free delivery threshold** — orders above a certain amount get free delivery
- **Delivery radius** — how far from a shop customers can order
- **Initial rider search radius** — how far to look for riders first
- **Radius expansion** — how much to widen search if no rider found

### Timeout settings

- **Seller accept timeout** — how long seller has to accept (default ~60 seconds)
- **Rider search timeout** — how long to search for a rider (default ~60 seconds)
- **Return pickup timeout** — how long to find a rider for return pickup
- **Payment timeout** — how long customer has to complete online payment
- **Checkout transaction timeout** — maximum time for checkout to complete

### Return settings

- **Return window** — how long after delivery customers can request a return (e.g., 30 minutes, 2 hours)
- **Return policy** — what can and cannot be returned

### Financial settings

- **Platform commission rate** — percentage taken from seller earnings
- **Platform fee** — service charge on each order
- **Tax/GST rate** — tax applied to orders
- **Minimum order value** — smallest order amount accepted
- **Minimum withdrawal amount** — smallest amount sellers/riders can withdraw

---

## How Settings Affect Users

| Setting              | Who it affects   | Effect                                |
| -------------------- | ---------------- | ------------------------------------- |
| Delivery fee rules   | Customer         | How much delivery costs               |
| Seller timeout       | Seller, customer | How fast seller must accept           |
| Rider search timeout | Rider, customer  | How long to find a rider              |
| Return window        | Customer         | How long they can request returns     |
| Commission rate      | Seller           | How much seller earns per order       |
| Platform fee         | Customer         | Service charge on checkout            |
| Delivery radius      | Customer         | Which shops they can order from       |
| Branding             | Everyone         | What the app looks like and is called |

---

## Delivery Configuration Details

### Fee calculation

Delivery fee is typically based on:

- Distance from shop to customer address
- Base fee (flat amount for any delivery)
- Per-kilometer charge (increases with distance)
- Maximum cap (fee cannot exceed this amount)

### Free delivery

If configured, orders above a certain value (e.g., ₹500) have zero delivery fee. Encourages larger orders.

### Search radius

When looking for a rider:

1. First search within initial radius (e.g., 5 km)
2. If no rider found, expand radius (e.g., 7.5 km)
3. Retry up to maximum attempts (e.g., 3 times)
4. If still no rider, order may be cancelled

---

## What Admins Need to Set Up

Before launching the platform, admin must configure:

| Item                         | Why it is needed              |
| ---------------------------- | ----------------------------- |
| Business name and branding   | Customer-facing identity      |
| Delivery fees and radius     | Pricing and coverage          |
| Commission rate              | Seller earnings calculation   |
| Payment partner account      | Online payments               |
| Maps service account         | Address lookup and navigation |
| Text message service account | Login and delivery codes      |
| Image storage account        | Product photos and documents  |
| Push notification service    | Phone alerts                  |
| Live location service        | Delivery tracking             |
| Timeout values               | Order automation              |
| Return window                | Customer return policy        |

---

## What Happens Behind the Scenes

- Settings are stored centrally and read by all parts of the system
- Changes take effect immediately for new orders
- Existing orders use the settings that were active when they were placed
- Some settings (like fees) are snapshotted at checkout — changing them later does not affect orders already placed

---

## Important Rules

- Test settings changes carefully — they affect all users immediately
- Fee changes only affect future orders
- Timeout changes affect new orders only
- Branding changes appear immediately in all apps
- Keep legal pages (terms, privacy) up to date

---

## What If Something Goes Wrong?

| Problem                              | What to do                            |
| ------------------------------------ | ------------------------------------- |
| Delivery fees too high/low           | Adjust fee rules in delivery settings |
| Too many auto-cancellations          | Increase seller or rider timeout      |
| Returns allowed too long/short       | Adjust return window                  |
| Sellers complaining about commission | Review and adjust commission rate     |
| Customers outside delivery range     | Expand radius or add more shops       |

---

_Next → [Background Jobs and Automation](28-background-jobs-and-automation.md)_
