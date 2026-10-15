import type { Movie } from "./catalogue.ts";
import { samples } from "./catalogue.ts";
import { PRICE } from "./booking.ts";

export type Role = "customer" | "admin" | "employee";
export type BookingStatus = "Pending" | "Confirmed" | "Checked in" | "Cancelled";
export type PaymentPlan = "Full" | "30% deposit";
export type DemoBooking = {
  id: string;
  movieId: number;
  movieTitle: string;
  cinema: string;
  hall: string;
  date: string;
  time: string;
  seats: string[];
  customerName: string;
  customerEmail: string;
  method: string;
  paymentPlan: PaymentPlan;
  total: number;
  dueNow: number;
  status: BookingStatus;
  createdAt: string;
  checkedInAt?: string;
};
export type DemoShowtime = {
  id: string;
  movieId: number;
  cinema: string;
  hall: string;
  date: string;
  time: string;
  price: number;
};
export type DemoStore = {
  movies: Movie[];
  showtimes: DemoShowtime[];
  bookings: DemoBooking[];
};
export const CINEMAS = ["SM Mall of Asia", "SM Megamall", "Ayala Malls Manila Bay"];
export const SHOWTIMES = ["10:30 AM", "01:30 PM", "04:30 PM", "07:30 PM"];
const STORAGE_KEY = "moviex-frontend-demo-v3";

export const phDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
};
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const showtimeTimestamp = (date: string, time: string): number => {
  const match = time.match(/^(\d{1,2}):(\d\d)\s*(AM|PM)$/i);
  if (!match) return NaN;
  const h = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return new Date(`${date}T${String(h).padStart(2, "0")}:${match[2]}:00+08:00`).getTime();
};
export const showtimeStatus = (date: string, time: string, now = Date.now()) => {
  const start = showtimeTimestamp(date, time);
  if (!Number.isFinite(start)) return "Unknown" as const;
  if (now >= start && now < start + 3 * 60 * 60 * 1000) return "Ongoing" as const;
  if (start < now) return "Finished" as const;
  return "Upcoming" as const;
};
export const pageItems = <T,>(values: T[], page: number, pageSize = 8) =>
  values.slice((page - 1) * pageSize, page * pageSize);
export const pageCount = (length: number, pageSize = 8) => Math.max(1, Math.ceil(length / pageSize));
export const seatKey = (movieId: number, cinema: string, date: string, time: string) =>
  `${movieId}|${cinema}|${date}|${time}`;
export function reservedSeats(bookings: DemoBooking[], movieId: number, cinema: string, date: string, time: string) {
  return new Set(bookings.filter((b) => b.movieId === movieId && b.cinema === cinema && b.date === date && b.time === time && b.status !== "Cancelled").flatMap((b) => b.seats));
}
function seedStore(): DemoStore {
  const showtimes: DemoShowtime[] = [];
  samples.forEach((movie, movieIndex) => CINEMAS.forEach((cinema, c) => {
    for (let day = 0; day < 6; day++) {
      SHOWTIMES.forEach((time, t) => {
        showtimes.push({
          id: `ST-${movie.id}-${c}-${day}-${t}`,
          movieId: movie.id,
          cinema,
          hall: `Cinema ${movieIndex + 1}`,
          date: phDate(day),
          time,
          price: PRICE,
        });
      });
    }
  }));
  const names = ["Jamie Cruz", "Taylor Reyes", "Morgan Santos", "Alex Lim", "Casey Tan", "Robin Garcia", "Sam Flores", "Drew Navarro", "Jordan Ramos", "Avery Diaz", "Pat Rivera", "Dana Mercado", "Luca Ong", "Kim Fernandez", "Riley Torres", "Marion Chua"];
  const bookings: DemoBooking[] = names.map((name, i) => {
    const movie = samples[i % samples.length];
    const session = showtimes.find((s) => s.movieId === movie.id && s.cinema === CINEMAS[i % CINEMAS.length] && s.date === phDate(i % 3) && s.time === SHOWTIMES[i % SHOWTIMES.length])!;
    const total = PRICE * (i % 3 === 0 ? 2 : 1);
    const plan: PaymentPlan = i % 3 === 0 ? "30% deposit" : "Full";
    return {
      id: `MX-DEMO-${String(i + 1).padStart(4, "0")}`,
      movieId: movie.id,
      movieTitle: movie.title,
      cinema: session.cinema,
      hall: session.hall,
      date: session.date,
      time: session.time,
      seats: i % 3 === 0 ? [`F${(i % 8) + 1}`, `F${(i % 8) + 2}`] : [`D${(i % 8) + 1}`],
      customerName: name,
      customerEmail: i < 3 ? "guest@moviex.demo" : `customer${i}@example.test`,
      method: ["GCash", "Credit / Debit Card", "Maya", "Bank Transfer"][i % 4],
      paymentPlan: plan,
      total,
      dueNow: plan === "30% deposit" ? total * 0.3 : total,
      status: (["Confirmed", "Pending", "Checked in", "Cancelled"] as BookingStatus[])[i % 4],
      createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    };
  });
  return { movies: [...samples], showtimes, bookings };
}
export const readStore = (): DemoStore => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const saved: unknown = JSON.parse(json);
      if (saved && typeof saved === "object" && "movies" in saved && "showtimes" in saved && "bookings" in saved) {
        const data = saved as DemoStore;
        if (Array.isArray(data.movies) && Array.isArray(data.showtimes) && Array.isArray(data.bookings)) return data;
      }
    }
  } catch { /* unavailable or malformed local browser storage */ }
  return seedStore();
};
export const saveStore = (data: DemoStore) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { /* preview remains functional when browser storage is disabled */ }
};
