# Live Tracking and Maps

## What Is This?

One of the most important features of quick commerce is knowing where your delivery is. This document explains how live tracking works for customers, riders, sellers, and admins — and how addresses are turned into map locations.

---

## Who Uses This?

- **Customers** tracking their delivery on a live map
- **Riders** navigating to shops and customer addresses
- **Sellers** watching their order's delivery progress
- **Admins** monitoring the entire fleet

---

## Customer Live Tracking

### What the customer sees

When a rider is delivering their order, the order detail page shows a **live map** with:

- **Rider's current position** — a moving marker that updates automatically
- **Route line** — the path from shop to customer's address
- **Shop location** — where the order was picked up
- **Customer's address** — delivery destination

### How it works

1. Rider starts delivering after pickup
2. Rider's phone sends location updates every few seconds
3. Live location service stores the rider's position
4. Customer's map updates automatically — no refresh needed
5. Tracking ends when delivery is confirmed

### What the customer does NOT need to do

- Refresh the page
- Keep the app open (push notifications still work)
- Share their own location (only rider's location is tracked)

---

## Rider Navigation

### In-app navigation

The delivery app includes built-in navigation:

1. Rider accepts a job
2. Rider taps "Navigate to Shop"
3. Map shows route with turn-by-turn directions
4. After pickup, rider taps "Navigate to Customer"
5. Map shows route to delivery address

### How routes are calculated

The maps service calculates the best route based on:

- Current rider location
- Destination (shop or customer address)
- Road network and traffic (if available)

---

## Seller Tracking

Sellers can track the rider delivering their orders:

- Open the order in seller portal
- See rider's current position on a map
- Know when the order is delivered

Useful for shops that want to confirm delivery without calling the rider.

---

## Admin Fleet Tracking

The admin console shows a **fleet map** with all online delivery partners:

- Each rider shown as a point on the map
- Color or icon indicates status (available, on delivery, offline)
- Click a rider to see their name and current job
- Useful for operations monitoring and troubleshooting

### Use cases

- "Why is no rider accepting orders in this area?" — check if any riders are online nearby
- "Customer says rider is not moving" — check rider's live position
- "How many riders are active right now?" — fleet overview

---

## Address and Location

### How addresses become map pins

When a customer enters a delivery address:

1. Address text is sent to the maps service
2. Maps service converts it to exact coordinates (latitude and longitude)
3. Coordinates are used for delivery fee calculation, rider matching, and navigation

### Saved addresses

Previously used addresses are saved with their coordinates — no need to geocode again.

### Location-based shopping

Customer's delivery location determines:

- Which shops are within delivery range
- Which products are available
- How much the delivery fee will be

---

## Location Trail

During a delivery, the system records the rider's path (trail):

- Shows the actual route taken
- Useful if a customer disputes delivery timing
- Cleaned up after delivery is complete (privacy)

---

## What Happens to Location Data

| When                     | What happens                                |
| ------------------------ | ------------------------------------------- |
| During active delivery   | Location updated every few seconds          |
| After delivery confirmed | Tracking stops; trail saved briefly         |
| Rider goes offline       | Location sharing stops                      |
| After cleanup period     | Old location data removed from live service |

Location data is used only for delivery purposes — not for advertising or unrelated tracking.

---

## Important Rules

- Only active deliveries trigger location sharing
- Rider must have location permissions enabled on their phone
- Customer tracking only works when a rider is assigned and delivering
- Fleet map only shows online riders
- Location data is cleaned up regularly for privacy

---

## What If Something Goes Wrong?

| Problem                            | What happens                                      |
| ---------------------------------- | ------------------------------------------------- |
| Map not updating for customer      | Rider may have lost GPS signal; usually resolves  |
| Wrong delivery address pin         | Customer should update address; re-geocode        |
| Rider navigation shows wrong route | Rider can use external maps app as backup         |
| Fleet map empty                    | No riders online in the area                      |
| Tracking continues after delivery  | System auto-stops; cleanup job removes stale data |

---

_Next → [Coupons, Offers, and Marketing](25-coupons-offers-and-marketing.md)_
