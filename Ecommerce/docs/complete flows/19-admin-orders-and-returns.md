# Admin Orders and Returns

## What Is This?

Admins have full visibility into every order on the platform and manage the return process when customers send items back. This document covers order management, return handling, and billing configuration.

---

## Who Uses This?

**Platform administrators** managing orders and returns.

---

## What Can You Do?

- View and search all orders across the platform
- See detailed workflow stage for any order
- Manage return requests end-to-end
- Assign return delivery partners
- Configure billing charges and fees

---

## Order Management

### Viewing all orders

Admin sees every order from every customer and seller:

- Filter by status (pending, confirmed, out for delivery, delivered, cancelled, returned)
- Search by order number, customer name, or seller
- Sort by date, amount, or status

### Order detail view

For any order, admin can see:

| Information      | Details                                    |
| ---------------- | ------------------------------------------ |
| Order number     | Unique identifier                          |
| Customer         | Name, phone, address                       |
| Seller           | Shop name, location                        |
| Delivery partner | Rider name (when assigned)                 |
| Items            | Products, quantities, prices               |
| Pricing          | Full breakdown of all charges              |
| Payment          | Method, status, transaction reference      |
| Workflow stage   | Exact current step in the delivery process |
| Timeline         | History of all status changes              |

### Manual interventions

In rare cases, admin may need to:

- Cancel a stuck order that automation missed
- Force-advance an order status
- Reassign a delivery to a different rider
- Trigger a manual refund

These should be used carefully and only when automation fails.

---

## Returns Management

### Returns list

All return requests across the platform:

- Order number, customer, seller
- Items being returned
- Return reason
- Current status (requested, approved, rejected, in pickup, completed)

### Return process (admin role)

1. **Customer requests return** — appears in returns list
2. **Seller approves or rejects** — admin can see the decision
3. **Quality check** — admin may inspect the return request
4. **Assign return rider** — if seller approved, system assigns a delivery partner for pickup
5. **Track pickup** — rider goes to customer, verifies pickup code
6. **Track drop** — rider delivers item back to shop, verifies drop code
7. **Process refund** — admin confirms return complete; system credits customer

### Admin actions on returns

- View return details and photos
- Override seller decision if needed (policy violation)
- Manually assign a return pickup rider
- Confirm return completion
- Trigger or verify refund

---

## Billing Charges Configuration

Admin configures the fees that appear on customer checkout:

### Platform fee

- Service charge added to every order
- Can be flat amount or percentage

### Delivery fee rules

- Base delivery fee
- Per-kilometer charge
- Maximum delivery fee cap
- Free delivery threshold (e.g., free above ₹500)

### Tax settings

- GST rate or tax configuration
- Which items are taxable

### Other charges

- Packaging fee
- Surge pricing during peak hours (if configured)
- Minimum order value

Changes to billing settings affect all future orders immediately.

---

## What Happens Behind the Scenes

- Order data is the central record — all apps read from the same source
- Return process involves multiple parties — admin oversees the full chain
- Refund triggers automatically when return is confirmed complete
- Billing settings are applied during checkout price calculation

---

## Important Rules

- Admin sees all orders — customer privacy must be respected
- Manual interventions should be logged and rare
- Return refunds should match what the customer actually paid
- Billing changes only affect future orders, not past ones
- Return pickup follows the same rider assignment logic as regular deliveries

---

## What If Something Goes Wrong?

| Problem                            | What to do                                         |
| ---------------------------------- | -------------------------------------------------- |
| Order stuck in one status          | Check timers; manual advance or cancel             |
| Return stuck at pickup             | Assign or reassign return rider                    |
| Refund not processed               | Verify return is marked complete; trigger manually |
| Wrong billing on order             | Check billing settings; issue manual adjustment    |
| Customer disputes return rejection | Review evidence; override if warranted             |

---

_Next → [Admin Finance and Wallets](20-admin-finance-and-wallets.md)_
