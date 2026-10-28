# Customer Checkout and Payment

## What Is This?

Checkout is where the customer reviews their order, chooses a delivery address, sees the full price breakdown, applies discounts, selects a payment method, and places the order. This document explains every part of checkout and both payment options — online pay and cash on delivery.

---

## Who Uses This?

**Customers** who are ready to buy the items in their cart.

---

## What Can You Do?

- Select or add a delivery address
- Review all items grouped by shop
- See complete price breakdown
- Apply a coupon code
- Use wallet balance to reduce the total
- Add a tip for the delivery partner
- Choose online payment or cash on delivery
- Preview exact price before placing order
- Place the order

---

## Checkout Page Sections

### 1. Delivery address

Customer picks a saved address or adds a new one. The address determines delivery fee and which shops can fulfill the order.

### 2. Order summary

All cart items listed, grouped by shop if the cart has products from multiple stores. Each group shows item names, quantities, and prices.

### 3. Price breakdown

A clear list of every charge:

| Charge           | Description                                |
| ---------------- | ------------------------------------------ |
| Item total       | Sum of all product prices                  |
| Delivery fee     | Based on distance from shop to customer    |
| Platform fee     | Service charge set by the business         |
| Tax (GST)        | Government tax on applicable items         |
| Tip              | Optional amount for the delivery partner   |
| Coupon discount  | Subtracted if a valid coupon is applied    |
| Wallet deduction | Subtracted if customer uses wallet balance |
| **Grand total**  | Final amount to pay                        |

### 4. Coupon section

Customer enters a coupon code. System checks if it is valid, not expired, and meets minimum order requirements. Discount is applied immediately on success.

### 5. Wallet section

If customer has wallet balance, they can choose to use part or all of it. Wallet amount is deducted before the remaining total goes to payment.

### 6. Payment method selector

Two options:

- **Pay Online** — UPI, card, or other methods through the payment partner
- **Cash on Delivery (COD)** — pay the rider in cash at the doorstep

### 7. Recommended products

Suggestions for items customer might want to add before placing the order.

### 8. Wishlist shortcuts

Quick access to wishlist items customer might want to add.

---

## Pricing Rules

### Delivery fee

Calculated based on the distance between the shop and the customer's delivery address. Longer distance = higher fee. Each shop in a multi-shop order may have its own delivery fee.

### Platform fee and tax

Added as configured by admin. Shown clearly so customer knows exactly what they are paying for.

### Tips

Optional. Customer can add a tip that goes to the delivery partner.

### Coupons

- Must be valid, not expired, and not already used up
- May require a minimum order value
- May have a maximum discount cap
- Validated by the system — customer cannot fake a discount

### Wallet

- Applied before online payment amount
- If wallet covers the full total, no online payment needed
- If wallet covers part, customer pays the remainder online

### Multi-shop orders

One checkout experience, but the system creates separate orders for each shop. Customer pays one combined total.

---

## Step-by-Step: Online Payment Flow

1. Customer reviews cart and address on checkout page
2. Customer applies coupon or wallet if desired
3. Customer selects "Pay Online"
4. Customer taps "Place Order" (or slide-to-pay confirmation)
5. System creates the order in "waiting for payment" status
6. Customer is redirected to the payment partner's page
7. Customer completes payment (UPI, card, etc.)
8. Customer is redirected back to the payment status page
9. System confirms payment was successful
10. Order moves to "waiting for seller to accept"
11. Seller receives new order notification

### What happens behind the scenes

- System reserves stock for ordered items
- If wallet was used, wallet balance is reduced immediately
- Payment partner confirms the transaction
- System records the payment and advances the order
- Seller gets an instant notification with a 60-second accept timer

---

## Step-by-Step: Cash on Delivery Flow

1. Customer reviews cart and address on checkout page
2. Customer applies coupon or wallet if desired
3. Customer selects "Cash on Delivery"
4. Customer taps "Place Order"
5. System creates the order — no online payment step
6. Order goes directly to "waiting for seller to accept"
7. Seller receives new order notification
8. After full delivery, customer pays the rider in cash at the door

### What happens behind the scenes

- Stock is reserved immediately
- No payment partner involved at checkout
- Wallet deduction still applies if customer used wallet for part of the total
- Rider will collect the remaining cash amount at delivery

---

## Checkout Preview

Before placing the order, the customer can request a **price preview** — the system calculates the exact final price including all fees, discounts, and wallet deductions. This ensures no surprises on the payment page.

---

## Important Rules

- Customer must be logged in to complete checkout
- Delivery address must be within the shop's delivery range
- All items must be in stock at time of order
- Coupon can only be used once per order (unless configured otherwise)
- Online payment must complete within a set time or order may be cancelled
- COD orders skip the payment step but are otherwise handled the same

---

## What If Something Goes Wrong?

| Problem                                | What happens                                                              |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Payment fails online                   | Customer sees failure message; can retry payment or order may auto-cancel |
| Payment succeeds but order fails       | System compensates — refund to wallet or original payment method          |
| Item goes out of stock during checkout | Customer notified; must remove item or cancel                             |
| Coupon invalid                         | Error message shown; no discount applied                                  |
| Address outside delivery range         | Checkout blocked with explanation                                         |
| Seller does not accept in time         | Order auto-cancelled; refund processed for online payments                |

---

## Multi-Shop Checkout Example

Customer buys milk from Shop A and bread from Shop B in one checkout:

1. Customer sees one combined checkout page
2. Items are grouped: "Shop A items" and "Shop B items"
3. Delivery fees may apply separately for each shop
4. Customer pays one grand total
5. System creates two separate orders
6. Shop A and Shop B each get their own order notification
7. Each shop is fulfilled and delivered independently
8. Customer tracks both orders separately in their order list

---

_Next → [Customer Orders and Tracking](06-customer-orders-and-tracking.md)_
