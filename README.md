# MovieX

A local MERN cinema booking school project with a React/Vite/TypeScript frontend, Express REST API, and MongoDB database. The original dark cinema design is preserved.

## Run locally

Requirements: Node.js 22.12+ or 24, npm, MongoDB with a replica set. This PC uses the dedicated MovieX replica set rs0 on port 27018 (not the default MongoDB service on 27017).

1. Install dependencies with npm install.
2. Copy .env.example to .env if needed. Keep .env private. Use a strong JWT_SECRET and MONGODB_URI pointing to the replica set.
3. Start MongoDB with npm run db:start if it is not already running.
4. Use npm run dev:full to start Vite and the Express API.
5. Open http://127.0.0.1:5173. The API health endpoint is http://127.0.0.1:4000/api/health.

If setting up a fresh database, run npm run seed once to create example movies and showtimes. Do not reseed a populated database without checking the records first.

## Roles and access

- Customers: use the account/workspace button from the website; register or sign in.
- Administrator: http://127.0.0.1:5173/?access=admin
- Cinema staff: http://127.0.0.1:5173/?access=staff

An administrator manages movies, screenings, accounts and booking confirmations. Staff can check in confirmed tickets. Customers reserve seats, view upcoming and past orders, and cancel eligible future bookings. Permissions are enforced by the backend.

The Show Password control and Stay signed in checkbox work on sign-in. Stay signed in stores the token in localStorage, otherwise sessionStorage. JWTs expire after eight hours and require signing in again.

## Booking and database behavior

The current cinema catalogue and showtimes/prices are read from the MovieX database rather than external movie search results. Each screening's seat map obtains actual reserved seats from the API and refreshes periodically and on focus. The backend enforces a unique seat-per-showtime index in a MongoDB transaction, rejecting competing bookings. Cancelled bookings remain in history and free their seats.

A booking must be created by a signed-in customer. Customers can only view their own orders. The backend validates seats (rows A-G, 1-10, up to eight seats), customer ownership and status changes; clients cannot override authoritative prices or guest identity.

Payments are simulated for the school project. Payment methods and deposit choices are stored as preferences only. No card numbers are collected, no provider is connected, and no actual charges are processed.

## Verification

- npm run build
- npm test
- node scripts/integration-check.mjs

The integration test creates temporary accounts, bookings and a screening in the local test database and cleans them afterward; avoid running it against a production database. See MERN-SETUP.md for API routes, bootstrap accounts and hosting notes.

## Deployment limitation

The existing public Vercel site is not updated by local changes. To make MovieX available online, host the Express API and MongoDB separately, configure CLIENT_ORIGIN and VITE_API_URL, and harden authentication, rate limits and operational security. No deployment or GitHub push is part of this integration.

## Art and licensing

The locally bundled sample movie images remain the property of their respective rightsholders; many originate from TMDB. The cinema listings are example school-project data, not live Philippine theatrical showtimes. Confirm permissions before public/commercial use. MovieX is not endorsed by TMDB.
