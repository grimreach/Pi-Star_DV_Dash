import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "../../components/admin/Field";
import { api } from "../../lib/api";

// The original Pi-Star dashboard's "SSH Access" page isn't an sshd
// enable/disable toggle — it's an embedded ShellInABox web terminal
// (a browser-based shell on a separate port, no SSH client needed).
// Port comes from the real /etc/default/shellinabox on the device.
export function SshAccess() {
  const query = useQuery({
    queryKey: ["shellinabox"],
    queryFn: () => api.get<{ port: number | null }>("/system/shellinabox"),
  });

  const port = query.data?.port;
  const host = window.location.hostname;
  const terminalUrl = port ? `http://${host}:${port}` : null;

  return (
    <SectionCard title="SSH Terminal">
      {query.isLoading ? (
        <p className="text-sm text-[color:var(--text-muted)]">Checking for ShellInABox…</p>
      ) : terminalUrl ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-[color:var(--text-muted)]">
              Embedded ShellInABox terminal, same as the original dashboard's SSH page.
            </p>
            <a href={terminalUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-500 hover:underline">
              Open fullscreen ↗
            </a>
          </div>
          <iframe
            src={terminalUrl}
            title="SSH Terminal"
            className="h-[600px] w-full rounded-md border border-[color:var(--border-subtle)] bg-black"
          />
        </>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">
          ShellInABox isn't available on this system (no real device detected, or it isn't installed/running).
        </p>
      )}
    </SectionCard>
  );
}
