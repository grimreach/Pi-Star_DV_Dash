import type { DashboardState } from "@pistar/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useLiveStore } from "../store/live";

export function useDashboard() {
  const live = useLiveStore((s) => s.dashboard);
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardState>("/dashboard"),
    staleTime: 5000,
  });

  return { data: live ?? query.data, isLoading: !live && query.isLoading, error: query.error };
}
