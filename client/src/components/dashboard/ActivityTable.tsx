import type { ActivityEntry } from "@pistar/shared";
import { formatTime } from "../../lib/format";

export const MODE_LABELS: Record<string, string> = {
  dstar: "D-Star",
  dmr: "DMR",
  m17: "M17",
  nxdn: "NXDN",
  p25: "P25",
  ysf: "YSF",
  fm: "FM",
  pocsag: "POCSAG",
};

export function ActivityTable({
  title,
  entries,
  showRssi,
  bare,
}: {
  title: string;
  entries: ActivityEntry[];
  showRssi?: boolean;
  /** Skip the outer .panel/.panel-header chrome — used inside the dashboard grid, which supplies its own widget header. */
  bare?: boolean;
}) {
  const content = (
    <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border-subtle)] text-[color:var(--text-muted)]">
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Mode</th>
              <th className="px-2 py-2 font-medium">Callsign</th>
              <th className="px-2 py-2 font-medium">Target</th>
              <th className="px-2 py-2 font-medium">Src</th>
              <th className="px-2 py-2 font-medium">Dur(s)</th>
              <th className="px-2 py-2 font-medium">Loss</th>
              <th className="px-2 py-2 font-medium">BER</th>
              {showRssi && <th className="px-2 py-2 font-medium">RSSI</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={showRssi ? 9 : 8} className="px-2 py-6 text-center text-[color:var(--text-muted)]">
                  No activity yet
                </td>
              </tr>
            ) : (
              entries.map((entry, i) => (
                <tr key={entry.id} className={i % 2 ? "bg-[color:var(--bg-app)]/40" : ""}>
                  <td className="mono px-2 py-1.5 whitespace-nowrap">{formatTime(entry.timestamp)}</td>
                  <td className="px-2 py-1.5">{MODE_LABELS[entry.mode] ?? entry.mode}</td>
                  <td className="mono px-2 py-1.5 font-semibold text-brand-500">
                    {entry.callsign}
                    {entry.gps && <span className="ml-1 rounded bg-[color:var(--border-subtle)] px-1 text-[10px] font-normal">GPS</span>}
                  </td>
                  <td className="mono px-2 py-1.5">{entry.target}</td>
                  <td className="px-2 py-1.5">{entry.src}</td>
                  <td className="mono px-2 py-1.5">{entry.durationSeconds.toFixed(1)}</td>
                  <td className="mono px-2 py-1.5">{entry.lossPercent}%</td>
                  <td className="mono px-2 py-1.5">{entry.berPercent.toFixed(1)}%</td>
                  {showRssi && <td className="mono px-2 py-1.5">{entry.rssiDbm ?? "–"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
    </div>
  );

  if (bare) return content;

  return (
    <div className="panel mb-4">
      <div className="panel-header">{title}</div>
      {content}
    </div>
  );
}
