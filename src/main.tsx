import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Users,
} from "@phosphor-icons/react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "./style.css";
import {
  adjacentMovie,
  samples,
  type Movie,
} from "./catalogue";
import { money, PRICE, toggleSeat } from "./booking";
import { DemoWorkspace } from "./DemoWorkspace";
import { api, type ApiUser } from "./api";
import { showtimeStatus, showtimeTimestamp, type DemoBooking, type DemoStore, type DemoShowtime, type PaymentPlan } from "./demoStore";

type Screen =
  | "home"
  | "details"
  | "showtimes"
  | "seats"
  | "payment"
  | "confirmation"
  | "tickets"
  | "about"
  | "workspace";
type Booking = {
  movie: Movie;
  date: string;
  cinema: string;
  time: string;
  seats: string[];
  method: string;
  reference?: string;
  paymentPlan?: PaymentPlan;
  hall?: string;
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
  return failed || !src?.trim() ? (
    <div className={`image-fallback movie-art-placeholder ${className}`} role="img" aria-label={alt ? `Artwork unavailable: ${alt}` : "Movie artwork unavailable"}>
      <FilmSlate size={36} aria-hidden="true" />
      {alt && <span>{alt}</span>}
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
  const [screen, setScreen] = useState<Screen>(() => ["admin", "staff"].includes(new URLSearchParams(window.location.search).get("access") || "") ? "workspace" : "home");
  const [moviesActive, setMoviesActive] = useState(false);
  const [demoData, setDemoData] = useState<DemoStore>({ movies: [], showtimes: [], bookings: [] });
  const [movies, setMovies] = useState<Movie[]>([]);
  const [phMovies, setPhMovies] = useState<Movie[]>([]);
  const [phCatalogueError, setPhCatalogueError] = useState(false);
  const [account, setAccount] = useState<ApiUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [resumeCheckout, setResumeCheckout] = useState(false);
  const [movie, setMovie] = useState(samples[0]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All movies");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [date, setDate] = useState(dates()[0].value);
  const [cinema, setCinema] = useState("SM Mall of Asia");
  const [time, setTime] = useState("");
  const [selectedShowId, setSelectedShowId] = useState("");
  const [reserved, setReserved] = useState<Set<string>>(new Set());
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatReady, setSeatReady] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [seatRefresh, setSeatRefresh] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [seats, setSeats] = useState<string[]>([]);
  const [method, setMethod] = useState("Credit / Debit Card");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("Full");
  const [bookingError, setBookingError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [ticketMenuOpen, setTicketMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api<Movie[]>("/movies"), api<DemoShowtime[]>("/showtimes")])
      .then(([films, showtimes]) => {
        if (active) setDemoData((current) => ({ ...current, movies: films, showtimes }));
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not connect to the cinema database."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("moviex-api-token") || localStorage.getItem("moviex-api-token");
    if (!token) { setAuthChecked(true); return; }
    void api<{ user: ApiUser }>("/auth/me")
      .then(async ({ user }) => {
        if (!active) return;
        setAccount(user);
        const bookings = await api<DemoBooking[]>("/bookings");
        if (active) setDemoData((current) => ({ ...current, bookings }));
      })
      .catch(() => {
        if (!active) return;
        setAccount(null);
        sessionStorage.removeItem("moviex-api-token");
        localStorage.removeItem("moviex-api-token");
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (loading) return;
    let active = true;
    void api<{movies:Movie[]}>("/philippines/now-showing").then((result) => { if (active) { setPhMovies(result.movies); setPhCatalogueError(false); } }).catch(() => { if (active) { setPhMovies([]); setPhCatalogueError(true); } });
    return () => { active = false; };
  }, [retry, loading, demoData.movies, demoData.showtimes]);
  useEffect(() => {
    setMovies(demoData.movies);
    // Legacy MongoDB inventory is kept for staff/bookings, never used as the public hero.
  }, [demoData.movies]);
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
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  const openMovie = (m: Movie) => {
    setMovie(m);
    setSeats([]);
    setTime("");
    setSelectedShowId("");
    setScreen("details");
  };
  const go = (next: Screen) => {
    setSearchOpen(false);
    setMoviesActive(false);
    setScreen(next);
  };
  const handleAuthenticated = (user: ApiUser) => {
    setAccount(user);
    if (resumeCheckout && user.role === "customer") {
      setResumeCheckout(false);
      go("payment");
    }
  };
  const handleSignedOut = () => {
    setAccount(null);
    setDemoData((current) => ({ ...current, bookings: [] }));
    setBooking(null);
  };
  const connected = !error && demoData.movies.length > 0;
  const uniqueMovies = phMovies;
  const shown = uniqueMovies.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) &&
      (genre === "All movies" || m.genres.includes(genre)),
  );
  const genres = ["All movies", ...new Set(uniqueMovies.flatMap((m) => m.genres))];
  const featured = useMemo(() => phMovies, [phMovies]);
  useEffect(() => { if (phMovies.length) setMovie((current) => phMovies.find((item) => item.id === current.id) || phMovies[0]); }, [phMovies]);
  const bookingMovieId = movie.bookingMovieId;
  const movieHasShowtimes = bookingMovieId != null && demoData.showtimes.some((s) => s.movieId === bookingMovieId && showtimeStatus(s.date, s.time) === "Upcoming");
  const selectedShow = demoData.showtimes.find((s) => s.id === selectedShowId && s.movieId === bookingMovieId);
  const seatPrice = selectedShow?.price ?? PRICE;
  const seatTotal = seats.length * seatPrice;

  const amountDue = paymentPlan === "30% deposit" ? Math.round(seatTotal * 0.3 * 100) / 100 : seatTotal;
  const availableShowtimes = demoData.showtimes.filter((s) => s.movieId === bookingMovieId && s.cinema === cinema && s.date === date);
  useEffect(() => {
    if (screen !== "seats" || !selectedShow) return;
    let active = true;
    setSeatLoading(true);
    setSeatReady(false);
    setSeatError("");
    setReserved(new Set());
    const load = async () => {
      try {
        const result = await api<{ showtimeId: string; reserved: string[] }>("/showtimes/" + encodeURIComponent(selectedShow.id) + "/seats");
        if (active) {
          const taken = new Set(result.reserved);
          setReserved(taken);
          setSeatReady(true);
          setSeats((current) => current.filter((seat) => !taken.has(seat)));
          setSeatError("");
        }
      } catch (e) { if (active) setSeatError(e instanceof Error ? e.message : "Could not refresh seats."); }
      finally { if (active) setSeatLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 12000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [screen, selectedShowId, seatRefresh]);


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
  const submitBooking = async () => {
    setBookingError("");
    if (!selectedShow || !seats.length) return setBookingError("Choose a screening and at least one seat.");
    if (showtimeTimestamp(selectedShow.date, selectedShow.time) <= Date.now()) return setBookingError("That screening has already started. Choose another showtime.");
    if (!account || account.role !== "customer") return setBookingError("Sign in with a customer account before reserving seats.");
    if (seats.some((seat) => reserved.has(seat))) return setBookingError("A seat has already been reserved. Choose another seat.");
    setBookingBusy(true);
    try {
      const result = await api<DemoBooking>("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId: selectedShow.id, seats, method, paymentPlan }),
      });
      setDemoData((current) => ({ ...current, bookings: [result, ...current.bookings] }));
      setBooking({ movie, date: result.date, cinema: result.cinema, time: result.time,
        seats: result.seats, method: result.method, reference: result.id, paymentPlan: result.paymentPlan, hall: result.hall });
      go("confirmation");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Booking could not be completed";
      if (/seat|duplicate/i.test(message)) {
        setSeats([]);
        setSeatRefresh((n) => n + 1);
        go("seats");
        setBookingError("Those seats were just reserved by someone else. Please select different seats.");
      } else setBookingError(message);
    } finally { setBookingBusy(false); }
  };
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
        <p>{cinema} · {selectedShow?.hall ?? "Choose a screening"}</p>
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
            className={screen === "home" && !moviesActive ? "active" : ""}
            onClick={() => go("home")}
          >
            Home
          </button>
          <button
            className={screen === "home" && moviesActive ? "active" : ""}
            aria-current={screen === "home" && moviesActive ? "page" : undefined}
            onClick={() => {
              go("home");
              setMoviesActive(true);
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
          <div className={`ticket-menu ${ticketMenuOpen ? "is-open" : ""}`} onMouseLeave={() => setTicketMenuOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTicketMenuOpen(false); }}>
            <button className="ticket-nav icon-button" aria-label="My tickets" aria-haspopup="true" aria-expanded={ticketMenuOpen} title="My tickets" onClick={() => setTicketMenuOpen((open) => !open)}>
              <Ticket size={21} />
              {account?.role === "customer" && demoData.bookings.some((b) => b.status !== "Cancelled") && <span className="ticket-count">{demoData.bookings.filter((b) => b.status !== "Cancelled").length}</span>}
            </button>
            <div className="ticket-menu-popover" role="tooltip">
              <span className="ticket-menu-title">My tickets</span>
              <span className="ticket-menu-description">{booking ? `View your reservations and past orders.` : "View your bookings and ticket history."}</span>
              <button onClick={() => { setTicketMenuOpen(false); go("workspace"); }}>View my tickets <ArrowRight size={15} /></button>
            </div>
          </div>
          <button className={`icon-button workspace-account ${screen === "workspace" ? "active" : ""}`} aria-label="Open workspace" title="Workspace" onClick={() => go("workspace")}><Users size={21} weight="regular" /></button>
        </div>
      </header>
      <main id="main" tabIndex={-1} ref={mainRef}>
        {screen === "home" && (
          <>
            {phMovies.length > 0 && phMovies.some((item) => item.id === movie.id) ? <section
              className="hero"
              aria-label="Featured movie"
            >
              <MovieImage
                src={movie.backdrop}
                alt=""
                className="hero-art hero-fade hero-art-landscape"
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
              <div key={"hero-" + movie.id} className="hero-content hero-content-fade">
                <div className="eyebrow">THE BIG SCREEN IS CALLING</div>
                <MovieTitle key={"logo-" + movie.id + (movie.logo || "")} movie={movie} />
                <p>{movie.overview}</p>
                <div className="hero-actions">
                  <button
                    className="button light"
                    onClick={() => openMovie(movie)}
                  >
                    {movieHasShowtimes ? "Get Tickets" : "View Movie"} <ArrowRight size={19} />
                  </button>
                  {movie.trailerId && <button type="button" className="button hero-trailer-button" onClick={() => openMovie(movie)}>▶ Watch Trailer</button>}
                  <span className="hero-duration">
                    {durations(movie)}
                    <span> {movie.genres[0]}</span>
                  </span>
                </div>
              </div>
              <div className="hero-bottom">
                <span>
                  {connected ? "FEATURED RELEASE" : "MOVIEX CINEMA"}
                </span>
                <div className="feature-controls" aria-label="Featured movie">
                  {featured.map((m, i) => (
                    <button
                      key={"film-" + m.id}
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
                          <span key={"hero-" + movie.id} className="feature-fill" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section> : <section className="hero hero-catalogue-loading" aria-label="Featured movies loading"><div className="hero-loading-copy"><span className="eyebrow">MOVIEX · PHILIPPINES</span><h1>{phCatalogueError ? "Cinema listings unavailable" : "Loading Philippine cinema releases"}</h1><p>{phCatalogueError ? "Could not load the current cinema catalogue. The older demo movies will not be shown as current releases." : "Fetching the current movie selection…"}</p>{phCatalogueError && <button className="button light" onClick={() => setRetry((value) => value + 1)}>Retry loading</button>}</div></section>}
            <section className="catalogue" id="movies">
              <div className="section-heading">
                <div>
                  <h2>Now showing in the Philippines</h2><p>Selected Philippine cinema releases on October 15, 2026. Special screenings and rereleases are excluded. MovieX booking availability is separate.</p>
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
                  {phMovies.length ? "Philippine cinema releases · Oct 15, 2026" : connected ? "Cinema catalogue · MongoDB" : "Connecting to cinema database"}
                  <span className="toolbar-divider" />
                  {phMovies.length ? "Source: ClickTheCity · Special events excluded · No live ticket inventory" : connected ? "Seats and bookings are saved on the server" : "Check the database connection"}
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
                      key={"film-" + m.id}
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
                  MOVIE DETAILS ·{" "}
                  {movie.year}
                </span>
                <MovieTitle key={"logo-" + movie.id + (movie.logo || "")} movie={movie} />
                {meta(movie)}
                <p className="synopsis">{movie.overview}</p>
                {movieHasShowtimes ? <button className="button light" onClick={() => go("showtimes")}>Get Tickets <ArrowRight size={19} /></button> : <div className="ticket-unavailable" role="status"><button className="button light" disabled>Tickets unavailable</button><p className="note">{movie.bookingMovieId == null ? `${movie.title} is not in MovieX’s booking catalogue yet. An administrator can add the movie and its screenings.` : "There are no upcoming MovieX screenings for this film yet."}</p></div>}
                {movieHasShowtimes && <p className="note">Reservations are stored in MovieX. No payment is charged.</p>}
              </div>
            </div>
            <section className="trailer-section" aria-label="Movie trailer">
              <div className="trailer-heading">
                <span className="small-label">OFFICIAL TRAILER</span>
                <h2>Watch the trailer</h2>
                <p>Discover more about {movie.title}.</p>
              </div>
              {movie.trailerId ? (
                <div className="trailer-frame" key={"hero-" + movie.id}>
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
            <div className="demo-notice">Preview schedules reserve seats in MovieX only. No cinema ticket or payment is issued.</div>
            <div className="flow-grid">
              <div>
                <label className="field">
                  Cinema
                  <select
                    value={cinema}
                    onChange={(e) => {
                      setCinema(e.target.value);
                      setSelectedShowId("");
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
                        setSelectedShowId("");
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
                  {availableShowtimes.map((session) => (
                    <button
                      aria-pressed={selectedShowId === session.id}
                      key={session.id}
                      disabled={showtimeStatus(session.date, session.time) !== "Upcoming"}
                      className={selectedShowId === session.id ? "selected" : ""}
                      onClick={() => {
                        setTime(session.time);
                        setSelectedShowId(session.id);
                        setSeats([]);
                      }}
                    >
                      <span>
                        {session.time}
                        <small>2D · {session.hall} {showtimeStatus(session.date, session.time) !== "Upcoming" ? "· Unavailable" : ""}</small>
                      </span>
                      <span>
                        {money(session.price)}{" "}
                        {selectedShowId === session.id ? (
                          <Check size={18} />
                        ) : (
                          <ArrowRight size={18} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                {!availableShowtimes.length && <p className="note">No screenings are scheduled for this cinema and date. Try another day or location.</p>}
              </div>
              <aside className="order-panel">
                {summary()}
                <div className="panel-divider" />
                <p className="muted">Your movie night starts here.</p>
                <button
                  className="button light full"
                  disabled={!selectedShow || showtimeStatus(selectedShow.date, selectedShow.time) !== "Upcoming"}
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
            <div className="demo-notice">Seats marked unavailable are already reserved. Availability updates automatically and is confirmed when you book.</div>
            <div className="flow-grid seats-layout">
              <div className="auditorium">
                <div className="cinema-screen">
                  <span>SCREEN</span>
                </div>
                {seatError && <p className="checkout-error" role="alert">{seatError} <button className="text-button" onClick={() => setSeatRefresh((n) => n + 1)}>Retry</button></p>}
                {bookingError && <p className="checkout-error" role="alert">{bookingError}</p>}
                {seatLoading && <p className="note" role="status">Checking available seats…</p>}
                <div className="seat-map" aria-label="Select seats">
                  {"ABCDEFG".split("").map((row) => (
                    <div className="seat-row" key={row}>
                      <span>{row}</span>
                      {Array.from({ length: 10 }, (_, i) => {
                        const seat = `${row}${i + 1}`;
                        const blocked = !seatReady || seatLoading || Boolean(seatError) || reserved.has(seat);
                        return (
                          <button
                            key={seat}
                            aria-label={`Seat ${seat}${blocked ? ", unavailable" : ""}`}
                            aria-pressed={seats.includes(seat)}
                            disabled={blocked}
                            className={`${seats.includes(seat) ? "chosen" : ""} ${i === 4 ? "aisle" : ""}`}
                            onClick={() => setSeats((s) => s.length >= 8 && !s.includes(seat) ? s : toggleSeat(s, seat, reserved))}
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
                    {money(seatPrice)}
                  </span>
                  <strong>{money(seatTotal)}</strong>
                </div>
                <p className="note" aria-live="polite">
                  {seats.length
                    ? `Selected: ${seats.join(", ")}`
                    : "Select at least one seat to continue."}
                </p>
                <button
                  className="button light full"
                  disabled={!seats.length || !seatReady || seatLoading || Boolean(seatError)}
                  onClick={() => { setBookingError(""); go("payment"); }}
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
              <p>Review your seats and payment preference before requesting a booking.</p>
            </div>
            <div className="demo-notice">Bookings and seats are saved in MongoDB. Payment options record your preference only; no payments are processed.</div>
            <div className="flow-grid">
              <div>
                <div className="checkout-contact">
                  <h2 className="subheading">Booking account</h2>
                  <p className="note">{account?.role === "customer" ? "This reservation will be saved to your account." : "Sign in to save a reservation and access your tickets later."}</p>
                  <label>Full name<input value={account?.role === "customer" ? account.name : ""} placeholder="Sign in to continue" readOnly /></label>
                  <label>Email<input type="email" value={account?.role === "customer" ? account.email : ""} placeholder="Your account email" readOnly /></label>
                </div>
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
                <div className="checkout-plan"><h2 className="subheading">Payment option</h2>
                  <label><input type="radio" name="plan" checked={paymentPlan === "Full"} onChange={() => setPaymentPlan("Full")}/><span>Full amount <small>{money(seatTotal)} requested · Demo</small></span></label>
                  <label><input type="radio" name="plan" checked={paymentPlan === "30% deposit"} onChange={() => setPaymentPlan("30% deposit")}/><span>30% downpayment <small>{money(Math.round(seatTotal * 0.3 * 100) / 100)} requested now · Remaining {money(seatTotal - Math.round(seatTotal * 0.3 * 100) / 100)}</small></span></label>
                  <p className="note">No payment is collected; these are example amounts.</p>
                </div>
                <div className="payment-explanation">
                  <CheckCircle size={24} />
                  <div>
                    <h3>No payment will be charged</h3>
                    <p>Your payment choice is saved with the booking for the school project. A cinema administrator can confirm the request; payment processing is not connected.</p>
                  </div>
                </div>
              </div>
              <aside className="order-panel">
                {summary()}
                <div className="panel-divider" />
                <div className="price-row">
                  <span>Total · {seats.length} seats</span>
                  <strong>{money(seatTotal)}</strong>
                </div>
                <div className="price-row checkout-due"><span>{paymentPlan === "30% deposit" ? "Planned deposit" : "Planned amount"}</span><strong>{money(amountDue)}</strong></div>
                {bookingError && <p className="checkout-error" role="alert">{bookingError}</p>}
                <button
                  className="button light full"
                  disabled={bookingBusy || !authChecked}
                  onClick={() => { if (!account || account.role !== "customer") { setResumeCheckout(true); go("workspace"); } else void submitBooking(); }}
                >
                  {!authChecked ? "Checking account…" : bookingBusy ? "Saving booking…" : account?.role === "customer" ? "Reserve seats" : "Sign in to reserve"} <ArrowRight size={18} />
                </button>
                <p className="note centered">Seats reserved in MovieX · Payment is not collected.</p>
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
                    ? "Seats reserved."
                    : "A little escape awaits."}
                </h1>
                <p>Your reservation is saved in MovieX and awaiting administrator confirmation. No payment has been collected.</p>
                {booking.reference && <p className="booking-reference">Reference: <strong>{booking.reference}</strong></p>}
                <div className="ticket">
                  <div className="ticket-top">
                    <MovieImage
                      src={booking.movie.poster}
                      alt={booking.movie.title}
                    />
                    <div>
                      <span className="small-label">MOVIEX TICKET</span>
                      <h2>{booking.movie.title}</h2>
                      <p>{booking.cinema} · {booking.hall || "Cinema 5"}</p>
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
                    <span>Booking total</span>
                    <strong>{money(booking.seats.length * (demoData.showtimes.find((show) => show.movieId === booking.movie.id && show.cinema === booking.cinema && show.date === booking.date && show.time === booking.time)?.price ?? PRICE))}</strong>
                  </div>
                </div>
                {booking.paymentPlan && <p className="note">Payment choice: {booking.paymentPlan} (demo only; no payment collected).</p>}
                <button className="button light" onClick={() => go("home")}>
                  Back to movies <ArrowRight size={18} />
                </button>
                <button className="button outline" onClick={() => go("workspace")}>My tickets and order history <ArrowRight size={18}/></button>
                <p className="note">Saved in MongoDB. Payment is not processed by MovieX.</p>
              </>
            ) : (
              <div className="empty">
                <Ticket size={48} weight="thin" />
                <h1>Your next movie night awaits.</h1>
                <p>
                  Sign in to view your saved tickets and complete order history.
                </p>
                <button className="button light" onClick={() => go("home")}>
                  Explore movies <ArrowRight size={18} />
                </button>
                <button className="button outline" onClick={() => go("workspace")}>My tickets and order history <ArrowRight size={18}/></button>
              </div>
            )}
          </section>
        )}
        {screen === "workspace" && (
          <DemoWorkspace data={demoData} onChange={setDemoData} onBrowse={() => go("home")} onOpenMovie={openMovie} onAuthenticated={handleAuthenticated} onSignedOut={handleSignedOut} />
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
              effortless. This school project connects the movie catalogue,
              screenings, seat selection, and tickets to its database.
            </p>
            <div className="about-note">
              <h2>A preview, with room for the real thing.</h2>
              <p>
                The catalogue, showtimes, seat reservations and booking history are stored in MongoDB. Listings are seeded project data. Payments are simulated; no charges are made.
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
        <span className="footer-demo">MongoDB-backed bookings · Simulated payments</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
