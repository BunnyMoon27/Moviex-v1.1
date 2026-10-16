const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("moviex-api-token") || localStorage.getItem("moviex-api-token");
  const response = await fetch(API + path, { ...options, headers: { ...(options.body != null ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed (" + response.status + ")");
  return body as T;
}
export type ApiUser = { id: string; name: string; email: string; role: "customer" | "employee" | "admin" };
export const signInApi = (email: string, password: string) => api<{user:ApiUser;token:string}>("/auth/login", { method:"POST", body:JSON.stringify({email,password}) });
export const registerApi = (name: string, email: string, password: string) => api<{user:ApiUser;token:string}>("/auth/register", { method:"POST", body:JSON.stringify({name,email,password}) });
