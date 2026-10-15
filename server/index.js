import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { registerAccountRoutes } from "./routes/accounts.js";
import { findInventoryMovie } from "./catalogue.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
const origin = process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173";
app.use(cors({ origin, credentials: false }));
const port = Number(process.env.API_PORT || 4000);
const secret = process.env.JWT_SECRET;
const uri = process.env.MONGODB_URI;
if (!secret || secret.length < 32 || !uri) {
  console.error("Set MONGODB_URI and a random JWT_SECRET of at least 32 characters in .env");
  process.exit(1);
}
mongoose.set("strictQuery", true);
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "employee", "admin"], default: "customer" },
}, { timestamps: true });
const movieSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  title: { type: String, required: true },
  overview: String, poster: String, backdrop: String, logo: String,
  logoMonochrome: Boolean, trailerId: String, genres: [String],
  runtime: Number, rating: String, year: Number,
}, { timestamps: true });
const showSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  movieId: { type: Number, required: true, index: true },
  cinema: { type: String, required: true }, hall: { type: String, required: true },
  date: { type: String, required: true }, time: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
}, { timestamps: true });
showSchema.index({ cinema: 1, hall: 1, date: 1, time: 1 }, { unique: true });
const bookingSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  showtimeId: { type: String, required: true, index: true },
  movieId: Number, movieTitle: String, cinema: String, hall: String,
  date: String, time: String, seats: [String],
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerName: String, customerEmail: String, method: String,
  paymentPlan: { type: String, enum: ["Full", "30% deposit"], default: "Full" },
  total: Number, dueNow: Number,
  status: { type: String, enum: ["Pending", "Confirmed", "Checked in", "Cancelled"], default: "Pending" },
  checkedInAt: Date,
}, { timestamps: true });
const seatSchema = new mongoose.Schema({
  showtimeId: { type: String, required: true },
  seat: { type: String, required: true },
  bookingId: { type: String, required: true },
});
seatSchema.index({ showtimeId: 1, seat: 1 }, { unique: true });
const User = mongoose.model("User", userSchema);
const Movie = mongoose.model("Movie", movieSchema);
const Showtime = mongoose.model("Showtime", showSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Seat = mongoose.model("ReservedSeat", seatSchema);
const fail = (res, status, message) => res.status(status).json({ error: message });
const safe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validate = (schema, body, res) => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { fail(res, 400, parsed.error.issues[0]?.message || "Invalid input"); return null; }
  return parsed.data;
};
const email = z.email().max(254).transform(s => s.toLowerCase());
const registerInput = z.object({ name: z.string().trim().min(2).max(100), email, password: z.string().min(8).max(128) }).strict();
const loginInput = z.object({ email, password: z.string().min(1) }).strict();
const movieInput = z.object({
  id: z.number().int().positive().optional(), title: z.string().trim().min(2).max(150),
  overview: z.string().min(12).max(5000), poster: z.string().min(1).max(2048),
  backdrop: z.string().min(1).max(2048), logo: z.string().nullable().optional(),
  logoMonochrome: z.boolean().optional(), trailerId: z.string().max(20).optional(),
  genres: z.array(z.string()).max(12), runtime: z.number().int().positive().nullable(),
  rating: z.string().nullable(), year: z.number().int().min(1890).max(2100),
}).strict();
const showInput = z.object({
  id: z.string().optional(), movieId: z.number().int().positive(),
  cinema: z.string().trim().min(2), hall: z.string().trim().min(1),
  date: z.iso.date(), time: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/),
  price: z.number().positive(),
}).strict();
const bookingInput = z.object({
  showtimeId: z.string().min(1), seats: z.array(z.string().regex(/^[A-G](?:[1-9]|10)$/)).min(1).max(8),
  method: z.enum(["GCash", "Maya", "Bank Transfer", "Credit / Debit Card"]),
  paymentPlan: z.enum(["Full", "30% deposit"]),
}).strict();
const identity = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });
const tokenFor = (u) => jwt.sign({ sub: String(u._id) }, secret, { expiresIn: "8h", issuer: "moviex" });
const authenticate = safe(async (req, res, next) => {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token) return fail(res, 401, "Sign in required");
  let payload;
  try { payload = jwt.verify(token, secret, { issuer: "moviex" }); } catch { return fail(res, 401, "Invalid or expired session"); }
  const user = await User.findById(payload.sub);
  if (!user) return fail(res, 401, "Account unavailable");
  req.user = user;
  next();
});
const allow = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : fail(res, 403, "Access denied");
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });
app.get("/api/health", (_req, res) => res.json({ ok: mongoose.connection.readyState === 1, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.post("/api/auth/register", authLimiter, safe(async (req, res) => {
  const body = validate(registerInput, req.body, res); if (!body) return;
  if (await User.exists({ email: body.email })) return fail(res, 409, "Email already registered");
  const user = await User.create({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 12), role: "customer" });
  res.status(201).json({ user: identity(user), token: tokenFor(user) });
}));
app.post("/api/auth/login", authLimiter, safe(async (req, res) => {
  const body = validate(loginInput, req.body, res); if (!body) return;
  const user = await User.findOne({ email: body.email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return fail(res, 401, "Invalid email or password");
  res.json({ user: identity(user), token: tokenFor(user) });
}));
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: identity(req.user) }));
registerAccountRoutes(app, { User, authenticate, allow, safe, fail, identity });

// Curated snapshot of independently verified Philippine cinema listings. Not bookable MovieX inventory.
const philippineCinemaSnapshot = [
  {
    "id": 900000,
    "trailerId": "1I69_eJN2Ww", "title": "2 Valid IDs",
    "overview": "2 Valid IDs is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900000.jpg",
    "backdrop": "/images/backdrops/900000.jpg",
    "genres": [
      "Drama"
    ],
    "runtime": 90,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900001,
    "trailerId": "4fn4UcgzRhg", "title": "Beware Boiúna",
    "overview": "Beware Boiúna is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900001.jpg",
    "backdrop": "/images/backdrops/900001.jpg",
    "genres": [
      "Horror",
      "Thriller"
    ],
    "runtime": 104,
    "rating": "R-16",
    "year": 2026
  },
  {
    "id": 900002,
    "title": "Godzilla 2000: Millennium",
    "overview": "Godzilla 2000: Millennium is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900002.jpg",
    "backdrop": "/images/now-showing/900002.jpg",
    "genres": [
      "Science Fiction",
      "Action"
    ],
    "runtime": 107,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900003,
    "title": "Godzilla vs. Biollante",
    "overview": "Godzilla vs. Biollante is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900003.jpg",
    "backdrop": "/images/now-showing/900003.jpg",
    "genres": [
      "Science Fiction",
      "Action"
    ],
    "runtime": 104,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900004,
    "title": "Godzilla: Final Wars",
    "overview": "Godzilla: Final Wars is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900004.jpg",
    "backdrop": "/images/now-showing/900004.jpg",
    "genres": [
      "Science Fiction",
      "Action"
    ],
    "runtime": 125,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900005,
    "title": "Mothra vs. Godzilla",
    "overview": "Mothra vs. Godzilla is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900005.jpg",
    "backdrop": "/images/now-showing/900005.jpg",
    "genres": [
      "Science Fiction",
      "Action"
    ],
    "runtime": 88,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900006,
    "title": "Pee Mak",
    "overview": "Pee Mak is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900006.jpg",
    "backdrop": "/images/now-showing/900006.jpg",
    "genres": [
      "Comedy",
      "Horror"
    ],
    "runtime": 112,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900007,
    "title": "Shin Godzilla",
    "overview": "Shin Godzilla is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900007.jpg",
    "backdrop": "/images/now-showing/900007.jpg",
    "genres": [
      "Science Fiction",
      "Drama"
    ],
    "runtime": 119,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900008,
    "title": "The Intern",
    "overview": "The Intern is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900008.jpg",
    "backdrop": "/images/now-showing/900008.jpg",
    "genres": [
      "Comedy",
      "Drama"
    ],
    "runtime": 132,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900009,
    "trailerId": "iozXpsj5sQ8", "title": "Whalefall",
    "overview": "Whalefall is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900009.jpg",
    "backdrop": "/images/backdrops/900009.jpg",
    "genres": [
      "Thriller",
      "Drama"
    ],
    "runtime": 105,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900010,
    "trailerId": "mtmItaZW5Oo", "title": "Street Fighter",
    "overview": "Street Fighter is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900010.jpg",
    "backdrop": "/images/backdrops/900010.jpg",
    "genres": [
      "Action"
    ],
    "runtime": 119,
    "rating": "R-13",
    "year": 2026
  },
  {
    "id": 900011,
    "trailerId": "aFLH1IwmGW8", "title": "Other Mommy",
    "overview": "Other Mommy is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900011.jpg",
    "backdrop": "/images/backdrops/900011.webp",
    "genres": [
      "Horror"
    ],
    "runtime": 93,
    "rating": "R-16",
    "year": 2026
  },
  {
    "id": 900012,
    "title": "SB19 Wakas at Simula: The Trilogy Concert Finale",
    "overview": "SB19 Wakas at Simula: The Trilogy Concert Finale is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900012.png",
    "backdrop": "/images/now-showing/900012.png",
    "genres": [
      "Music",
      "Documentary"
    ],
    "runtime": 130,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900013,
    "title": "Chiikawa the Movie: The Secret of the Mermaid Island",
    "overview": "Chiikawa the Movie: The Secret of the Mermaid Island is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900013.jpg",
    "backdrop": "/images/now-showing/900013.jpg",
    "genres": [
      "Animation"
    ],
    "runtime": 98,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900014,
    "trailerId": "60D2IeWxXRU", "title": "Verity",
    "overview": "Verity is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900014.jpg",
    "backdrop": "/images/backdrops/900014.jpg",
    "genres": [
      "Thriller"
    ],
    "runtime": 117,
    "rating": "R-16",
    "year": 2026
  },
  {
    "id": 900015,
    "title": "Avengers: Endgame Encore",
    "overview": "Avengers: Endgame Encore is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900015.webp",
    "backdrop": "/images/now-showing/900015.webp",
    "genres": [
      "Action",
      "Adventure"
    ],
    "runtime": 185,
    "rating": "PG",
    "year": 2026
  },
  {
    "id": 900016,
    "trailerId": "a8RHqN93qfo", "title": "Forgotten Island",
    "overview": "Forgotten Island is listed as screening at SM Mall of Asia in the Philippines on October 15, 2026. Refer to the cinema for confirmed screening times and tickets.",
    "poster": "/images/now-showing/900016.webp",
    "backdrop": "/images/backdrops/900016.jpg",
    "genres": [
      "Adventure",
      "Animation"
    ],
    "runtime": 108,
    "rating": "PG",
    "year": 2026
  }
];
app.get("/api/philippines/now-showing", safe(async (_req, res) => {
  const movies = philippineCinemaSnapshot.filter(movie => [900000,900001,900009,900010,900011,900014,900016].includes(movie.id));
  const inventory = await Movie.find({}, { _id: 0, id: 1, title: 1, year: 1 }).lean();
  res.json({ asOf:"2026-10-15", cinema:"Selected Philippine cinemas", source:"https://www.clickthecity.com/movies/theaters/sm-mall-of-asia/2026-10-15", movies:movies.map(movie => ({ ...movie, bookingMovieId:findInventoryMovie(movie, inventory)?.id ?? null })), specialScreenings:philippineCinemaSnapshot.filter(movie => !movies.some(current => current.id === movie.id)) });
}));
app.get("/api/movies", safe(async (_req, res) => res.json(await Movie.find({}, { _id: 0, __v: 0 }).sort({ title: 1 }).lean())));
app.post("/api/movies", authenticate, allow("admin"), safe(async (req, res) => {
  const body = validate(movieInput, req.body, res); if (!body) return;
  const movie = await Movie.create({ ...body, id: body.id || Date.now() });
  res.status(201).json(movie);
}));
app.put("/api/movies/:id", authenticate, allow("admin"), safe(async (req, res) => {
  const body = validate(movieInput, req.body, res); if (!body) return;
  const movie = await Movie.findOneAndUpdate({ id: Number(req.params.id) }, { $set: { ...body, id: Number(req.params.id) } }, { new: true, runValidators: true });
  if (!movie) return fail(res, 404, "Movie not found"); res.json(movie);
}));
app.delete("/api/movies/:id", authenticate, allow("admin"), safe(async (req, res) => {
  const id = Number(req.params.id);
  if (await Showtime.exists({ movieId: id })) return fail(res, 409, "Remove associated showtimes first");
  if (!await Movie.findOneAndDelete({ id })) return fail(res, 404, "Movie not found");
  res.status(204).end();
}));
app.get("/api/showtimes", safe(async (_req, res) => res.json(await Showtime.find({}, { _id: 0, __v: 0 }).sort({ date: 1, time: 1 }).lean())));
app.get("/api/showtimes/:id/seats", safe(async (req, res) => {
  const show = await Showtime.findOne({ id: req.params.id }, { _id: 0, id: 1 }).lean();
  if (!show) return fail(res, 404, "Showtime not found");
  const seats = await Seat.find({ showtimeId: show.id }, { _id: 0, seat: 1 }).lean();
  res.json({ showtimeId: show.id, reserved: seats.map(s => s.seat) });
}));
app.post("/api/showtimes", authenticate, allow("admin"), safe(async (req, res) => {
  const body = validate(showInput, req.body, res); if (!body) return;
  if (!await Movie.exists({ id: body.movieId })) return fail(res, 400, "Unknown movie");
  const show = await Showtime.create({ ...body, id: body.id || randomUUID() });
  res.status(201).json(show);
}));
app.put("/api/showtimes/:id", authenticate, allow("admin"), safe(async (req, res) => {
  const body = validate(showInput, req.body, res); if (!body) return;
  if (!await Movie.exists({ id: body.movieId })) return fail(res, 400, "Unknown movie");
  if (await Booking.exists({ showtimeId: req.params.id, status: { $ne: "Cancelled" } })) return fail(res, 409, "Cancel existing bookings before editing this screening");
  const show = await Showtime.findOneAndUpdate({ id: req.params.id }, { $set: { ...body, id: req.params.id } }, { new: true, runValidators: true });
  if (!show) return fail(res, 404, "Showtime not found"); res.json(show);
}));
app.delete("/api/showtimes/:id", authenticate, allow("admin"), safe(async (req, res) => {
  if (await Booking.exists({ showtimeId: req.params.id, status: { $ne: "Cancelled" } })) return fail(res, 409, "Active bookings exist");
  if (!await Showtime.findOneAndDelete({ id: req.params.id })) return fail(res, 404, "Showtime not found");
  res.status(204).end();
}));
app.get("/api/bookings", authenticate, safe(async (req, res) => {
  const filter = req.user.role === "customer" ? { customerId: req.user._id } : {};
  res.json(await Booking.find(filter, { _id: 0, __v: 0, customerId: 0 }).sort({ createdAt: -1 }).lean());
}));
app.post("/api/bookings", authenticate, allow("customer"), safe(async (req, res) => {
  const body = validate(bookingInput, req.body, res); if (!body) return;
  if (new Set(body.seats).size !== body.seats.length) return fail(res, 400, "Duplicate seats");
  const show = await Showtime.findOne({ id: body.showtimeId });
  if (!show) return fail(res, 404, "Showtime not found");
  const movie = await Movie.findOne({ id: show.movieId });
  if (!movie) return fail(res, 409, "Movie unavailable");
  const timeMatch = show.time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  const hour = timeMatch ? (Number(timeMatch[1]) % 12) + (timeMatch[3] === "PM" ? 12 : 0) : 0;
  if (Date.parse(show.date + "T" + String(hour).padStart(2, "0") + ":" + timeMatch?.[2] + ":00+08:00") <= Date.now()) return fail(res, 409, "This screening has already started");
  const id = "MX-" + randomUUID().slice(0, 12).toUpperCase();
  const total = show.price * body.seats.length;
  const record = {
    id, showtimeId: show.id, movieId: movie.id, movieTitle: movie.title,
    cinema: show.cinema, hall: show.hall, date: show.date, time: show.time,
    seats: body.seats, customerId: req.user._id, customerName: req.user.name,
    customerEmail: req.user.email, method: body.method, paymentPlan: body.paymentPlan,
    total, dueNow: body.paymentPlan === "30% deposit" ? Math.round(total * 30) / 100 : total,
    status: "Pending",
  };
  // A MongoDB transaction ensures reservations and the booking are committed together.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Seat.insertMany(body.seats.map(seat => ({ showtimeId: show.id, seat, bookingId: id })), { session, ordered: true });
      await Booking.create([record], { session });
    });
  } finally { await session.endSession(); }
  res.status(201).json(await Booking.findOne({ id }, { _id: 0, __v: 0, customerId: 0 }).lean());
}));
app.patch("/api/bookings/:id/status", authenticate, safe(async (req, res) => {
  const body = validate(z.object({ status: z.enum(["Confirmed", "Checked in", "Cancelled"]) }).strict(), req.body, res); if (!body) return;
  const booking = await Booking.findOne({ id: req.params.id });
  if (!booking) return fail(res, 404, "Booking not found");
  const owner = String(booking.customerId) === String(req.user._id);
  const { status } = body;
  if (req.user.role === "customer" && (!owner || status !== "Cancelled")) return fail(res, 403, "Access denied");
  if (req.user.role === "employee" && status !== "Checked in") return fail(res, 403, "Staff can only check in");
  if (status === "Confirmed" && (req.user.role !== "admin" || booking.status !== "Pending")) return fail(res, 409, "Cannot confirm this booking");
  if (status === "Checked in" && (booking.status !== "Confirmed" || !["employee", "admin"].includes(req.user.role))) return fail(res, 409, "Booking must be confirmed first");
  if (status === "Cancelled" && (booking.status === "Cancelled" || booking.status === "Checked in")) return fail(res, 409, "Cannot cancel this booking");
  if (status === "Cancelled" && req.user.role === "customer") {
    const timeMatch = booking.time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
    const hour = timeMatch ? (Number(timeMatch[1]) % 12) + (timeMatch[3] === "PM" ? 12 : 0) : 0;
    if (!timeMatch || Date.parse(booking.date + "T" + String(hour).padStart(2, "0") + ":" + timeMatch[2] + ":00+08:00") <= Date.now()) return fail(res, 409, "Screening has already started");
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Booking.updateOne({ _id: booking._id, status: booking.status }, { $set: { status, ...(status === "Checked in" ? { checkedInAt: new Date() } : {}) } }, { session });
      if (!updated.modifiedCount) throw Object.assign(new Error("Booking changed; retry"), { status: 409 });
      if (status === "Cancelled") await Seat.deleteMany({ bookingId: booking.id }, { session });
    });
  } finally { await session.endSession(); }
  res.json({ id: booking.id, status });
}));
app.use((err, _req, res, _next) => {
  if (err?.code === 11000) return fail(res, 409, "Duplicate record or seat already reserved");
  if (err?.name === "ValidationError" || err?.name === "CastError") return fail(res, 400, "Invalid record");
  console.error(err);
  return fail(res, err.status || 500, err.status ? err.message : "Server error");
});
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Movie.init(), Showtime.init(), Booking.init(), Seat.init()]);
  app.listen(port, "127.0.0.1", () => console.log("MovieX API on http://127.0.0.1:" + port));
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
}
