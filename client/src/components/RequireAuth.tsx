import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "../store/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "unknown") {
    return <div className="p-6 text-sm text-[color:var(--text-muted)]">Checking session…</div>;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
