// @ts-ignore Node supplies the test runner.
import { test } from "node:test";
// @ts-ignore Node supplies assertions.
import assert from "node:assert/strict";
import { isEmail, nextShowtimeSlot, pageCount, pageItems, readStore, reservedSeats, showtimeStatus, showtimeTimestamp, type DemoBooking } from "./demoStore.ts";

test("demo data includes distinct movies, screening IDs and bookings", () => {
  const state = readStore();
  assert.ok(state.movies.length >= 5 && state.bookings.length >= 8);
  assert.equal(new Set(state.showtimes.map((s) => s.id)).size, state.showtimes.length);
  assert.equal(new Set(state.movies.map((m) => m.id)).size, state.movies.length);
});
test("Manila-local showtimes classify upcoming, ongoing, and finished", () => {
  const start = showtimeTimestamp("2026-10-16", "07:30 PM");
  assert.equal(showtimeStatus("2026-10-16", "07:30 PM", start - 1000), "Upcoming");
  assert.equal(showtimeStatus("2026-10-16", "07:30 PM", start + 30000), "Ongoing");
  assert.equal(showtimeStatus("2026-10-16", "07:30 PM", start + 4 * 3600000), "Finished");
});
test("new screenings default to the next future slot in Manila time", () => {
  const now = showtimeTimestamp("2026-10-16", "04:30 PM") + 1;
  assert.deepEqual(nextShowtimeSlot(now), { date: "2026-10-16", time: "07:30 PM" });
  assert.deepEqual(nextShowtimeSlot(showtimeTimestamp("2026-10-16", "07:30 PM")), { date: "2026-10-17", time: "10:30 AM" });
});
test("cancelled bookings free up their demo seats", () => {
  const b = readStore().bookings[0];
  const records: DemoBooking[] = [{ ...b, id: "test-1", seats: ["A1"], status: "Confirmed" }, { ...b, id: "test-2", seats: ["B2"], status: "Cancelled" }];
  const seats = reservedSeats(records, b.movieId, b.cinema, b.date, b.time);
  assert.equal(seats.has("A1"), true);
  assert.equal(seats.has("B2"), false);
});
test("pagination and email validation", () => {
  assert.deepEqual(pageItems([1, 2, 3, 4, 5], 2, 2), [3, 4]);
  assert.equal(pageCount(17, 8), 3);
  assert.equal(isEmail("guest@moviex.demo"), true);
  assert.equal(isEmail("not-an-email"), false);
});
