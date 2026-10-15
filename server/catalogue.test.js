import test from "node:test";
import assert from "node:assert/strict";
import { findInventoryMovie } from "./catalogue.js";
import { bookingSamples } from "./booking-samples.js";

test("catalogue listings link only to one exact title and year in booking inventory", () => {
  const listing = { title: "Beware Boiúna", year: 2026 };
  const inventory = [{ id: 1, title: "Beware Boiuna", year: 2026 }, { id: 2, title: "Beware Boiúna", year: 2025 }];
  assert.equal(findInventoryMovie(listing, inventory)?.id, 1);
  assert.equal(findInventoryMovie(listing, [...inventory, { id: 3, title: listing.title, year: listing.year }]), null);
  assert.equal(findInventoryMovie(listing, inventory.slice(1)), null);
});

test("every featured film has one matching MovieX booking record", () => {
  assert.equal(bookingSamples.length, 7);
  for (const movie of bookingSamples) assert.equal(findInventoryMovie(movie, bookingSamples)?.id, movie.id);
});
