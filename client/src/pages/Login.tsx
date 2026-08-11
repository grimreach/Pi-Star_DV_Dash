import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "../store/auth";

export function Login() {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/admin";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await login(username, password);
    setSubmitting(false);
  }

  return (
    <div className="mx-auto mt-8 max-w-sm">
      <div className="panel">
        <div className="panel-header">Admin Login</div>
        <form onSubmit={onSubmit} className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Username</label>
            <input
              className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-[color:var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-brand-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-[color:var(--text-muted)]">Demo credentials: admin / pi-star</p>
        </form>
      </div>
    </div>
  );
}
