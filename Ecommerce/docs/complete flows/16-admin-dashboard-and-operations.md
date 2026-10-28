# Admin Dashboard and Operations

## What Is This?

The admin console is the control center for running the entire quick commerce business. This document covers the admin dashboard, order operations, fleet tracking, and support management.

---

## Who Uses This?

**Platform administrators** — business owners, operations managers, and support staff.

---

## What Can You Do?

- View business dashboard with key metrics
- Monitor and manage all orders
- Track active delivery fleet on a map
- Handle customer support tickets
- Approve pending sellers and riders
- Access all management sections

---

## Admin Login

Admins log in differently from other users:

- **Email and password** (not phone + text code)
- First admin account created with a special setup key
- Additional admins created by existing admins

---

## Dashboard

The admin home page shows the business at a glance:

### Key metrics

- Total orders (today, this week, this month)
- Total revenue
- Active delivery partners online right now
- Active sellers
- Pending approvals (sellers and riders waiting)
- Recent orders

### Charts

- Revenue trends over time
- Order volume trends
- Other business KPIs

### Quick links

- Jump to pending seller applications
- Jump to pending rider applications
- Jump to recent orders
- Jump to open support tickets

---

## Order Operations

### Order list

View all orders across the platform, organized by status tabs:

| Tab              | Shows                         |
| ---------------- | ----------------------------- |
| All              | Every order                   |
| Pending          | Waiting for seller acceptance |
| Processed        | Accepted and being prepared   |
| Out for delivery | Rider delivering              |
| Delivered        | Completed                     |
| Cancelled        | Cancelled orders              |
| Returned         | Return completed              |

### Order detail

Click any order to see:

- Full order information (items, prices, customer, seller, rider)
- Current workflow stage
- Payment status and method
- Timeline of status changes
- Option for manual intervention if needed

### Manual interventions

In exceptional cases, admin may:

- Cancel a stuck order
- Reassign a delivery
- Trigger a refund
- Contact seller, rider, or customer

---

## Fleet Tracking

A live map showing all currently online delivery partners:

- Each rider shown as a point on the map
- Rider name and status visible on click
- See which riders are on active deliveries vs available
- Useful for operations monitoring and troubleshooting

---

## Support Tickets

### Support inbox

- All customer support tickets in one list
- Unread count badge for new messages
- Filter by status (open, resolved)

### Handling tickets

1. Admin opens a ticket
2. Admin reads customer's issue
3. Admin replies with help or resolution
4. Customer sees reply instantly
5. Admin marks ticket resolved when done

### Real-time chat

Support works like a chat — messages appear instantly for both customer and admin without refreshing.

---

## Admin Profile

Admins can manage their own profile:

- Name and email
- Change password
- Profile settings

---

## What Happens Behind the Scenes

- Dashboard metrics are calculated from live order and user data
- Fleet map pulls real-time rider locations from the live location service
- Support messages are delivered instantly via real-time updates
- Order list refreshes with latest statuses

---

## Important Rules

- Admin has the broadest access — use carefully
- Manual order interventions should be rare and documented
- Support responses represent the business — be professional
- Fleet tracking is for operations, not surveillance

---

## What If Something Goes Wrong?

| Problem                       | What to do                                               |
| ----------------------------- | -------------------------------------------------------- |
| Stuck order (not progressing) | Check workflow stage; manual cancel or advance if needed |
| No riders available in area   | Check fleet map; contact riders to go online             |
| Customer complaint            | Handle via support ticket                                |
| Seller not accepting orders   | Contact seller; check if shop is operational             |
| Payment dispute               | Check payment records; process refund if warranted       |

---

_Next → [Admin Catalog and Content](17-admin-catalog-and-content.md)_
