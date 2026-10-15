// @ts-ignore Node supplies the test runner.
import { test } from "node:test";
// @ts-ignore Node supplies assertions.
import assert from "node:assert/strict";
import {
  adjacentMovie,
  getMovies,
  samples,
  validateMovie,
} from "./catalogue.ts";

test("catalogue validates fields and rejects unsafe image protocols", () => {
  assert.equal(validateMovie(samples[0]).id, 693134);
  assert.throws(() => validateMovie({ ...samples[0], title: undefined }));
  assert.throws(() => validateMovie({ ...samples[0], runtime: -1 }));
  assert.throws(() =>
    validateMovie({ ...samples[0], poster: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    validateMovie({ ...samples[0], backdrop: "//untrusted.example/image.jpg" }),
  );
  assert.throws(() =>
    validateMovie({ ...samples[0], logo: "javascript:alert(1)" }),
  );
  assert.equal(validateMovie({ ...samples[0], logo: null }).logo, null);
  assert.equal(
    validateMovie({
      ...samples[0],
      logo: "https://image.tmdb.org/t/p/original/movie.png",
    }).logo,
    "https://image.tmdb.org/t/p/original/movie.png",
  );
});

test("featured navigation wraps in both directions and handles empty lists", () => {
  assert.equal(adjacentMovie(samples, samples[0].id, -1)?.id, samples[4].id);
  assert.equal(adjacentMovie(samples, samples[4].id, 1)?.id, samples[0].id);
  assert.equal(adjacentMovie(samples, samples[0].id, 1)?.id, samples[1].id);
  assert.equal(
    adjacentMovie([samples[0]], samples[0].id, 1)?.id,
    samples[0].id,
  );
  assert.equal(adjacentMovie([], 1, 1), undefined);
  assert.equal(adjacentMovie(samples, -1, 1)?.id, samples[0].id);
  assert.ok(samples.every((movie) => movie.logo));
});

test("catalogue handles success, empty results, network errors and invalid responses", async () => {
  const originalFetch = globalThis.fetch;
  const signal = new AbortController().signal;
  try {
    globalThis.fetch = async () => Response.json({ results: [samples[0]] });
    assert.equal((await getMovies("", signal))[0].title, "Dune: Part Two");
    globalThis.fetch = async () => Response.json({ results: [] });
    assert.deepEqual(await getMovies("missing", signal), []);
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(getMovies("", signal), /couldn’t load/);
    globalThis.fetch = async () => Response.json({ wrong: [] });
    await assert.rejects(getMovies("", signal), /unexpected response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
