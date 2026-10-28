# Deployment and Running

## What Is This?

This document explains what you need to set up and run the quick commerce platform — for local testing and for a live production business. Written in plain language with no technical commands.

---

## Who Should Read This?

Business owners and technical team members preparing to launch or maintain the platform.

---

## What You Need

### Services and accounts

| Need                         | What it is for                                           |
| ---------------------------- | -------------------------------------------------------- |
| Cloud server                 | Runs the central system (main server, worker, scheduler) |
| Database service             | Stores all orders, users, products, and money records    |
| Cache and task service       | Background jobs, timers, and speed optimization          |
| Web hosting                  | Hosts the customer-facing website (all four apps)        |
| Payment partner account      | Processes online payments (UPI, cards)                   |
| Maps service account         | Address lookup, navigation, and route display            |
| Text message service account | Sends login codes and delivery codes                     |
| Image storage service        | Stores product photos and document uploads               |
| Push notification service    | Sends phone alerts                                       |
| Live location service        | Powers real-time delivery tracking on maps               |

### Team

- At least one technical person to set up and maintain the server
- Operations staff to manage admin console day-to-day
- Support staff to handle customer tickets

---

## Running Locally (For Testing)

During development and testing, the platform runs on a single computer:

### What runs

- The central system (all three roles combined for simplicity)
- The database (on the same computer or a local install)
- The website (customer, seller, delivery, and admin apps)
- The cache/task service (on the same computer or a local install)

### How to access

- Customer app: open the website home page in a browser
- Seller portal: add `/seller` to the website address
- Delivery app: add `/delivery` to the website address
- Admin console: add `/admin` to the website address

### Limitations of local testing

- Text messages may use test codes instead of real SMS
- Payments may use a test/sandbox payment partner
- Push notifications may not work on localhost
- Live tracking may be limited

---

## Running in Production (Live Business)

For a real business serving real customers, the platform should be split for reliability:

### Three separate services

| Service           | What it does                          | Why separate                           |
| ----------------- | ------------------------------------- | -------------------------------------- |
| Main server       | Handles all user requests             | Must always be fast                    |
| Background worker | Sends notifications, processes queues | Heavy work does not slow orders        |
| Scheduler         | Runs timed checks and regular jobs    | Reliable timers independent of traffic |

### Database

- Hosted on a managed database service (not on the same server as the app)
- Regular backups configured
- Secure access only from the application servers

### Website hosting

- Frontend hosted on a web hosting service (optimized for fast page loading)
- Connected to the main server for all data

### Domain name

- A proper domain name (e.g., `www.yourquickcommerce.com`)
- Secure connection (HTTPS) for all pages

---

## Deployment Options

### Cloud server (most common)

Rent a virtual server from a cloud provider. Install and run the platform. Full control but requires technical management.

### Container-based (Docker)

Package the entire platform into containers that can run anywhere. Easier to set up consistently and scale. Good for teams with some technical experience.

### Managed platform services

Some cloud providers offer services that run your application with minimal server management. Upload your code and configure settings — the provider handles the infrastructure.

### Kubernetes (large scale)

For businesses expecting very high traffic, container orchestration automatically scales servers up and down based on demand. More complex but handles growth.

---

## Health Checks

The platform can report its own health:

| Check                           | What it means                   |
| ------------------------------- | ------------------------------- |
| Is the main server running?     | Can it respond to requests?     |
| Is the database connected?      | Can it read and write data?     |
| Is the cache service connected? | Can it run background jobs?     |
| Are all services ready?         | Is everything working together? |

Health checks are used by monitoring tools to alert the team if something goes down.

---

## Monitoring

### What to watch

- **Server uptime** — is the platform accessible?
- **Response time** — are pages and orders loading fast?
- **Error rate** — are users hitting errors?
- **Order volume** — how many orders per hour?
- **Failed payments** — are payments going through?
- **Background job health** — are timers and notifications working?

### Alerting

Set up alerts so the team is notified immediately if:

- The server goes down
- Error rate spikes
- Payment failures increase
- Background services stop running

---

## Scaling for Growth

As the business grows:

| Growth stage | What to do                                   |
| ------------ | -------------------------------------------- |
| Starting out | Single main server + worker + scheduler      |
| Growing      | Add more main server copies (load balancing) |
| High traffic | Multiple workers, database optimization      |
| Multi-city   | Separate configurations per city/region      |

The platform is designed to scale by adding more copies of the main server and worker — not by rebuilding.

---

## Regular Maintenance

| Task                               | How often            |
| ---------------------------------- | -------------------- |
| Database backups                   | Daily (automated)    |
| Security updates                   | Monthly or as needed |
| Monitor disk space and performance | Weekly               |
| Review error logs                  | Daily                |
| Test payment flow                  | Weekly               |
| Verify background jobs running     | Daily                |
| Update product catalog and content | Ongoing              |

---

## Launch Checklist

Before going live with real customers:

- [ ] All services running (main server, worker, scheduler)
- [ ] Database connected and backed up
- [ ] Payment partner configured and tested with real transactions
- [ ] Text message service sending real codes
- [ ] Maps service working for address lookup and navigation
- [ ] Push notifications working on phones
- [ ] Live tracking showing rider movement
- [ ] At least one approved seller with products listed
- [ ] At least one approved delivery partner who can go online
- [ ] Admin account created and accessible
- [ ] Platform settings configured (fees, timeouts, branding)
- [ ] Legal pages (terms, privacy) published
- [ ] Support team ready to handle tickets
- [ ] Health checks and monitoring active
- [ ] Domain name and secure connection (HTTPS) configured

---

## What If Something Goes Wrong?

| Problem                        | What to check                                        |
| ------------------------------ | ---------------------------------------------------- |
| Website not loading            | Is web hosting running? Is domain configured?        |
| Orders not placing             | Is main server running? Is database connected?       |
| Notifications not sending      | Is background worker running?                        |
| Auto-cancellations not working | Is scheduler running?                                |
| Payments failing               | Is payment partner account active? Check credentials |
| Maps not working               | Is maps service account active? Check API limits     |
| Slow performance               | Check server resources; consider scaling up          |

---

_Next → [Glossary](31-glossary.md)_
