import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuthStore } from "../../store/auth";

/** Wraps widgets whose data comes from admin-only REST endpoints (no public WS broadcast for it). */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === "authenticated") return <>{children}</>;
  return (
    <div className="p-3 text-xs text-[color:var(--text-muted)]">
      <Link to="/login" className="text-brand-500 hover:underline">
        Sign in as admin
      </Link>{" "}
      to view this.
    </div>
  );
}
