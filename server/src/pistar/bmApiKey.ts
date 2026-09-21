import { existsSync, readFileSync } from "node:fs";
import { iniString, parseIni } from "./ini.js";

/**
 * Pi-Star and WPSD both keep the BrandMeister REST API key in
 * /etc/bmapi.key:
 *
 *   [key]
 *   apikey=<key>
 *
 * "None"/"none" is the seeded placeholder for "not configured".
 */
export const BMAPI_KEY_PATH = process.env.BMAPI_KEY_PATH ?? "/etc/bmapi.key";

export function parseBmApiKey(text: string): string {
  const key = iniString(parseIni(text), "key", "apikey").trim();
  return key.toLowerCase() === "none" ? "" : key;
}

export function readBmApiKey(path = BMAPI_KEY_PATH): string {
  if (!existsSync(path)) return "";
  try {
    return parseBmApiKey(readFileSync(path, "utf8"));
  } catch {
    return "";
  }
}

export function renderBmApiKeyFile(key: string): string {
  const trimmed = key.trim();
  return `[key]\napikey=${trimmed.length > 0 ? trimmed : "None"}\n`;
}
