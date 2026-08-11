import { useEffect } from "react";
import { Route, Routes } from "react-router";
import { AdminLayout } from "./components/AdminLayout";
import { Header } from "./components/Header";
import { RequireAuth } from "./components/RequireAuth";
import { useAuthStore } from "./store/auth";
import { useLiveStore } from "./store/live";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { AdminOverview } from "./pages/admin/AdminOverview";
import { Calibration } from "./pages/admin/Calibration";
import { Configuration } from "./pages/admin/Configuration";
import { Firmware } from "./pages/admin/Firmware";
import { LinkManager } from "./pages/admin/LinkManager";
import { LiveLogs } from "./pages/admin/LiveLogs";
import { Power } from "./pages/admin/Power";
import { SshAccess } from "./pages/admin/SshAccess";
import { SystemInfoPage } from "./pages/admin/SystemInfoPage";
import { Wifi } from "./pages/admin/Wifi";

export function App() {
  const connect = useLiveStore((s) => s.connect);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    connect();
    checkSession();
  }, [connect, checkSession]);

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-4">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="configuration" element={<Configuration />} />
            <Route path="links" element={<LinkManager />} />
            <Route path="wifi" element={<Wifi />} />
            <Route path="ssh" element={<SshAccess />} />
            <Route path="logs" element={<LiveLogs />} />
            <Route path="system" element={<SystemInfoPage />} />
            <Route path="firmware" element={<Firmware />} />
            <Route path="calibration" element={<Calibration />} />
            <Route path="power" element={<Power />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
