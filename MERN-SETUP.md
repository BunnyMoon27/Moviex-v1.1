# MovieX MERN setup (local only)

## Architecture

- React + Vite frontend: http://127.0.0.1:5173
- Express/Node REST API: http://127.0.0.1:4000/api
- MongoDB database: `moviex`, with `users`, `movies`, `showtimes`, `bookings`, `reservedseats` collections.
- Passwords are hashed with bcrypt; the backend verifies JWTs and loads the role from MongoDB for each request. Customer registration never grants staff/admin access.
- Server validates inputs and enforces roles. MongoDB unique seat reservations and transactions prevent duplicate reservations.

## Start

1. Install MongoDB Community Server or create a MongoDB Atlas cluster. Set up a replica set for booking transactions; a standalone `mongod` cannot execute MongoDB transactions. For local MongoDB, initiate replica set `rs0` and use `mongodb://127.0.0.1:27018/moviex?replicaSet=rs0`. Atlas clusters support transactions.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` and a cryptographically random `JWT_SECRET` at least 32 characters long. Do not commit this file.
3. `npm install`
4. `npm run seed` to seed the sample catalogue and preview screenings.
5. Create the first administrator with `npm run admin:create`. Public registration always creates customer accounts.
6. `npm run dev:full` starts the frontend and backend. Open http://127.0.0.1:5173.

## Routes

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/movies`, `POST /api/movies`, `PUT /api/movies/:id`, `DELETE /api/movies/:id`
- `GET /api/showtimes`, `GET /api/showtimes/:id/seats`, `POST /api/showtimes`, `PUT /api/showtimes/:id`, `DELETE /api/showtimes/:id`
- `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/:id/status`
- `GET /api/health`

The seed adds the seven featured Philippine listings and preview schedules to MovieX, so **Get Tickets** opens the site's own cinema, showtime, seat, and reservation flow. Preview screenings and prices are project sample data; reservations are saved by MovieX and do not reserve seats with a real cinema. Replace the preview schedules in the administrator workspace with the cinema's own inventory before accepting real bookings. The booking flow uses backend movie/showtime IDs and server-held seat inventory; ambiguous duplicate title/year matches stay unavailable. Payment methods remain simulated in this project.

## Security and limitations

- Admin CRUD is restricted to the admin role; staff can check in confirmed bookings; customers can see and cancel their own bookings.
- Payment method and deposit selection record booking intentions only. **No actual payment provider or payment verification is integrated.** Do not collect real card details in the demo.
- Customer, admin and staff data now come from MongoDB. Account sessions require the API; the JWT expires after eight hours.
- The live booking catalogue now reads movies and screening inventory from MongoDB. Listings are seeded example data, not real-time cinema programming.
- No deployment changes have been made. Before production: replace browser sessionStorage JWT storage with secure HttpOnly cookies, configure HTTPS/CSRF, audit rate limits, add end-to-end database tests, and configure backups and monitoring.
## Dedicated administrator and staff access

- Customer: open the site and select the account icon.
- Administrator login: http://127.0.0.1:5173/?access=admin
- Cinema staff login: http://127.0.0.1:5173/?access=staff
- The separate URLs are not linked from the public sign-in form. Backend role checks still apply.
- Create the first admin with `npm run admin:create`. To reset an existing admin password, run `npm run admin:reset-password` from the project folder; you must have access to the configured database.
- In the admin dashboard, open Accounts to create staff/admin users, change emails, names, roles or passwords, and revoke access.

## MongoDB Atlas handover

1. Your friend should own the Atlas project and create a free-tier cluster if available.
2. Create a database user and restrict IP access. Use a strong database password.
3. Set MONGODB_URI in the ignored .env file to the Atlas mongodb+srv connection URI.
4. Run npm run seed and npm run dev:full, then check http://127.0.0.1:4000/api/health.
5. Deploy the Express backend separately for an online site. Configure CLIENT_ORIGIN on the backend and VITE_API_URL on the frontend.
6. Never commit .env, database credentials, JWT secrets or real customer data.

## Privileged account API

- GET /api/admin/accounts
- POST /api/admin/accounts
- PATCH /api/admin/accounts/:id
- DELETE /api/admin/accounts/:id

These routes require a valid administrator account.


## Local MongoDB helper

The `npm run db:start` helper expects MongoDB Community Server 9.0 at `C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe` and stores local data under your own `%LOCALAPPDATA%\MovieX\mongodb` folder. Those files are not part of this repository. If MongoDB is installed elsewhere, use your own replica set or Atlas URI in `.env`.

On a fresh local replica set, initialize it once with `mongosh "mongodb://127.0.0.1:27018" --eval "rs.initiate()"` before using booking transactions.
