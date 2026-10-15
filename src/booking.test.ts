// @ts-ignore Node supplies the test runner; no runtime dependency required.
import { test } from "node:test";
// @ts-ignore Node supplies assertions.
import assert from "node:assert/strict";
import { toggleSeat, total } from "./booking.ts";
test("select, deselect, reject unavailable and invalid seats, and calculate total", () => {
  let seats = toggleSeat([], "D6");
  seats = toggleSeat(seats, "D7");
  assert.equal(total(seats), 520);
  assert.deepEqual(toggleSeat(seats, "A3"), seats);
  assert.deepEqual(toggleSeat(seats, "Z99"), seats);
  assert.deepEqual(toggleSeat(seats, "D6"), ["D7"]);
  assert.equal(total([]), 0);
  assert.deepEqual(toggleSeat(["A10"], "A2"), ["A2", "A10"]);
});
