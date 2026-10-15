# MovieX Frontend Implementation & MERN Handoff

## Current scope (local preview only)

The MovieX UI is a standalone React + TypeScript + Vite frontend. The public Vercel deployment and GitHub repository are intentionally **not** updated during this stage.

### Customer experience
- Movie browsing, search and genre filtering, details and YouTube trailer embeds.
- Cinema / date / showtime selection from editable local screening data.
- Seat selection, simulated seat collisions, customer name/email validation.
- Demo payment methods and full-amount vs 30% downpayment preview.
- Demo booking creation, reference code, records view, filtering and pagination.
- Demo cancellation where permitted.

### Administrator workspace
- Dashboard overview, sample booking records, status transitions.
- Movie catalogue: add, view, edit and remove films.
- Screening schedule: add, view, edit and remove showtimes.
- Ongoing screenings sorted before upcoming and finished.
- Transactions screen showing projected totals and downpayment amounts, NOT actual collections.
- Search, status/date filters, pagination and inline form errors.

### Employee workspace
- Current cinema schedule and confirmed-booking list.
- Ticket search by booking reference; simulated check-in status.
- Searchable booking records with date/status filters and pagination.

### Authentication UI
- Customer / cinema staff / administrator demo role selection.
- Sign-in and sign-up form design with basic client-side validation.
- **No real identity or authorization**: any person can preview a role. Passwords are neither verified nor stored.

## Demo data and persistence

- Records are kept in browser localStorage using a demo version key.
- New movie listings, showtime edits and booking changes are reflected in the same local browser.
- Data is not shared among devices, browsers, teammates or deployments.
- The demo contains fictional customers and sample bookings.
- No payment details are stored and no real transactions take place.
- Browser-only seat checks are illustrative and **not safe for actual reservations**.

## Backend endpoints for the team to map next

Suggested contracts, to be reconciled with the backend developers' existing API:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/auth/register | Create account (server validated) |
| POST | /api/auth/login | Authenticate and issue secure session |
| GET | /api/auth/me | Identity and authorized role |
| GET | /api/movies | Catalogue search, filters and pagination |
| POST / PATCH / DELETE | /api/movies/:id | Admin catalogue management |
| GET | /api/showtimes | Movie + cinema + date schedule |
| POST / PATCH / DELETE | /api/showtimes/:id | Admin schedules |
| GET | /api/showtimes/:id/seats | Authoritative availability |
| POST | /api/bookings | Reserve transactionally, prevent collisions |
| GET | /api/bookings | Role-scoped booking history |
| PATCH | /api/bookings/:id | Cancel / admin status change |
| POST | /api/bookings/:id/check-in | Staff ticket verification |
| POST | /api/payments/checkout | Hosted payment session |
| GET | /api/transactions | Admin audit records, never browser-trusted |

Never trust frontend role selections, prices, payment flags, seat availability, or confirmation events. Enforce permissions, prices, seats, timestamps, and payment verification server-side. Integrate MongoDB in the backend only.

## Manual QA on localhost

1. Start with npm run dev, open http://127.0.0.1:5173/.
2. Click **Workspace**, choose each role using **Enter ... demo**.
3. In Administrator > Movies, open Add movie, submit empty to verify validation, then create/edit/delete a sample entry.
4. In Administrator > Showtimes, inspect search, pagination and edit/new validation.
5. In Administrator > Bookings, search a reference, expand Details and confirm a pending record.
6. In Cinema staff > Check-in, search the same reference and check in a confirmed booking.
7. Select a film, choose a future screening and an open seat, test payment plan and save a demo booking.
8. Return to Workspace > Customer and check that the booking exists locally.
9. Reload and check localStorage persistence. Repeat at mobile widths (375 and 430 px).

## Required academic deliverables still outstanding

The guidelines also require MERN integration, MongoDB, REST APIs, complete technical documentation (overview, scope, architecture, database design, screenshots, feature list, conclusion and sources), and group presentation. This file documents the frontend portion only.

**Deployment rule:** Do not push to GitHub or redeploy Vercel until the frontend is reviewed and approved locally.
