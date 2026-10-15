import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { samples } from "../src/catalogue.ts";
import { bookingSamples } from "./booking-samples.js";
import { CINEMAS, SHOWTIMES, phDate } from "../src/demoStore.ts";
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
const db = mongoose.connection.db;
const movies = db.collection("movies");
const seedMovies = [...samples, ...bookingSamples];
for (const movie of seedMovies) await movies.updateOne({ id: movie.id }, { $setOnInsert: { ...movie, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
const showtimes = db.collection("showtimes");
for (const [movieIndex, movie] of seedMovies.entries()) {
  for (const [cinemaIndex, cinema] of CINEMAS.entries()) {
    for (let day = 0; day < 6; day++) {
      for (const [timeIndex, time] of SHOWTIMES.entries()) {
        const id = `ST-${movie.id}-${cinemaIndex}-${day}-${timeIndex}-${phDate()}`;
        await showtimes.updateOne({ id }, { $setOnInsert: { id, movieId: movie.id, cinema, hall: `Cinema ${movieIndex + 1}`, date: phDate(day), time, price: 260, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
      }
    }
  }
}
const email = process.env.SETUP_EMAIL?.trim().toLowerCase();
const password = process.env.SETUP_PASSWORD;
const role = process.env.SETUP_ROLE;
if (email || password || role) {
  if (!email || !password || password.length < 12 || !["admin", "employee"].includes(role)) throw new Error("Provide SETUP_EMAIL, SETUP_PASSWORD (12+ characters), SETUP_ROLE=admin|employee");
  const users = db.collection("users");
  if (await users.findOne({ email })) throw new Error("Account exists; setup will not overwrite it");
  await users.insertOne({ name: role === "admin" ? "MovieX Administrator" : "Cinema Staff", email, passwordHash: await bcrypt.hash(password, 12), role, createdAt: new Date(), updatedAt: new Date() });
  console.log("Created " + role + " account for " + email);
}
console.log("Seeded sample movies and MovieX preview showtimes (existing records unchanged)");
await mongoose.disconnect();
