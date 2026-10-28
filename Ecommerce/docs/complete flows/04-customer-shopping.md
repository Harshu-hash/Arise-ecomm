# Customer Shopping

## What Is This?

The customer shopping experience is everything a shopper does before checkout — browsing the home page, exploring categories, searching for products, adding items to cart and wishlist, and setting their delivery location. This document explains every shopping feature and how customers use them.

---

## Who Uses This?

**Customers** — anyone visiting the customer app to find and select products.

---

## What Can You Do?

- Browse the home page with banners, categories, and curated sections
- Explore products by category (three levels deep)
- Search for products by name
- View detailed product information
- Add products to cart or wishlist
- Set and change delivery location
- Browse offers and shop-by-store pages
- Shop as a guest (cart saved on device) or logged-in user (cart synced to account)

---

## Home Page

When a customer opens the app, they see a rich home page designed to help discovery:

### Hero banners

Large promotional images at the top — configured by admin. May link to specific categories, offers, or products.

### Featured categories

Quick-access icons for popular categories like fruits, dairy, snacks, beverages, etc.

### Experience sections

Curated rows of products chosen by admin — for example "Breakfast Essentials", "Late Night Cravings", or "Monsoon Specials". These change based on what the business wants to promote.

### Shop by store

Lets customers browse products grouped by seller/shop — useful when they prefer a specific local store.

### Offers entry point

A link to the dedicated offers page with all current deals.

---

## Categories

Products are organized in a **three-level category tree**:

1. **Header category** — top level (e.g., "Grocery", "Personal Care")
2. **Level 2 category** — mid level (e.g., "Dairy", "Snacks")
3. **Subcategory** — specific (e.g., "Milk", "Chips")

### How customers browse categories

1. Customer taps a category on the home page or categories page
2. They see subcategories or products in that category
3. They can filter and scroll through available products
4. Products show price, discount, stock status, and seller info

---

## Product Search

Customers can search for any product by typing in the search bar.

### How search works

1. Customer types a product name (e.g., "Amul milk")
2. System shows matching products from nearby sellers
3. Customer taps a result to see full product details
4. Customer adds to cart directly from search results or detail page

Search results respect the customer's delivery location — only products from reachable shops appear.

---

## Product Detail Page

When a customer opens a product, they see:

- Product images (multiple photos if available)
- Product name and description
- Selling price and MRP (original price)
- Discount percentage if on sale
- Unit (e.g., 500ml, 1kg, pack of 6)
- Which shop is selling it
- Whether it is in stock
- Customer reviews and ratings
- Add to cart button
- Add to wishlist button

### Quick view (bottom sheet)

On some screens, tapping a product opens a quick preview panel at the bottom without leaving the current page. Customer can add to cart and close — fast for browsing.

### Add to cart animation

When a customer adds an item, a small animation confirms the action and shows the cart count updating.

---

## Cart

The cart holds all items the customer wants to buy.

### Guest cart

- If not logged in, cart items are saved on the customer's device
- Items remain even if they close the browser
- When they log in, guest cart items merge with their account cart

### Logged-in cart

- Cart is saved on the server and synced across devices
- Customer can update quantities or remove items
- Cart shows item count in the header

### Mini cart

A small overlay that slides up showing cart items and total. Customer can go directly to checkout from here.

### Cart rules

- Stock is checked when adding items — cannot add more than available
- If a product goes out of stock, customer is notified at checkout
- Items from different shops can be in the same cart (multi-shop checkout)

---

## Wishlist

Customers can save products they like but are not ready to buy yet.

### How wishlist works

1. Customer taps the heart icon on any product
2. Product is saved to wishlist
3. Guest wishlist saved on device; syncs when logged in
4. Customer can view all wishlist items on the wishlist page
5. From wishlist, customer can move items to cart

Wishlist items also appear as shortcuts on the checkout page.

---

## Location and Addresses

Delivery location affects which products and shops are available.

### Setting location

1. Customer allows location access or types an address
2. System finds nearby sellers within delivery range
3. Products shown are from shops that can deliver to that address

### Saved addresses

Logged-in customers can save multiple addresses (home, office, etc.) and pick one at checkout.

### Changing location

If customer changes their delivery area, available products may change — some shops may not deliver to the new location.

---

## Offers Page

A dedicated page showing all current promotional offers — banners, discounted products, and deal sections configured by admin.

---

## Shop by Store Page

Customers can browse all partner shops in their area and see products listed by each shop. Useful when they trust a specific store or want to buy everything from one place.

---

## Step-by-Step Flows

### Flow 1: Browse and add to cart

1. Customer opens the app
2. Browses home page or taps a category
3. Scrolls through products
4. Taps a product to see details
5. Taps "Add to Cart"
6. Continues shopping or opens mini cart
7. Taps "Go to Checkout"

### Flow 2: Search and buy

1. Customer types product name in search bar
2. Taps a search result
3. Adds to cart
4. Goes to checkout

### Flow 3: Guest shopping then login

1. Guest adds items to cart
2. Guest goes to checkout — prompted to log in
3. Customer logs in with phone and text code
4. Guest cart items merge with account
5. Customer continues checkout

### Flow 4: Change delivery address

1. Customer changes location in header or profile
2. System refreshes available products
3. Some cart items may become unavailable if new address is outside shop range
4. Customer is notified of any changes

---

## What Happens Behind the Scenes

- When customer sets location, system finds sellers within delivery radius
- Product prices and stock come live from each seller's inventory
- Cart totals update automatically when quantities change
- Out-of-stock products cannot be added or are flagged at checkout
- Home page sections are loaded from admin-configured content

---

## Important Rules

- Products are tied to specific sellers — same product name from two shops are separate listings
- Stock is real-time — another customer ordering the last item may cause unavailability
- Delivery range is based on shop location and platform settings
- Guest carts are device-specific — clearing browser data may clear the cart

---

## What If Something Goes Wrong?

| Problem                          | What happens                                            |
| -------------------------------- | ------------------------------------------------------- |
| Product out of stock             | Cannot add to cart, or removed at checkout with message |
| Shop does not deliver to address | Products from that shop hidden or flagged               |
| Cart item price changed          | Updated price shown at checkout preview                 |
| Guest cart lost                  | Happens if browser data cleared — log in early to sync  |

---

_Next → [Customer Checkout and Payment](05-customer-checkout-and-payment.md)_
