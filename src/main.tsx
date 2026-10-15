import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  MagnifyingGlass,
  MapPin,
  Ticket,
  X,
  CaretDown,
  FilmSlate,
  Bank,
} from "@phosphor-icons/react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "./style.css";
import {
  adjacentMovie,
  apiBase,
  getMovies,
  samples,
  type Movie,
} from "./catalogue";
import { money, PRICE, total, toggleSeat, unavailable } from "./booking";

type Screen =
  | "home"
  | "details"
  | "showtimes"
  | "seats"
  | "payment"
  | "confirmation"
  | "tickets"
  | "about";
type Booking = {
  movie: Movie;
  date: string;
  cinema: string;
  time: string;
  seats: string[];
  method: string;
};
const durations = (m: Movie) =>
  m.runtime
    ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m`
    : "Runtime unavailable";
function dates() {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    return {
      value: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
      day:
        i === 0
          ? "Today"
          : d.toLocaleDateString("en-PH", {
              weekday: "short",
              timeZone: "Asia/Manila",
            }),
      label: d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }),
    };
  });
}
function MovieImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div className={`image-fallback ${className}`}>
      <FilmSlate size={36} />
      <span>{alt}</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
function MovieTitle({ movie }: { movie: Movie }) {
  const [failed, setFailed] = useState(false);
  return (
    <h1 className={movie.logo && !failed ? "logo-title" : ""}>
      {movie.logo && !failed ? (
        <>
          <span className="sr-only">{movie.title}</span>
          <img
            className={`movie-logo ${movie.logoMonochrome ? "monochrome" : ""}`}
            src={movie.logo}
            alt=""
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        movie.title
      )}
    </h1>
  );
}
function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [movies, setMovies] = useState<Movie[]>(samples);
  const [movie, setMovie] = useState(samples[0]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All movies");
  const [loading, setLoading] = useState(Boolean(apiBase));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [date, setDate] = useState(dates()[0].value);
  const [cinema, setCinema] = useState("SM Mall of Asia");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState<string[]>([]);
  const [method, setMethod] = useState("Credit / Debit Card");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title =
      screen === "home"
        ? "MOVIEX — Make it a movie night."
        : `${screen === "details" ? movie.title : screen[0].toUpperCase() + screen.slice(1)} — MOVIEX`;
  }, [screen, movie.title]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [screen]);
  useEffect(() => {
    if (!apiBase || screen !== "home") return;
    const controller = new AbortController();
    const fetchCatalogue = () => {
      setLoading(true);
      setError("");
      getMovies(query, controller.signal)
        .then((data) => {
          setMovies(data);
          if (!query && data.length)
            setMovie(
              (current) => data.find((m) => m.id === current.id) ?? data[0],
            );
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };
    const debounce = window.setTimeout(fetchCatalogue, 300);
    const interval = window.setTimeout(() => {
      if (document.visibilityState === "visible") fetchCatalogue();
    }, 900000);
    return () => {
      controller.abort();
      clearTimeout(debounce);
      clearInterval(interval);
    };
  }, [query, retry, screen]);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  const openMovie = (m: Movie) => {
    setMovie(m);
    setSeats([]);
    setTime("");
    setScreen("details");
  };
  const go = (next: Screen) => {
    setSearchOpen(false);
    setScreen(next);
  };
  const connected = Boolean(apiBase) && movies !== samples;
  const shown = movies.filter(
    (m) =>
      (apiBase || m.title.toLowerCase().includes(query.toLowerCase())) &&
      (genre === "All movies" || m.genres.includes(genre)),
  );
  const genres = ["All movies", ...new Set(movies.flatMap((m) => m.genres))];
  const featured = movies.slice(0, 5);


  const changeFeature = (direction: -1 | 1) => {
    setMovie(
      (current) => adjacentMovie(featured, current.id, direction) ?? current,
    );
  };

  useEffect(() => {
    if (screen !== "home" || featured.length < 2) return;
    const timer = window.setTimeout(() => {
      changeFeature(1);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [screen, featured, movie.id]);
  const meta = (m: Movie) => (
    <div className="movie-meta">
      {m.rating && <span className="certificate">{m.rating}</span>}
      <span>{durations(m)}</span>
      <span className="meta-divider" />
      <span>{m.genres.join(" · ")}</span>
    </div>
  );
  const back = (next: Screen) => (
    <button className="back" onClick={() => go(next)}>
      <ArrowLeft size={17} /> Back
    </button>
  );
  const summary = () => (
    <div className="booking-summary">
      <MovieImage src={movie.poster} alt={movie.title} />
      <div>
        <h3>{movie.title}</h3>
        <p>
          {date} · {time || "Choose a time"}
        </p>
        <p>{cinema} · Cinema 5</p>
        {seats.length > 0 && <p>Seats: {seats.join(", ")}</p>}
      </div>
    </div>
  );
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="header">
        <button
          className="wordmark"
          aria-label="MOVIEX home"
          onClick={() => go("home")}
        >
          MOVIE<span>X</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={screen === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            Home
          </button>
          <button
            onClick={() => {
              go("home");
              setTimeout(
                () =>
                  document
                    .getElementById("movies")
                    ?.scrollIntoView({ behavior: "smooth" }),
                60,
              );
            }}
          >
            Movies
          </button>
          <button
            className={screen === "about" ? "active" : ""}
            onClick={() => go("about")}
          >
            About
          </button>
        </nav>
        <div className="nav-tools">
          <span className="location">
            <MapPin size={15} /> Philippines
          </span>
          <button
            className="icon-button"
            aria-label="Search movies"
            onClick={() => {
              go("home");
              setSearchOpen(true);
              setTimeout(
                () =>
                  document
                    .getElementById("movies")
                    ?.scrollIntoView({ behavior: "smooth" }),
                60,
              );
            }}
          >
            <MagnifyingGlass size={21} />
          </button>
          <button
            className="ticket-nav"
            aria-label="My tickets"
            onClick={() => go("tickets")}
          >
            <Ticket size={19} />
            <span>My tickets</span>
            {booking && <span className="ticket-count">1</span>}
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1} ref={mainRef}>
        {screen === "home" && (
          <>
            <section
              className="hero"
              aria-label="Featured movie"
            >
              <MovieImage
                key={movie.id}
                src={movie.backdrop}
                alt=""
                className="hero-art hero-fade"
              />
              <div className="hero-shade" />
              <div
                className="hero-navigation"
                aria-label="Featured movie navigation"
              >
                <button
                  className="hero-arrow"
                  aria-label="Previous movie"
                  disabled={featured.length < 2}
                  onClick={() => changeFeature(-1)}
                >
                  <ArrowLeft size={22} />
                </button>
                <button
                  className="hero-arrow"
                  aria-label="Next movie"
                  disabled={featured.length < 2}
                  onClick={() => changeFeature(1)}
                >
                  <ArrowRight size={22} />
                </button>
              </div>
              <div key={movie.id} className="hero-content hero-content-fade">
                <div className="eyebrow">THE BIG SCREEN IS CALLING</div>
                <MovieTitle key={movie.id + (movie.logo || "")} movie={movie} />
                <p>{movie.overview}</p>
                <div className="hero-actions">
                  <button
                    className="button light"
                    onClick={() => openMovie(movie)}
                  >
                    Get Tickets <ArrowRight size={19} />
                  </button>
                  <span className="hero-duration">
                    {durations(movie)}
                    <span> {movie.genres[0]}</span>
                  </span>
                </div>
              </div>
              <div className="hero-bottom">
                <span>
                  {connected
                    ? "FEATURED RELEASE"
                    : "FROM OUR SAMPLE COLLECTION"}
                </span>
                <div className="feature-controls" aria-label="Featured movie">
                  {featured.map((m, i) => (
                    <button
                      key={m.id}
                      aria-label={`Feature ${m.title}`}
                      aria-pressed={movie.id === m.id}
                      className={movie.id === m.id ? "current" : ""}
                      onClick={() => setMovie(m)}
                    >
                      <span className="feature-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="feature-track" aria-hidden="true">
                        {movie.id === m.id && (
                          <span key={movie.id} className="feature-fill" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="catalogue" id="movies">
              <div className="section-heading">
                <div>
                  <h2>{apiBase ? "Now showing" : "Find your next escape."}</h2>
                  <p>
                    {apiBase
                      ? "Discover current releases in the Philippines."
                      : "A few big-screen favourites to explore the experience."}
                  </p>
                </div>
                <label className="genre-select">
                  <span className="sr-only">Filter by genre</span>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  >
                    {genres.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  <CaretDown size={14} />
                </label>
              </div>
              <div className="catalogue-toolbar">
                <span className="data-label">
                  {connected ? "Movie catalogue connected" : "Sample catalogue"}
                  <span className="toolbar-divider" />
                  {apiBase
                    ? "Bookings are a demo"
                    : "Live catalogue coming with backend connection"}
                </span>
                <button
                  className="text-button"
                  onClick={() => setSearchOpen(!searchOpen)}
                >
                  <MagnifyingGlass size={17} /> Search movies
                </button>
              </div>
              {searchOpen && (
                <div className="search-box">
                  <label htmlFor="movie-search">Search the catalogue</label>
                  <div>
                    <MagnifyingGlass size={20} />
                    <input
                      ref={searchRef}
                      id="movie-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search a movie title…"
                    />
                    <button
                      className="icon-button"
                      aria-label="Clear and close search"
                      onClick={() => {
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
              {error ? (
                <div role="alert" className="empty">
                  <h3>The catalogue is taking an intermission.</h3>
                  <p>{error}</p>
                  <button
                    className="button outline"
                    onClick={() => setRetry((r) => r + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : loading ? (
                <div className="movie-grid" aria-label="Loading movies">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              ) : shown.length ? (
                <div className="movie-grid">
                  {shown.map((m) => (
                    <button
                      className="movie-card"
                      onClick={() => openMovie(m)}
                      key={m.id}
                    >
                      <div className="poster-wrap">
                        <MovieImage src={m.poster} alt={`${m.title} poster`} />
                        <span className="poster-cta">
                          Explore movie <ArrowRight size={18} />
                        </span>
                      </div>
                      <div className="card-title">
                        <h3>{m.title}</h3>
                        <ArrowRight size={16} />
                      </div>
                      <p>{m.genres.join(" · ")}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <h3>No movies found.</h3>
                  <p>Try another title or genre.</p>
                  <button
                    className="button outline"
                    onClick={() => {
                      setQuery("");
                      setGenre("All movies");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
            <section className="closing">
              <FilmSlate size={28} weight="light" />
              <p>
                Some stories deserve
                <br />
                <span>a bigger screen.</span>
              </p>
              <span>Find a film. Pick your seat. Get lost in the story.</span>
            </section>
          </>
        )}
        {screen === "details" && (
          <section className="inner-page">
            {back("home")}
            <div className="detail-grid">
              <div className="detail-poster">
                <MovieImage src={movie.poster} alt={movie.title} />
              </div>
              <div className="detail-copy">
                <span className="small-label">
                  {apiBase ? "MOVIE DETAILS" : "SAMPLE COLLECTION"} ·{" "}
                  {movie.year}
                </span>
                <MovieTitle key={movie.id + (movie.logo || "")} movie={movie} />
                {meta(movie)}
                <p className="synopsis">{movie.overview}</p>
                <button
                  className="button light"
                  onClick={() => go("showtimes")}
                >
                  Get Tickets <ArrowRight size={19} />
                </button>
                <p className="note">
                  Explore a sample booking. No purchase required.
                </p>
              </div>
            </div>
            <section className="trailer-section" aria-label="Movie trailer">
              <div className="trailer-heading">
                <span className="small-label">OFFICIAL TRAILER</span>
                <h2>Watch the trailer</h2>
                <p>Discover more about {movie.title}.</p>
              </div>
              {movie.trailerId ? (
                <div className="trailer-frame" key={movie.id}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${movie.trailerId}?rel=0`}
                    title={`${movie.title} trailer`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="trailer-unavailable">
                  <p>Trailer is not available in this preview.</p>
                  <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} ${movie.year} official trailer`)}`} target="_blank" rel="noopener noreferrer">Find trailer on YouTube</a>
                </div>
              )}
            </section>          </section>
        )}
        {screen === "showtimes" && (
          <section className="inner-page booking-page">
            {back("details")}
            <div className="page-heading">
              <span className="small-label">01 / PLAN YOUR VISIT</span>
              <h1>Make a night of it.</h1>
              <p>Choose your cinema, day, and showtime.</p>
            </div>
            <div className="demo-notice">
              Demo booking · All cinemas, showtimes, seats, and prices below are
              examples.
            </div>
            <div className="flow-grid">
              <div>
                <label className="field">
                  Cinema
                  <select
                    value={cinema}
                    onChange={(e) => {
                      setCinema(e.target.value);
                      setTime("");
                      setSeats([]);
                    }}
                  >
                    <option>SM Mall of Asia</option>
                    <option>SM Megamall</option>
                    <option>Ayala Malls Manila Bay</option>
                  </select>
                </label>
                <h2 className="subheading">Select a date</h2>
                <div className="date-list">
                  {dates().map((d) => (
                    <button
                      aria-pressed={date === d.value}
                      className={date === d.value ? "selected" : ""}
                      key={d.value}
                      onClick={() => {
                        setDate(d.value);
                        setTime("");
                        setSeats([]);
                      }}
                    >
                      <strong>{d.day}</strong>
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
                <h2 className="subheading">Select a showtime</h2>
                <div className="time-list">
                  {["10:30 AM", "01:30 PM", "04:30 PM", "07:30 PM"].map((t) => (
                    <button
                      aria-pressed={time === t}
                      key={t}
                      className={time === t ? "selected" : ""}
                      onClick={() => {
                        setTime(t);
                        setSeats([]);
                      }}
                    >
                      <span>
                        {t}
                        <small>2D · Cinema 5</small>
                      </span>
                      <span>
                        {money(PRICE)}{" "}
                        {time === t ? (
                          <Check size={18} />
                        ) : (
                          <ArrowRight size={18} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <aside className="order-panel">
                {summary()}
                <div className="panel-divider" />
                <p className="muted">Your movie night starts here.</p>
                <button
                  className="button light full"
                  disabled={!time}
                  onClick={() => go("seats")}
                >
                  Choose seats <ArrowRight size={18} />
                </button>
              </aside>
            </div>
          </section>
        )}
        {screen === "seats" && (
          <section className="inner-page booking-page">
            {back("showtimes")}
            <div className="page-heading">
              <span className="small-label">
                02 / THE BEST SEAT IN THE HOUSE
              </span>
              <h1>Find your spot.</h1>
              <p>
                {movie.title} · {cinema} · {time}
              </p>
            </div>
            <div className="demo-notice">
              Demo seating · These seats do not represent real availability.
            </div>
            <div className="flow-grid seats-layout">
              <div className="auditorium">
                <div className="cinema-screen">
                  <span>SCREEN</span>
                </div>
                <div className="seat-map" aria-label="Select seats">
                  {"ABCDEFG".split("").map((row) => (
                    <div className="seat-row" key={row}>
                      <span>{row}</span>
                      {Array.from({ length: 10 }, (_, i) => {
                        const seat = `${row}${i + 1}`;
                        return (
                          <button
                            key={seat}
                            aria-label={`Seat ${seat}${unavailable.has(seat) ? ", unavailable" : ""}`}
                            aria-pressed={seats.includes(seat)}
                            disabled={unavailable.has(seat)}
                            className={`${seats.includes(seat) ? "chosen" : ""} ${i === 4 ? "aisle" : ""}`}
                            onClick={() => setSeats((s) => toggleSeat(s, seat))}
                          >
                            <span className="seat-back" aria-hidden="true">
                              {seats.includes(seat) ? (
                                <Check weight="bold" />
                              ) : (
                                i + 1
                              )}
                            </span>
                            <span className="seat-cushion" aria-hidden="true" />
                          </button>
                        );
                      })}
                      <span>{row}</span>
                    </div>
                  ))}
                </div>
                <div className="seat-legend">
                  <span>
                    <i /> Available
                  </span>
                  <span>
                    <i className="chosen" /> Selected
                  </span>
                  <span>
                    <i className="taken" /> Unavailable
                  </span>
                </div>
              </div>
              <aside className="order-panel">
                {summary()}
                <div className="panel-divider" />
                <div className="price-row">
                  <span>
                    {seats.length} {seats.length === 1 ? "seat" : "seats"} ×{" "}
                    {money(PRICE)}
                  </span>
                  <strong>{money(total(seats))}</strong>
                </div>
                <p className="note" aria-live="polite">
                  {seats.length
                    ? `Selected: ${seats.join(", ")}`
                    : "Select at least one seat to continue."}
                </p>
                <button
                  className="button light full"
                  disabled={!seats.length}
                  onClick={() => go("payment")}
                >
                  Continue <ArrowRight size={18} />
                </button>
              </aside>
            </div>
          </section>
        )}
        {screen === "payment" && (
          <section className="inner-page booking-page">
            {back("seats")}
            <div className="page-heading">
              <span className="small-label">03 / ONE LAST THING</span>
              <h1>Your movie night, sorted.</h1>
              <p>Review your sample booking and choose a payment method.</p>
            </div>
            <div className="demo-notice">
              Demo checkout · No payment is collected. Do not enter financial
              information.
            </div>
            <div className="flow-grid">
              <div>
                <fieldset className="payment-methods">
                  <legend>Payment method</legend>
                  {[
                    "Credit / Debit Card",
                    "GCash",
                    "Maya",
                    "Bank Transfer",
                  ].map((m) => (
                    <label key={m}>
                      <input
                        type="radio"
                        name="method"
                        value={m}
                        checked={method === m}
                        onChange={() => setMethod(m)}
                      />
                      <span>{m}</span>
                      <span
                        className={`payment-logos ${m === "Credit / Debit Card" ? "card-brands" : ""}`}
                        aria-hidden="true"
                      >
                        {m === "Credit / Debit Card" ? (
                          <>
                            <span className="visa-brand">
                              <img src="/logos/visa.png" alt="" />
                            </span>
                            <img
                              className="mastercard-brand"
                              src="/logos/mastercard.svg"
                              alt=""
                            />
                          </>
                        ) : m === "GCash" ? (
                          <img
                            className="gcash-brand"
                            src="/logos/gcash.svg"
                            alt=""
                          />
                        ) : m === "Maya" ? (
                          <img
                            className="maya-brand"
                            src="/logos/maya.svg"
                            alt=""
                          />
                        ) : (
                          <Bank size={25} weight="light" />
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="payment-detail" aria-live="polite">
                  {method === "Credit / Debit Card" ? (
                    <div className="payment-demo-form">
                      <h3>Card payment preview</h3>
                      <p>Sample fields for layout testing. Never enter actual card information.</p>
                      <label>Cardholder name<input type="text" placeholder="Sample Customer" autoComplete="off" /></label>
                      <label>Card number<input type="text" placeholder="•••• •••• •••• 4242 (sample)" readOnly aria-label="Sample card number" /></label>
                      <div className="payment-demo-row">
                        <label>Expiration<input type="text" placeholder="MM / YY (sample)" readOnly /></label>
                        <label>Security code<input type="text" placeholder="••• (sample)" readOnly /></label>
                      </div>
                    </div>
                  ) : (
                    <div className="payment-provider-preview">
                      <h3>{method} checkout</h3>
                      <p>{method === "Bank Transfer" ? "Bank instructions will appear here when a payment provider is connected." : `You'll be redirected to ${method}'s secure payment page when a payment provider is connected.`}</p>
                      <span className="provider-preview-badge">Demo mode · No external redirect</span>
                    </div>
                  )}
                </div>                <div className="payment-explanation">
                  <CheckCircle size={24} />
                  <div>
                    <h3>You’re trying the booking experience.</h3>
                    <p>
                      In the connected version, your cinema’s secure payment
                      provider will handle payment. This preview simply creates
                      a sample ticket.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="order-panel">
                {summary()}
                <div className="panel-divider" />
                <div className="price-row">
                  <span>Total · {seats.length} seats</span>
                  <strong>{money(total(seats))}</strong>
                </div>
                <button
                  className="button light full"
                  onClick={() => {
                    setBooking({
                      movie,
                      date,
                      cinema,
                      time,
                      seats: [...seats],
                      method,
                    });
                    go("confirmation");
                  }}
                >
                  Confirm demo booking <ArrowRight size={18} />
                </button>
                <p className="note centered">No charge. No real reservation.</p>
              </aside>
            </div>
          </section>
        )}
        {(screen === "confirmation" || screen === "tickets") && (
          <section className="ticket-page">
            {screen === "tickets" && back("home")}
            {booking ? (
              <>
                <CheckCircle
                  size={62}
                  weight="thin"
                  className="confirmation-icon"
                />
                <span className="small-label">
                  {screen === "confirmation"
                    ? "YOU’RE ALL SET"
                    : "YOUR SAMPLE TICKET"}
                </span>
                <h1>
                  {screen === "confirmation"
                    ? "Movie night is on."
                    : "A little escape awaits."}
                </h1>
                <p>This is a demo ticket. No seats have been reserved.</p>
                <div className="ticket">
                  <div className="ticket-top">
                    <MovieImage
                      src={booking.movie.poster}
                      alt={booking.movie.title}
                    />
                    <div>
                      <span className="small-label">MOVIEX · DEMO</span>
                      <h2>{booking.movie.title}</h2>
                      <p>{booking.cinema} · Cinema 5</p>
                    </div>
                  </div>
                  <div className="ticket-details">
                    <div>
                      <span>DATE</span>
                      <strong>{booking.date}</strong>
                    </div>
                    <div>
                      <span>TIME</span>
                      <strong>{booking.time}</strong>
                    </div>
                    <div>
                      <span>SEATS</span>
                      <strong>{booking.seats.join(", ")}</strong>
                    </div>
                  </div>
                  <div className="ticket-bottom">
                    <span>Sample total</span>
                    <strong>{money(total(booking.seats))}</strong>
                  </div>
                </div>
                <button className="button light" onClick={() => go("home")}>
                  Back to movies <ArrowRight size={18} />
                </button>
                <p className="note">
                  Ticket stays in this preview until the page is refreshed.
                </p>
              </>
            ) : (
              <div className="empty">
                <Ticket size={48} weight="thin" />
                <h1>Your next movie night awaits.</h1>
                <p>
                  Try a demo booking and your sample ticket will appear here.
                </p>
                <button className="button light" onClick={() => go("home")}>
                  Explore movies <ArrowRight size={18} />
                </button>
              </div>
            )}
          </section>
        )}
        {screen === "about" && (
          <section className="inner-page about-page">
            {back("home")}
            <FilmSlate size={42} weight="thin" />
            <h1>
              For the love
              <br />
              of the big screen.
            </h1>
            <p>
              MOVIEX makes finding a film and choosing your seat feel
              effortless. This frontend preview explores the complete
              cinema-booking journey.
            </p>
            <div className="about-note">
              <h2>A preview, with room for the real thing.</h2>
              <p>
                {apiBase
                  ? "The movie catalogue is connected to a backend proxy."
                  : "The catalogue currently uses a sample collection of films, not current Philippine cinema listings."}{" "}
                Cinema schedules, prices, seating, and checkout are
                demonstrations.
              </p>
              <p>
                Movie information and images are sourced from TMDB. This product
                uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
              <a
                className="tmdb-logo"
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noreferrer"
                aria-label="The Movie Database"
              >
                <img src="/images/tmdb.svg" alt="The Movie Database (TMDB)" />
              </a>
            </div>
          </section>
        )}
      </main>
      <footer>
        <button className="wordmark" onClick={() => go("home")}>
          MOVIE<span>X</span>
        </button>
        <span>A better way to movie night.</span>
        <button onClick={() => go("about")}>
          About & credits <ArrowRight size={14} />
        </button>
        <span className="footer-demo">Frontend preview · Demo bookings</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
