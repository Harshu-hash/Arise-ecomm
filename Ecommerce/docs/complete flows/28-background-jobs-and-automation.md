# Background Jobs and Automation

## What Is This?

Many things in the platform happen automatically — without any person clicking a button. Timers, scheduled checks, and background workers keep the business running smoothly. This document explains every automatic task in plain language.

---

## Who Should Read This?

Anyone who wants to understand what the system does on its own — especially important for troubleshooting stuck orders or money issues.

---

## Why Automation Matters

In quick commerce, speed is everything. The system cannot wait for a human to:

- Cancel an order when a seller does not respond
- Find a rider when the first search fails
- Release seller money after the return window
- Send notifications reliably during busy hours

Automation handles all of this instantly and consistently.

---

## Automatic Tasks

### 1. Seller Accept Timeout

| Detail          | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| What it does    | Cancels order if seller does not accept within the time limit |
| When it runs    | ~60 seconds after order is sent to seller                     |
| What happens    | Order cancelled, customer refunded, stock released            |
| Who is notified | Customer (refund), seller (cancellation)                      |

### 2. Rider Search Timeout

| Detail              | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| What it does        | Cancels or retries if no delivery partner accepts the job |
| When it runs        | ~60 seconds after shop marks order ready                  |
| Retry behavior      | Expands search radius and tries again (up to 3 attempts)  |
| If all retries fail | Order cancelled, customer refunded                        |
| Who is notified     | Customer, seller                                          |

### 3. Auto-Cancel Fallback

| Detail        | Value                                                   |
| ------------- | ------------------------------------------------------- |
| What it does  | Safety net that catches orders stuck in wrong status    |
| When it runs  | Periodic scheduled check (e.g., every few minutes)      |
| Why it exists | Backup in case the main timeout system missed something |
| What happens  | Stuck orders are cancelled and refunded                 |

### 4. Return Window Release

| Detail        | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| What it does  | Moves seller money from "pending" to "available"                 |
| When it runs  | After the return window closes with no return request            |
| Example       | Return window is 30 minutes — at 31 minutes, seller can withdraw |
| Why it exists | Protects against returns — money held until safe to release      |

### 5. Payout Batch Processing

| Detail        | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| What it does  | Processes pending withdrawal requests in bulk                        |
| When it runs  | On a schedule (e.g., daily or weekly)                                |
| What happens  | Seller and rider withdrawal requests are queued for admin processing |
| Why it exists | Efficient financial operations                                       |

### 6. Wallet Balance Verification

| Detail        | Value                                                 |
| ------------- | ----------------------------------------------------- |
| What it does  | Checks that wallet balances match transaction records |
| When it runs  | Periodic scheduled check                              |
| What happens  | Reports any mismatches for admin investigation        |
| Why it exists | Catches money recording errors early                  |

### 7. Live Location Cleanup

| Detail        | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| What it does  | Removes old rider location data from the live tracking service |
| When it runs  | Periodic scheduled check                                       |
| What happens  | Stale location data from completed deliveries is deleted       |
| Why it exists | Privacy and storage management                                 |

### 8. Push Notification Queue

| Detail         | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| What it does   | Sends phone push notifications reliably                      |
| When it runs   | Whenever a notification event occurs                         |
| Retry behavior | If sending fails, retries automatically                      |
| Why it exists  | Ensures notifications are delivered even during high traffic |

---

## Three Server Roles

In production, the platform runs as three separate services:

### Main Server

- Handles all user requests (shopping, ordering, login)
- Responds to customers, sellers, riders, and admins
- Must always be fast and available

### Background Worker

- Processes queued tasks (notifications, heavy calculations)
- Runs separately so it does not slow down the main server
- Handles notification delivery and queue processing

### Scheduler

- Runs timed checks on a regular schedule
- Seller timeout fallback, return window release, wallet verification
- Like an alarm clock for the platform

### Why separate?

If the platform tried to do everything in one process:

- Sending 1,000 notifications could slow down order placement
- A scheduled check could freeze the app for seconds
- A crash in one area could bring down everything

Separating them keeps the customer experience fast and reliable.

---

## Timer Flow Example

Here is how timers work together for one order:

```
Order placed → Seller timer starts (60s)
    → Seller accepts → Seller timer cancelled
    → Shop marks ready → Rider search timer starts (60s)
        → Rider accepts → Rider timer cancelled
        → Delivery happens → Return window timer starts (30min)
            → Window closes → Seller money released
```

If any timer expires without the expected action:

- Order is cancelled or retried
- Customer is refunded
- Everyone is notified

---

## What Happens Behind the Scenes

- Timers are set when specific events occur (order placed, shop ready, etc.)
- Timers are cancelled when the expected action happens (seller accepts, rider accepts)
- If a timer expires, the background worker or scheduler takes action
- All automatic actions are logged for troubleshooting
- Fallback scheduler catches anything the primary timers missed

---

## Important Rules

- Timers are strict — seller really does have only ~60 seconds
- Retry logic gives riders multiple chances before cancelling
- Return window is configurable — balance customer rights vs seller cash flow
- Background workers must be running in production — otherwise notifications and timers fail
- Scheduler must be running — otherwise money release and cleanup do not happen

---

## What If Something Goes Wrong?

| Problem                        | Likely cause                    | What to check                                 |
| ------------------------------ | ------------------------------- | --------------------------------------------- |
| Orders not auto-cancelling     | Scheduler or worker not running | Verify all three services are active          |
| Seller money stuck as pending  | Return window timer not running | Check scheduler; verify return window setting |
| Notifications not sending      | Worker not running              | Verify background worker is active            |
| Stuck orders not caught        | Fallback scheduler not running  | Check scheduler service                       |
| Old location data accumulating | Cleanup job not running         | Check scheduler service                       |

---

_Next → [Security and Login](29-security-and-login.md)_
