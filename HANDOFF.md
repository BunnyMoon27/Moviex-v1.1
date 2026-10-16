# MovieX handoff

This repository contains the MovieX source code for a fresh setup. It does not include your private `.env`, local MongoDB files or accounts, installed dependencies, or build output. Keep your `.env` and database private when sharing the code.

## Start on your computer

1. Install Node.js 22.12+ (or 24), npm, and MongoDB configured as a replica set. MongoDB Atlas is an option; bookings require transactions.
2. Copy `.env.example` to `.env`, then set your own database URI and a random `JWT_SECRET` of at least 32 characters. Never share or commit `.env`.
3. Run `npm install`.
4. Run `npm run seed` to add the sample movie catalogue and preview screenings to your database.
5. Run `npm run admin:create` and enter your own administrator details privately in the terminal.
6. Run `npm run dev:full` and open `http://127.0.0.1:5173`.

The booking and payment flow is a project demo. It does not connect to real cinemas or charge money. See `README.md` and `MERN-SETUP.md` for details.
