export type Movie = {
  id: number;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  logo?: string | null;
  logoMonochrome?: boolean;
  trailerId?: string;
  genres: string[];
  runtime: number | null;
  rating: string | null;
  year: number;
};
export const samples: Movie[] = [
  {
    id: 693134,
    title: "Dune: Part Two",
    trailerId: "ekp7Lah6TL4",
    overview:
      "Paul Atreides joins the Fremen on a journey that will decide the fate of an empire.",
    poster: "/images/dune.jpg",
    backdrop: "/images/dune-backdrop.jpg",
    logo: "/logos/dune.png",
    genres: ["Science Fiction", "Adventure"],
    runtime: 167,
    rating: "PG-13",
    year: 2024,
  },
  {
    id: 157336,
    title: "Interstellar",
    trailerId: "zSWdZVtXT7E",
    overview:
      "A team of explorers travels beyond this galaxy to discover whether mankind has a future among the stars.",
    poster: "/images/interstellar.jpg",
    backdrop: "/images/interstellar-backdrop.jpg",
    logo: "/logos/interstellar.png",
    genres: ["Science Fiction", "Drama"],
    runtime: 169,
    rating: "PG-13",
    year: 2014,
  },
  {
    id: 414906,
    title: "The Batman",
    trailerId: "Wsw1lfHQIhs",
    overview:
      "A masked vigilante follows a trail of cryptic clues through the shadows of Gotham City.",
    poster: "/images/batman.jpg",
    backdrop: "/images/batman-backdrop.jpg",
    logo: "/logos/batman.png",
    genres: ["Crime", "Thriller"],
    runtime: 177,
    rating: "PG-13",
    year: 2022,
  },
  {
    id: 475557,
    title: "Joker",
    trailerId: "_OKAwz2MsJs",
    overview:
      "An aspiring comedian struggles to find his place in an increasingly fractured Gotham City.",
    poster: "/images/joker.jpg",
    backdrop: "/images/joker-backdrop.jpg",
    logo: "/logos/joker.png",
    logoMonochrome: true,
    genres: ["Drama", "Thriller"],
    runtime: 122,
    rating: "R",
    year: 2019,
  },
  {
    id: 746036,
    title: "The Fall Guy",
    trailerId: "j7jPnwVGdZ8",
    overview:
      "A stuntman returns to work and finds himself at the centre of a mystery far bigger than the movie.",
    poster: "/images/fallguy.jpg",
    backdrop: "/images/fallguy-backdrop.jpg",
    logo: "/logos/fallguy.png",
    genres: ["Action", "Comedy"],
    runtime: 126,
    rating: "PG-13",
    year: 2024,
  },
];
export const apiBase = (import.meta.env?.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
export function validateMovie(value: unknown): Movie {
  const m = value as Movie;
  if (
    !m ||
    !Number.isInteger(m.id) ||
    typeof m.title !== "string" ||
    !m.title ||
    typeof m.overview !== "string" ||
    !Array.isArray(m.genres) ||
    !m.genres.every((g) => typeof g === "string") ||
    !Number.isInteger(m.year) ||
    !(
      m.runtime === null ||
      (typeof m.runtime === "number" &&
        Number.isFinite(m.runtime) &&
        m.runtime > 0)
    ) ||
    !(m.rating === null || typeof m.rating === "string")
  )
    throw new Error("The catalogue returned incomplete movie information.");
  if (m.trailerId !== undefined && !/^[a-zA-Z0-9_-]{11}$/.test(m.trailerId))
    throw new Error("The catalogue returned an invalid trailer ID.");
  if (m.logoMonochrome !== undefined && typeof m.logoMonochrome !== "boolean")
    throw new Error("The catalogue returned an invalid logo style.");
  for (const path of [
    m.poster,
    m.backdrop,
    ...(m.logo == null ? [] : [m.logo]),
  ]) {
    if (
      typeof path !== "string" ||
      !(
        (path.startsWith("/") && !path.startsWith("//")) ||
        /^https:\/\//.test(path)
      )
    )
      throw new Error("The catalogue returned an invalid image URL.");
  }
  return m;
}
export function adjacentMovie(
  movies: Movie[],
  currentId: number,
  direction: -1 | 1,
): Movie | undefined {
  if (!movies.length) return undefined;
  const current = movies.findIndex((movie) => movie.id === currentId);
  if (current === -1)
    return direction === 1 ? movies[0] : movies[movies.length - 1];
  return movies[(current + direction + movies.length) % movies.length];
}
export async function getMovies(
  query: string,
  signal: AbortSignal,
): Promise<Movie[]> {
  const response = await fetch(
    `${apiBase}/movies?region=PH&language=en-US${query ? `&query=${encodeURIComponent(query)}` : ""}`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) },
  );
  if (!response.ok)
    throw new Error("We couldn’t load the movie catalogue. Please try again.");
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("results" in data) ||
    !Array.isArray(data.results)
  )
    throw new Error("The catalogue returned an unexpected response.");
  return data.results.map(validateMovie);
}
