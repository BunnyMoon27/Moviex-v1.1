import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, type ApiUser } from "./api";
type Draft = { name: string; email: string; password: string; role: "employee" | "admin" };
const empty: Draft = { name: "", email: "", password: "", role: "employee" };
export function AccountManager({ currentEmail }: { currentEmail: string }) {
  const [accounts, setAccounts] = useState<ApiUser[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setAccounts(await api<ApiUser[]>("/admin/accounts")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load accounts"); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    if (draft.password && draft.password.length < 12) return setError("Use at least 12 characters for the password.");
    if (!editing && !draft.password) return setError("A password is required for new accounts.");
    setBusy(true);
    try {
      const body = { name: draft.name.trim(), email: draft.email.trim(), role: draft.role, ...(draft.password ? { password: draft.password } : {}) };
      await api("/admin/accounts" + (editing ? "/" + editing : ""), { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setNotice(editing ? "Account updated. Changes take effect on the next request." : "Account created. Share the password privately.");
      setEditing(null); setDraft(empty); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Account update failed"); }
    finally { setBusy(false); }
  };
  const edit = (u: ApiUser) => { setEditing(u.id); setDraft({ name: u.name, email: u.email, role: u.role === "admin" ? "admin" : "employee", password: "" }); setError(""); setNotice(""); };
  const remove = async (u: ApiUser) => {
    if (!window.confirm("Remove access for " + u.email + "?")) return;
    setError("");
    try { await api("/admin/accounts/" + u.id, { method: "DELETE" }); setNotice("Account removed."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove account"); }
  };
  return <div className="ws-panel">
    <div className="ws-panel-heading"><div><span className="ws-eyebrow">ACCESS CONTROL</span><h2>Admin & staff accounts</h2><p>Only administrators can create, change, or revoke privileged accounts. Passwords are never displayed after saving.</p></div></div>
    {error && <p className="ws-error" role="alert">{error}</p>}
    {notice && <p className="ws-notice" role="status">{notice}</p>}
    <div className="ws-table-scroll"><table className="ws-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Manage</th></tr></thead><tbody>
      {accounts.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role === "admin" ? "Administrator" : "Cinema staff"}</td><td><div className="ws-row-actions"><button className="ws-text-btn" onClick={() => edit(u)}>Edit</button>{u.email !== currentEmail && <button className="ws-text-btn" onClick={() => void remove(u)}>Revoke</button>}</div></td></tr>)}
    </tbody></table></div>
    <form className="ws-editor ws-account-editor" onSubmit={save}>
      <h3>{editing ? "Update account" : "Create staff or admin account"}</h3>
      <div className="ws-fields">
        <label>Name<input required minLength={2} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
        <label>Email<input required type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label>
        <label>Access role<select value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Draft["role"] })}><option value="employee">Cinema staff</option><option value="admin">Administrator</option></select></label>
        <label>{editing ? "New password (leave blank to keep existing)" : "Temporary password (12+ characters)"}<input type="password" minLength={12} autoComplete="new-password" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })}/></label>
      </div>
      <div className="ws-form-actions">{editing && <button type="button" className="ws-outline" onClick={() => { setEditing(null); setDraft(empty); }}>Cancel</button>}<button disabled={busy} className="ws-primary" type="submit">{busy ? "Saving..." : editing ? "Save changes" : "Create account"}</button></div>
    </form>
  </div>;
}
