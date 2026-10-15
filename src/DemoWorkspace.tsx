import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarBlank, Check, CheckCircle, Clock, FilmSlate, MagnifyingGlass, PencilSimple, Plus, ShieldCheck, Eye, EyeSlash, SignOut, Ticket, Trash, Users, WarningCircle, X } from "@phosphor-icons/react";
import type { Movie } from "./catalogue";
import { money } from "./booking";
import { CINEMAS, SHOWTIMES, isEmail, pageCount, pageItems, phDate, showtimeStatus, showtimeTimestamp, uid, type BookingStatus, type DemoBooking, type DemoShowtime, type DemoStore, type Role } from "./demoStore";
import "./workspace.css";
import { api, signInApi, registerApi, type ApiUser } from "./api";
import { AccountManager } from "./AccountManager";

type Session = { role: Role; name: string; email: string };
type Props = { data: DemoStore; onChange: (d: DemoStore) => void; onBrowse: () => void; onOpenMovie: (m: Movie) => void; onAuthenticated: (user: ApiUser) => void; onSignedOut: () => void };
const roles: { id: Role; title: string }[] = [
  { id: "customer", title: "Customer" },
  { id: "employee", title: "Cinema staff" },
  { id: "admin", title: "Administrator" },
];
const dateLabel = (date: string) => new Date(date + "T12:00:00+08:00").toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const orderStatus = (s: string) => s === "Ongoing" ? 0 : s === "Upcoming" ? 1 : 2;
const statusTone = (s: string) => ["Confirmed", "Checked in", "Ongoing"].includes(s) ? "good" : ["Cancelled", "Finished"].includes(s) ? "quiet" : "waiting";
function Pill({ status }: { status: string }) { return <span className={"ws-pill " + statusTone(status)}><i />{status}</span>; }
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const count = pageCount(total);
  return count <= 1 ? null : <div className="ws-pager"><span>Page {Math.min(page, count)} of {count}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ArrowLeft /></button><button aria-label="Next page" disabled={page >= count} onClick={() => onChange(page + 1)}><ArrowRight /></button></div></div>;
}
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="ws-empty"><FilmSlate size={28}/><strong>{title}</strong><p>{detail}</p></div>; }
function Stat({ label, number, hint }: { label: string; number: string; hint: string }) { return <div className="ws-stat"><span>{label}</span><strong>{number}</strong><small>{hint}</small></div>; }

type MovieDraft = { title: string; year: number; runtime: number; genres: string; rating: string; overview: string; poster: string; backdrop: string; trailerId: string };
function FilmForm({ movie, onCancel, onSave }: { movie?: Movie; onCancel: () => void; onSave: (m: Movie) => Promise<void> }) {
  const [draft, setDraft] = useState<MovieDraft>(() => movie ? {
    title: movie.title, year: movie.year, runtime: movie.runtime || 120, genres: movie.genres.join(", "), rating: movie.rating || "",
    overview: movie.overview, poster: movie.poster, backdrop: movie.backdrop, trailerId: movie.trailerId || "",
  } : { title: "", year: new Date().getFullYear(), runtime: 120, genres: "Drama", rating: "PG-13", overview: "", poster: "", backdrop: "", trailerId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const field = (k: keyof MovieDraft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const validUrl = (u: string) => /^https:\/\/[^\s]+$/i.test(u) || u.startsWith("/") && !u.startsWith("//");
    if (draft.title.trim().length < 2) return setError("Movie title must have at least 2 characters.");
    if (!Number.isInteger(draft.year) || draft.year < 1890 || draft.year > 2100) return setError("Enter a valid release year.");
    if (!Number.isInteger(draft.runtime) || draft.runtime <= 0) return setError("Runtime must be a positive number of minutes.");
    if (draft.overview.trim().length < 12) return setError("Add a synopsis with at least 12 characters.");
    if (!validUrl(draft.poster) || !validUrl(draft.backdrop)) return setError("Artwork URLs must begin with https:// or /.");
    if (draft.trailerId && !/^[\w-]{11}$/.test(draft.trailerId)) return setError("Use the 11-character YouTube video ID.");
    const next: Movie = { id: movie?.id ?? Date.now(), title: draft.title.trim(), year: draft.year, runtime: draft.runtime, genres: draft.genres.split(",").map((s) => s.trim()).filter(Boolean), rating: draft.rating.trim() || null, overview: draft.overview.trim(), poster: draft.poster.trim(), backdrop: draft.backdrop.trim(), trailerId: draft.trailerId || undefined, logo: movie?.logo ?? null, logoMonochrome: movie?.logoMonochrome };
    setSaving(true);
    try { await onSave(next); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save movie."); }
    finally { setSaving(false); }
  };
  return <form className="ws-editor" onSubmit={save} noValidate>
    <div className="ws-editor-top"><div><span className="ws-eyebrow">MOVIE EDITOR</span><h3>{movie ? "Edit movie" : "Add movie"}</h3></div><button type="button" aria-label="Close editor" onClick={onCancel}><X /></button></div>
    <div className="ws-fields">
      <label className="wide">Title<input value={draft.title} onChange={(e) => field("title", e.target.value)} /></label>
      <label>Year<input type="number" value={draft.year} onChange={(e) => field("year", Number(e.target.value))}/></label>
      <label>Runtime, minutes<input type="number" value={draft.runtime} onChange={(e) => field("runtime", Number(e.target.value))}/></label>
      <label>Genres, separated by commas<input value={draft.genres} onChange={(e) => field("genres", e.target.value)}/></label>
      <label>Rating<input value={draft.rating} onChange={(e) => field("rating", e.target.value)}/></label>
      <label className="wide">Synopsis<textarea rows={3} value={draft.overview} onChange={(e) => field("overview", e.target.value)}/></label>
      <label className="wide">Poster URL<input value={draft.poster} placeholder="/images/poster.jpg or https://..." onChange={(e) => field("poster", e.target.value)}/></label>
      <label className="wide">Backdrop URL<input value={draft.backdrop} placeholder="/images/backdrop.jpg or https://..." onChange={(e) => field("backdrop", e.target.value)}/></label>
      <label className="wide">YouTube trailer ID (optional)<input value={draft.trailerId} placeholder="11-character video ID" onChange={(e) => field("trailerId", e.target.value)}/></label>
    </div>
    {error && <p role="alert" className="ws-error">{error}</p>}
    <div className="ws-form-actions"><button type="button" className="ws-outline" onClick={onCancel}>Cancel</button><button className="ws-primary" disabled={saving}>{saving ? "Saving..." : "Save movie"} <ArrowRight size={16}/></button></div>
  </form>;
}
function ShowForm({ show, data, onCancel, onSave }: { show?: DemoShowtime; data: DemoStore; onCancel: () => void; onSave: (s: DemoShowtime) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => show ? { movieId: show.movieId, cinema: show.cinema, hall: show.hall, date: show.date, time: show.time, price: show.price } : { movieId: data.movies[0]?.id ?? 0, cinema: CINEMAS[0], hall: "Cinema 1", date: phDate(), time: SHOWTIMES[0], price: 260 });
  const [error, setError] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.movies.some((m) => m.id === form.movieId) || !form.hall.trim()) return setError("Select a movie and enter the cinema screen.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(showtimeTimestamp(form.date, form.time))) return setError("Provide a valid screening date and time.");
    if (!show && form.date < phDate()) return setError("You cannot create showtimes in the past.");
    if (!Number.isFinite(form.price) || form.price <= 0) return setError("Price must be positive.");
    if (data.showtimes.some((s) => s.id !== show?.id && s.cinema === form.cinema && s.hall.toLowerCase() === form.hall.trim().toLowerCase() && s.date === form.date && s.time === form.time)) return setError("This screen already has a screening at the same date and time.");
    setSaving(true);
    try { await onSave({ ...form, hall: form.hall.trim(), id: show?.id ?? uid("ST") }); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save screening."); }
    finally { setSaving(false); }
  };
  return <form className="ws-editor" onSubmit={save} noValidate>
    <div className="ws-editor-top"><div><span className="ws-eyebrow">SCHEDULE EDITOR</span><h3>{show ? "Edit screening" : "Add screening"}</h3></div><button type="button" aria-label="Close editor" onClick={onCancel}><X /></button></div>
    <div className="ws-fields">
      <label className="wide">Movie<select value={form.movieId} onChange={(e) => setForm({ ...form, movieId: Number(e.target.value) })}>{data.movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
      <label>Cinema<select value={form.cinema} onChange={(e) => setForm({ ...form, cinema: e.target.value })}>{CINEMAS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Screen<input value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })}/></label>
      <label>Date<input type="date" value={form.date} min={show ? undefined : phDate()} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label>
      <label>Time<select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>{SHOWTIMES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Ticket price (PHP)<input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}/></label>
    </div>
    {error && <p className="ws-error" role="alert">{error}</p>}
    <div className="ws-form-actions"><button type="button" className="ws-outline" onClick={onCancel}>Cancel</button><button className="ws-primary" disabled={saving}>{saving ? "Saving..." : "Save screening"} <ArrowRight size={16}/></button></div>
  </form>;
}

export function DemoWorkspace({ data, onChange, onBrowse, onOpenMovie, onAuthenticated, onSignedOut }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const access = new URLSearchParams(window.location.search).get("access");
  const dedicatedRole = access === "admin" ? "admin" : access === "staff" ? "employee" : null;
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [editMovie, setEditMovie] = useState<Movie | "new" | null>(null);
  const [editShow, setEditShow] = useState<DemoShowtime | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState("");
  const [detailId, setDetailId] = useState("");
  const [lookup, setLookup] = useState("");
  const customer = session?.role === "customer";
  const admin = session?.role === "admin";
  const staff = session?.role === "employee";
  const chosenRole = roles.find((r) => r.id === (session?.role || "customer"))!;
  const newTab = (value: string) => {
    setTab(value); setSearch(""); setFilter("All"); setDate(""); setPage(1);
    setNotice(""); setEditMovie(null); setEditShow(null); setPendingDelete(""); setDetailId("");
  };
  useEffect(() => setPage(1), [search, filter, date]);
  useEffect(() => {
    if (!(sessionStorage.getItem("moviex-api-token") || localStorage.getItem("moviex-api-token"))) return;
    let active = true;
    void api<{user:ApiUser}>("/auth/me").then(async ({user}) => {
      if (!active || (dedicatedRole ? user.role !== dedicatedRole : user.role !== "customer")) return;
      await refreshServerData();
      if (!active) return;
      enter(user.role, user.email, user.name);
      onAuthenticated(user);
    }).catch(() => { if (active) setAuthError("Unable to restore account. Check your connection or sign in again."); });
    return () => { active = false; };
  }, [dedicatedRole]);
  const enter = (chosen: Role, mail: string, displayName: string) => {
    setSession({ role: chosen, email: mail.toLowerCase().trim(), name: displayName });
    setAuthError(""); setPassword(""); setPasswordAgain(""); newTab("overview");
  };
  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!isEmail(email)) return setAuthError("Enter a valid email address.");
    if (password.length < 8) return setAuthError("Password must have at least 8 characters.");
    if (!dedicatedRole && authMode === "signup" && name.trim().length < 2) return setAuthError("Enter your full name.");
    if (!dedicatedRole && authMode === "signup" && password !== passwordAgain) return setAuthError("Passwords do not match.");
    try {
      const result = !dedicatedRole && authMode === "signup" ? await registerApi(name.trim(), email, password) : await signInApi(email, password);
      if ((dedicatedRole && result.user.role !== dedicatedRole) || (!dedicatedRole && result.user.role !== "customer")) return setAuthError("This account does not have access to this portal.");
      const chosen = staySignedIn ? localStorage : sessionStorage;
      const other = staySignedIn ? sessionStorage : localStorage;
      other.removeItem("moviex-api-token");
      chosen.setItem("moviex-api-token", result.token);
      await refreshServerData();
      enter(result.user.role, result.user.email, result.user.name);
      onAuthenticated(result.user);
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Unable to sign in"); }
  };
  const message = (value: string, error = false) => { setNotice(value); setNoticeError(error); setPendingDelete(""); };
  const refreshServerData = async () => { const [movies, showtimes, bookings] = await Promise.all([api<DemoStore["movies"]>("/movies"), api<DemoStore["showtimes"]>("/showtimes"), api<DemoStore["bookings"]>("/bookings")]); onChange({ movies, showtimes, bookings }); };
  const changeBooking = async (id: string, status: BookingStatus) => {
    const b = data.bookings.find((x) => x.id === id);
    if (!b) return;
    if (status === "Checked in" && b.status !== "Confirmed") return message("Only confirmed bookings can be checked in.");
    if (status === "Cancelled" && b.status === "Checked in") return message("Checked-in bookings cannot be cancelled.");
    try { await api("/bookings/" + encodeURIComponent(id) + "/status", { method: "PATCH", body: JSON.stringify({ status }) }); await refreshServerData(); }
    catch (e) { return message(e instanceof Error ? e.message : "Unable to update booking", true); }
    message(id + " marked " + status.toLowerCase() + ".");
  };
  const relevantBookings = useMemo(() => data.bookings.filter((b) => !customer || b.customerEmail.toLowerCase() === session?.email), [data.bookings, customer, session?.email]);
  const shownBookings = useMemo(() => relevantBookings.filter((b) =>
    (!search || (b.id + b.movieTitle + b.customerName + b.customerEmail + b.cinema).toLowerCase().includes(search.toLowerCase())) &&
    (filter === "All" || b.status === filter) && (!date || b.date === date)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [relevantBookings, search, filter, date]);
  const shownMovies = data.movies.filter((m) => (m.title + m.genres.join(" ")).toLowerCase().includes(search.toLowerCase()));
  const rankedShows = useMemo(() => [...data.showtimes].sort((a, b) =>
    orderStatus(showtimeStatus(a.date, a.time)) - orderStatus(showtimeStatus(b.date, b.time)) || showtimeTimestamp(a.date, a.time) - showtimeTimestamp(b.date, b.time)
  ), [data.showtimes]);
  const shownShows = rankedShows.filter((s) =>
    (!search || ((data.movies.find((m) => m.id === s.movieId)?.title || "") + s.cinema + s.hall).toLowerCase().includes(search.toLowerCase())) &&
    (filter === "All" || showtimeStatus(s.date, s.time) === filter) && (!date || s.date === date));
  const saveMovie = async (m: Movie): Promise<void> => {
    if (data.movies.some((f) => f.id !== m.id && f.title.toLowerCase() === m.title.toLowerCase())) throw new Error("That movie is already in the catalogue.");
    const exists = data.movies.some((f) => f.id === m.id);
    await api("/movies" + (exists ? "/" + m.id : ""), { method: exists ? "PUT" : "POST", body: JSON.stringify(m) });
    await refreshServerData(); setEditMovie(null); message(m.title + " saved to the database.");
  };
  const removeMovie = async (id: number) => {
    try { await api("/movies/" + id, { method: "DELETE" }); await refreshServerData(); message("Movie removed from the database."); }
    catch (e) { message(e instanceof Error ? e.message : "Unable to remove movie.", true); }
  };
  const saveShow = async (s: DemoShowtime): Promise<void> => {
    const exists = data.showtimes.some((x) => x.id === s.id);
    await api("/showtimes" + (exists ? "/" + encodeURIComponent(s.id) : ""), { method: exists ? "PUT" : "POST", body: JSON.stringify(s) });
    await refreshServerData(); setEditShow(null); message("Screening saved to the database.");
  };
  const removeShow = async (id: string) => {
    try { await api("/showtimes/" + encodeURIComponent(id), { method: "DELETE" }); await refreshServerData(); message("Screening removed from the database."); }
    catch (e) { message(e instanceof Error ? e.message : "Unable to remove screening.", true); }
  };
  const buttons = admin ? ["overview", "bookings", "movies", "showtimes", "transactions", "accounts"] : staff ? ["overview", "check-in", "bookings", "showtimes"] : ["overview", "my bookings", "showtimes"];
  const pager = (length: number) => <Pager page={page} total={length} onChange={setPage}/>;
  const filters = (kind: "bookings" | "showtimes") => <div className="ws-filters">
    <label className="ws-search"><MagnifyingGlass size={17}/><input aria-label="Search records" placeholder={kind === "bookings" ? "Search reference, customer or film..." : "Search film, cinema or screen..."} value={search} onChange={(e) => setSearch(e.target.value)}/></label>
    <select aria-label="Filter status" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{(kind === "bookings" ? ["Pending", "Confirmed", "Checked in", "Cancelled"] : ["Ongoing", "Upcoming", "Finished"]).map((s) => <option key={s}>{s}</option>)}</select>
    <input aria-label="Filter date" type="date" value={date} onChange={(e) => setDate(e.target.value)}/>
    {(search || filter !== "All" || date) && <button className="ws-text-btn" onClick={() => { setSearch(""); setFilter("All"); setDate(""); }}>Clear</button>}
  </div>;
  const bookingTable = (values: DemoBooking[], changes = false) => <div className="ws-table-scroll">
    <table className="ws-table"><thead><tr><th>Reference / guest</th><th>Movie</th><th>Date & time</th><th>Seats</th><th>Status</th><th>Total</th><th /></tr></thead>
      <tbody>{pageItems(values, page).map((b) => <tr key={b.id}>
        <td><strong>{b.id}</strong><small>{b.customerName}</small></td><td>{b.movieTitle}<small>{b.cinema}</small></td>
        <td>{dateLabel(b.date)}<small>{b.time}</small></td><td>{b.seats.join(", ")}</td>
        <td><Pill status={b.status}/></td><td>{money(b.total)}</td>
        <td><button className="ws-text-btn" onClick={() => setDetailId(detailId === b.id ? "" : b.id)}>Details</button></td>
      </tr>)}</tbody>
    </table>
    {!values.length && <Empty title="No matching bookings" detail="Change the search, date, or status filter."/>}
    {detailId && values.some((b) => b.id === detailId) && (() => {
      const b = values.find((x) => x.id === detailId)!;
      return <div className="ws-record-detail"><div><strong>Reference {b.id}</strong><p>{b.customerEmail} · {b.hall}</p><p>{b.method} · {b.paymentPlan} · Simulated amount due: {money(b.dueNow)}</p></div>
        <div className="ws-record-actions">
          {changes && b.status === "Pending" && <button className="ws-outline" onClick={() => changeBooking(b.id, "Confirmed")}>Confirm</button>}
          {changes && b.status === "Confirmed" && <button className="ws-outline" onClick={() => changeBooking(b.id, "Checked in")}>Check in</button>}
          {(admin || customer && b.status !== "Checked in" && showtimeTimestamp(b.date, b.time) > Date.now()) && b.status !== "Cancelled" && <button className="ws-danger-link" onClick={() => changeBooking(b.id, "Cancelled")}>Cancel booking</button>}
        </div>
      </div>;
    })()}
  </div>;

  if (!session) return <section className="ws-auth ws-auth-clean">
    <div className="ws-auth-intro">
      <span className="ws-eyebrow">MOVIEX / ACCOUNT</span>
      <h1>{dedicatedRole === "admin" ? "Administrator access." : dedicatedRole === "employee" ? "Cinema staff access." : <>Your movie night.<br/>Your account.</>}</h1>
      <p>{dedicatedRole ? "Sign in with your assigned work account. Permissions are checked by the server." : "Sign in to manage your bookings and tickets."}</p>
    </div>
    <div className="ws-auth-card">
      {!dedicatedRole && <div className="ws-auth-switch"><button className={authMode === "signin" ? "active" : ""} onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Sign in</button><button className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Create account</button></div>}
      <h2>{dedicatedRole ? "Secure sign in." : authMode === "signin" ? "Welcome back." : "Join MovieX."}</h2>
      <p>{authMode === "signin" ? "Enter your account credentials to continue." : "Create a customer account."}</p>
      <form onSubmit={signIn} noValidate>
        {!dedicatedRole && authMode === "signup" && <label>Full name<input value={name} placeholder="Full name" onChange={(e) => setName(e.target.value)}/></label>}
        <label>Email<input type="email" autoComplete="username" value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)}/></label>
        <label>Password<div className="ws-password-field"><input type={showPassword ? "text" : "password"} autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={password} placeholder="Enter your password" onChange={(e) => setPassword(e.target.value)}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeSlash size={19}/> : <Eye size={19}/>}</button></div></label>
        {!dedicatedRole && authMode === "signup" && <label>Confirm password<input type="password" autoComplete="new-password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)}/></label>}
        {(dedicatedRole || authMode === "signin") && <label className="ws-stay-login"><input type="checkbox" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)}/><span>Stay signed in</span></label>}
        {authError && <p role="alert" className="ws-error">{authError}</p>}
        <button className="ws-primary ws-full" type="submit">{!dedicatedRole && authMode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={16}/></button>
      </form>
      <p className="ws-fineprint">{dedicatedRole ? "Your administrator or staff account must already exist in the database." : "Your account is securely stored in MovieX."}</p>
    </div>
  </section>;
  return <section className="ws-page"><div className="ws-shell">
    <div className="ws-topline"><span><i/>MONGODB WORKSPACE</span><button onClick={() => { sessionStorage.removeItem("moviex-api-token"); localStorage.removeItem("moviex-api-token"); setSession(null); onSignedOut(); }}><SignOut size={17}/> Sign out</button></div>
    <div className="ws-heading"><div><span className="ws-eyebrow">{chosenRole.title.toUpperCase()} SPACE</span>
      <h1>{admin ? "Cinema operations." : staff ? "The check-in desk." : "Your movie nights."}</h1>
      <p>{admin ? "Everything you need to manage a cinema, in one place." : staff ? "Today's screenings and ticket verification." : "Manage your tickets and find your next movie."}</p>
      </div><div className="ws-profile"><span>{session.name.charAt(0).toUpperCase()}</span><div><strong>{session.name}</strong><small>{session.email}</small></div></div>
    </div>
    <nav className="ws-tabs" aria-label="Workspace sections">{buttons.map((v) => <button key={v} className={tab === v ? "active" : ""} onClick={() => newTab(v)}>{v === "check-in" ? "Check-in" : v === "my bookings" ? "My bookings" : v.charAt(0).toUpperCase() + v.slice(1)}</button>)}</nav>
    {notice && <div className={"ws-notice" + (noticeError ? " ws-notice-error" : "")} role={noticeError ? "alert" : "status"}>{noticeError ? <WarningCircle size={18}/> : <CheckCircle size={18}/>}<span>{notice}</span><button aria-label="Close message" onClick={() => setNotice("")}><X size={16}/></button></div>}

    {tab === "overview" && customer && <div className="ws-customer-home">
      <div className="ws-customer-browse"><div><h2>Find your next movie</h2><p>Browse films and reserve your seats.</p></div><button className="ws-primary" onClick={onBrowse}>Browse movies <ArrowRight size={17}/></button></div>
      <div className="ws-panel"><div className="ws-panel-heading"><div><span className="ws-eyebrow">MY TICKETS</span><h2>Upcoming tickets</h2><p>Your active reservations and tickets.</p></div><button className="ws-text-btn" onClick={() => newTab("my bookings")}>All orders <ArrowRight size={16}/></button></div>
        {relevantBookings.filter((b) => b.status !== "Cancelled" && b.status !== "Checked in" && showtimeTimestamp(b.date, b.time) >= Date.now()).length ? <div className="ws-customer-ticket-list">{relevantBookings.filter((b) => b.status !== "Cancelled" && b.status !== "Checked in" && showtimeTimestamp(b.date, b.time) >= Date.now()).sort((a,b) => showtimeTimestamp(a.date,a.time)-showtimeTimestamp(b.date,b.time)).map((b) => <div className="ws-customer-ticket" key={b.id}><div className="ws-activity-icon"><Ticket size={21}/></div><div className="ws-customer-ticket-info"><strong>{b.movieTitle}</strong><small>{dateLabel(b.date)} · {b.time} · {b.cinema}</small><small>Seats {b.seats.join(", ")} · Order {b.id}</small></div><Pill status={b.status}/></div>)}</div> : <div className="ws-customer-empty">No upcoming tickets. Book a movie to see it here.</div>}
      </div>
      <div className="ws-panel"><div className="ws-panel-heading"><div><span className="ws-eyebrow">ORDER HISTORY</span><h2>Past orders</h2><p>Previous screenings, used tickets, and cancelled orders.</p></div><button className="ws-text-btn" onClick={() => newTab("my bookings")}>View all <ArrowRight size={16}/></button></div>
        {relevantBookings.filter((b) => b.status === "Cancelled" || b.status === "Checked in" || showtimeTimestamp(b.date, b.time) < Date.now()).length ? <div className="ws-customer-ticket-list">{relevantBookings.filter((b) => b.status === "Cancelled" || b.status === "Checked in" || showtimeTimestamp(b.date, b.time) < Date.now()).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,5).map((b) => <div className="ws-customer-ticket" key={b.id}><div className="ws-activity-icon"><Ticket size={21}/></div><div className="ws-customer-ticket-info"><strong>{b.movieTitle}</strong><small>{dateLabel(b.date)} · {b.time} · {b.cinema}</small><small>Seats {b.seats.join(", ")} · {money(b.total)} · Order {b.id}</small></div><Pill status={b.status}/></div>)}</div> : <div className="ws-customer-empty">No past orders yet. Your order history will appear here.</div>}
      </div>
    </div>}    {tab === "overview" && !customer && <>
      <div className="ws-stats">
        {customer ? <>
          <Stat label="Your bookings" number={String(relevantBookings.length)} hint="Saved in this browser"/>
          <Stat label="Confirmed" number={String(relevantBookings.filter((b) => b.status === "Confirmed").length)} hint="Demo reservations"/>
          <Stat label="Upcoming screenings" number={String(data.showtimes.filter((s) => showtimeStatus(s.date, s.time) !== "Finished").length)} hint="Across all sample cinemas"/>
        </> : staff ? <>
          <Stat label="Today's screenings" number={String(data.showtimes.filter((s) => s.date === phDate()).length)} hint="Scheduled sessions"/>
          <Stat label="Confirmed tickets" number={String(data.bookings.filter((b) => b.status === "Confirmed").length)} hint="Ready for verification"/>
          <Stat label="Checked-in guests" number={String(data.bookings.filter((b) => b.status === "Checked in").length)} hint="Recorded check-ins"/>
        </> : <>
          <Stat label="Total bookings" number={String(data.bookings.length)} hint="Database records"/>
          <Stat label="Pending bookings" number={String(data.bookings.filter((b) => b.status === "Pending").length)} hint="Awaiting confirmation"/>
          <Stat label="Screenings" number={String(data.showtimes.length)} hint={data.movies.length + " films in catalogue"}/>
        </>}
      </div>
      <div className="ws-overview-grid">
        <div className="ws-panel">
          <div className="ws-panel-heading"><div><span className="ws-eyebrow">NOW & NEXT</span><h2>Screening schedule</h2></div><button className="ws-text-btn" onClick={() => newTab("showtimes")}>All showtimes <ArrowRight size={16}/></button></div>
          <div className="ws-activity">{rankedShows.filter((s) => showtimeStatus(s.date, s.time) !== "Finished").slice(0,5).map((s) => <div key={s.id}>
            <div className="ws-activity-icon"><CalendarBlank size={18}/></div><div><strong>{data.movies.find((m) => m.id === s.movieId)?.title || "Film unavailable"}</strong><small>{s.cinema} · {dateLabel(s.date)} · {s.time}</small></div><Pill status={showtimeStatus(s.date, s.time)}/>
          </div>)}</div>
        </div>
        <div className="ws-panel ws-quick"><span className="ws-eyebrow">QUICK ACTION</span>
          <h2>{customer ? "The big screen awaits." : staff ? "Verify a guest's ticket." : "Keep the catalogue current."}</h2>
          <p>{customer ? "Discover a film and reserve your seats with the sample checkout." : staff ? "Find a booking reference and check in confirmed guests." : "Add films and schedule the next cinema experience."}</p>
          <button className="ws-primary" onClick={customer ? onBrowse : () => newTab(staff ? "check-in" : "movies")}>{customer ? "Browse movies" : staff ? "Open check-in" : "Manage movies"} <ArrowRight size={17}/></button>
        </div>
      </div>
      {(customer || admin) && <div className="ws-panel ws-recent"><div className="ws-panel-heading"><div><span className="ws-eyebrow">RECENT ACTIVITY</span><h2>Booking activity</h2></div><button className="ws-text-btn" onClick={() => newTab(customer ? "my bookings" : "bookings")}>See all <ArrowRight size={16}/></button></div>
        <div className="ws-activity">{relevantBookings.slice(0,4).map((b) => <div key={b.id}><div className="ws-activity-icon"><Ticket size={18}/></div><div><strong>{b.movieTitle}</strong><small>{b.id} · {dateLabel(b.date)}</small></div><Pill status={b.status}/></div>)}</div>
      </div>}
    </>}

    {(tab === "bookings" || tab === "my bookings") && <div className="ws-panel">
      <div className="ws-panel-heading"><div><span className="ws-eyebrow">BOOKING HISTORY</span><h2>{customer ? "My bookings" : "Booking management"}</h2><p>{shownBookings.length} matching records. Search by reference, name, movie or date.</p></div></div>
      {filters("bookings")}{bookingTable(shownBookings, admin || staff)}{pager(shownBookings.length)}
    </div>}

    {tab === "check-in" && staff && <>
      <div className="ws-panel ws-checkin"><div><span className="ws-eyebrow">GUEST VERIFICATION</span><h2>Find a ticket</h2><p>Enter a booking reference to find a guest.</p></div><label className="ws-search"><MagnifyingGlass size={18}/><input aria-label="Booking reference" value={lookup} placeholder="Booking reference" onChange={(e) => setLookup(e.target.value.toUpperCase())}/></label></div>
      {lookup.trim() && (() => {
        const b = data.bookings.find((r) => r.id.toUpperCase() === lookup.trim());
        return b ? <div className="ws-panel ws-checkin-result"><div><span className="ws-eyebrow">TICKET FOUND</span><h2>{b.movieTitle}</h2><p>{b.customerName} · {b.seats.join(", ")} · {b.cinema}</p><p>{dateLabel(b.date)}, {b.time}</p><Pill status={b.status}/></div>
          <div>{b.status === "Confirmed" ? <button className="ws-primary" onClick={() => changeBooking(b.id, "Checked in")}><Check size={18}/> Check in guest</button> : <p>{b.status === "Pending" ? "This booking must be confirmed first." : b.status === "Checked in" ? "Already checked in." : "This booking was cancelled."}</p>}</div>
        </div> : <div className="ws-panel"><Empty title="Reference not found" detail="Check the booking code and try again."/></div>;
      })()}
      <div className="ws-panel"><div className="ws-panel-heading"><div><span className="ws-eyebrow">READY FOR ARRIVAL</span><h2>Confirmed tickets</h2></div></div>
        {bookingTable(data.bookings.filter((b) => b.status === "Confirmed"), true)}{pager(data.bookings.filter((b) => b.status === "Confirmed").length)}
      </div>
    </>}

    {tab === "movies" && admin && <div className="ws-panel">
      <div className="ws-panel-heading"><div><span className="ws-eyebrow">MOVIE CATALOGUE</span><h2>Movie management</h2><p>{data.movies.length} films · Add, update, remove, and preview listings.</p></div><button className="ws-primary" onClick={() => setEditMovie("new")}><Plus size={16}/> Add movie</button></div>
      {editMovie && <FilmForm key={typeof editMovie === "string" ? "new" : editMovie.id} movie={typeof editMovie === "string" ? undefined : editMovie} onCancel={() => setEditMovie(null)} onSave={saveMovie}/>}
      <div className="ws-filters"><label className="ws-search"><MagnifyingGlass size={17}/><input aria-label="Search movies" value={search} placeholder="Find a film or genre..." onChange={(e) => setSearch(e.target.value)}/></label></div>
      <div className="ws-film-list">{pageItems(shownMovies,page).map((m) => <div className="ws-film-item" key={m.id}>
        <img src={m.poster} alt="" loading="lazy"/><div><strong>{m.title}</strong><small>{m.year} · {m.genres.join(" / ") || "Uncategorized"} · {m.runtime || "?"} min</small></div>
        <div className="ws-row-actions"><button className="ws-outline" onClick={() => onOpenMovie(m)}>Preview</button><button className="ws-square" aria-label={"Edit " + m.title} onClick={() => { setEditMovie(m); setPendingDelete(""); }}><PencilSimple size={18}/></button><button className="ws-square" aria-label={"Delete " + m.title} onClick={() => setPendingDelete(pendingDelete === String(m.id) ? "" : String(m.id))}><Trash size={18}/></button></div>
        {pendingDelete === String(m.id) && <div className="ws-confirm"><span>Remove this movie and its screenings?</span><button onClick={() => void removeMovie(m.id)}>Delete</button><button onClick={() => setPendingDelete("")}>Keep</button></div>}
      </div>)}</div>
      {!shownMovies.length && <Empty title="No movies found" detail="Try another search or add a movie."/>}{pager(shownMovies.length)}
    </div>}

    {tab === "showtimes" && <div className="ws-panel">
      <div className="ws-panel-heading"><div><span className="ws-eyebrow">CINEMA PROGRAMME</span><h2>Screenings & showtimes</h2><p>{shownShows.length} sessions · Ongoing sessions are shown first.</p></div>{admin && <button className="ws-primary" onClick={() => setEditShow("new")}><Plus size={16}/> Add screening</button>}</div>
      {admin && editShow && <ShowForm key={typeof editShow === "string" ? "new" : editShow.id} show={typeof editShow === "string" ? undefined : editShow} data={data} onCancel={() => setEditShow(null)} onSave={saveShow}/>}
      {filters("showtimes")}
      <div className="ws-table-scroll"><table className="ws-table"><thead><tr><th>Movie</th><th>Cinema / screen</th><th>Date / time</th><th>Price</th><th>Status</th>{admin && <th>Manage</th>}</tr></thead>
        <tbody>{pageItems(shownShows,page).map((s) => <tr key={s.id}>
          <td><strong>{data.movies.find((m) => m.id === s.movieId)?.title || "Removed movie"}</strong></td>
          <td>{s.cinema}<small>{s.hall}</small></td><td>{dateLabel(s.date)}<small>{s.time}</small></td><td>{money(s.price)}</td><td><Pill status={showtimeStatus(s.date,s.time)}/></td>
          {admin && <td><div className="ws-row-actions"><button className="ws-square" aria-label="Edit screening" onClick={() => { setEditShow(s); setPendingDelete(""); }}><PencilSimple size={18}/></button><button className="ws-square" aria-label="Remove screening" onClick={() => setPendingDelete(pendingDelete === s.id ? "" : s.id)}><Trash size={18}/></button></div>
            {pendingDelete === s.id && <div className="ws-confirm"><span>Delete this screening?</span><button onClick={() => void removeShow(s.id)}>Delete</button><button onClick={() => setPendingDelete("")}>Keep</button></div>}
          </td>}
        </tr>)}</tbody>
      </table>{!shownShows.length && <Empty title="No screenings found" detail="Change filters or add a new screening."/>}</div>{pager(shownShows.length)}
    </div>}

    {tab === "accounts" && admin && <AccountManager currentEmail={session.email}/>}
    {tab === "transactions" && admin && <div className="ws-panel">
      <div className="ws-panel-heading"><div><span className="ws-eyebrow">PAYMENT OVERVIEW</span><h2>Transactions & downpayments</h2><p>Amounts shown are hypothetical. No real funds are collected or verified.</p></div></div>
      <div className="ws-transaction-stats"><Stat label="Booking total" number={money(data.bookings.filter((b) => b.status !== "Cancelled").reduce((s,b) => s + b.total,0))} hint="Excludes cancelled bookings"/><Stat label="Demo amount due" number={money(data.bookings.filter((b) => b.status !== "Cancelled").reduce((s,b) => s + b.dueNow,0))} hint="Full or 30% deposit"/><Stat label="Actual collected" number={money(0)} hint="No payment processing"/></div>
      {filters("bookings")}
      <div className="ws-table-scroll"><table className="ws-table"><thead><tr><th>Reference</th><th>Booking date</th><th>Method</th><th>Payment plan</th><th>Amount due</th><th>Collection</th></tr></thead>
        <tbody>{pageItems(shownBookings,page).map((b) => <tr key={b.id}><td><strong>{b.id}</strong><small>{b.customerName}</small></td><td>{dateLabel(b.date)}</td><td>{b.method}</td><td>{b.paymentPlan}</td><td>{money(b.dueNow)}<small>of {money(b.total)}</small></td><td><Pill status={b.status === "Cancelled" ? "Cancelled" : "Not collected"}/></td></tr>)}</tbody>
      </table>{!shownBookings.length && <Empty title="No transactions found" detail="Try adjusting your search or filters."/>}</div>{pager(shownBookings.length)}
    </div>}
    <div className="ws-disclaimer"><WarningCircle size={19}/><span>Accounts, bookings, screenings and seat reservations are stored in MongoDB. Payments are simulated; no charges are processed.</span></div>
  </div></section>;
}
