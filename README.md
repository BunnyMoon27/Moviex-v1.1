# MOVIEX

A standalone React + TypeScript cinema frontend, inspired by the supplied MOVIEX reference. Dark surfaces, cinematic artwork, responsive layouts, and a complete demo booking journey.

## Run locally

Use Node.js 22.12+ (or Node 24 LTS) and npm.

```sh
npm install
npm run dev -- --port 5173
```

Open http://127.0.0.1:5173/. To verify: `npm test` and `npm run build`. The deployable frontend is generated in `dist/`.

## Connect your existing backend

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the public base URL of your backend proxy, such as `https://your-backend.example/api`. Restart the dev server after changes. This value is public browser configuration; **never put a TMDB credential in a VITE variable**.

The frontend calls:

```text
GET {base}/movies?region=PH&language=en-US
GET {base}/movies?region=PH&language=en-US&query=search%20text
```

Return a JSON object with a `results` array. Each item has this shape:

```json
{
  "id": 693134,
  "title": "Dune: Part Two",
  "overview": "Movie synopsis.",
  "poster": "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w1280/uhUO7vQQKvCTfQWubOt5MAKokbL.jpg",
  "logo": "https://image.tmdb.org/t/p/original/your-transparent-logo.png",
  "logoMonochrome": false,
  "genres": ["Science Fiction", "Adventure"],
  "runtime": 167,
  "rating": "PG-13",
  "year": 2024
}
```

Use `null` for unknown runtime or rating; use an empty genres array if unknown. Images accept HTTPS URLs or root-relative frontend paths. The proxy should map TMDB fields to this contract, resolve genre IDs, and enrich runtime/rating from details where available. Do not substitute viewer scores for age certificates. Keep the TMDB credential on the server. The backend must allow the frontend origin through CORS; the default local origin is `http://127.0.0.1:5173`. Existing endpoint names can instead be mapped in `src/catalogue.ts`.

### Automatic movie logos

Every movie uses the same title component in the hero and details page. The optional `logo` field is a transparent image URL; new movie records work without frontend code changes. `logoMonochrome: true` displays an originally black monochrome logo in white; otherwise original colors are retained. Missing or broken images fall back to accessible title text.

For automatic live enrichment, your backend proxy should request TMDB `/movie/{id}/images?include_image_language=en,null`, select an English logo (then an unlabelled logo if no English one exists), and return its full image URL as `logo`. Cache these records on the backend. Return null when no logo exists; never substitute another film's artwork. This repository implements the frontend consumption, not a replacement backend or a bundled TMDB credential.

Hero arrows navigate through the first five catalogue films and wrap at both ends. The numbered selectors identify the active film. The header stays fixed, and in-page navigation accounts for its height.

With no backend URL, the frontend explicitly displays its sample catalogue. Configuring a backend enables debounced search and catalogue refresh every 15 minutes while visible. Requests time out after 12 seconds; loading, retry, empty results, and invalid responses are handled in the UI. Details use complete movie records from the list, avoiding an unnecessary extra endpoint.

## Booking integration boundary

Booking is **always a demo** in this version, including when the movie catalogue is connected. Cinemas, dates, showtimes, unavailable seats, and the PHP 260 seat price are illustrative. Movie records retain TMDB IDs, but production bookings must map those IDs to your backend's cinema inventory IDs.

Before enabling real bookings, replace the sample schedule, seat availability, pricing, and local confirmation with your existing backend APIs. The backend must own seat holds, availability conflicts, expiration, authoritative totals, payment-session creation, and verified booking status. Use your payment provider's hosted checkout rather than collecting card information in this frontend. Never create a real ticket from a browser-only payment callback.

The preview retains only the latest sample ticket in memory. Refreshing clears it. There are no accounts, emails, real reservations, or charges. The source uses local screen state rather than URL routing, so browser reload starts at Home.

## Assets and credits

Movie posters/backdrops are downloaded TMDB images, stored locally so the sample catalogue works without third-party image requests. They remain the property of their respective owners. Demo ratings reproduce US certificates and are not Philippine MTRCB classifications. About & credits contains TMDB attribution and logo.

TMDB API authentication: https://developer.themoviedb.org/docs/authentication-application

TMDB attribution and commercial licensing: https://developer.themoviedb.org/docs/faq

No backend credential or commercial content license is bundled. Confirm appropriate data/artwork rights before commercial launch.

Design defaults: Outfit self-hosted font, near-black surfaces, white buttons, 6–8 px image/panel corners, pill buttons, and reduced-motion support. No backend, analytics, account system, or new payment infrastructure was added.
