// Minimal INI reader for MMDVMHost-family config files (/etc/mmdvmhost,
// /etc/dmrgateway, etc.) — flat key=value pairs grouped under [Section]
// headers, quoted string values, no nesting.

export type IniSections = Record<string, Record<string, string>>;

export function parseIni(text: string): IniSections {
  const sections: IniSections = {};
  let current: Record<string, string> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      current = {};
      sections[sectionMatch[1]] = current;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1 || !current) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    current[key] = value;
  }

  return sections;
}

export function iniString(sections: IniSections, section: string, key: string, fallback = ""): string {
  return sections[section]?.[key] ?? fallback;
}

export function iniNumber(sections: IniSections, section: string, key: string, fallback = 0): number {
  const raw = sections[section]?.[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function iniBool(sections: IniSections, section: string, key: string, fallback = false): boolean {
  const raw = sections[section]?.[key];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}
