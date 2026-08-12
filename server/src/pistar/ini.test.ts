import { describe, expect, it } from "vitest";
import { iniBool, iniNumber, iniString, parseFlatKv, parseIni } from "./ini.js";

describe("parseIni", () => {
  it("groups key=value pairs under their section header", () => {
    const text = `
[General]
Callsign=W3EZE
DMRId=1107385

[Info]
RXFrequency=431075000
`;
    expect(parseIni(text)).toEqual({
      General: { Callsign: "W3EZE", DMRId: "1107385" },
      Info: { RXFrequency: "431075000" },
    });
  });

  it("strips surrounding quotes from values", () => {
    const text = `[General]\nDescription="Pi-Star Hotspot"\n`;
    expect(parseIni(text).General?.Description).toBe("Pi-Star Hotspot");
  });

  it("ignores comments and blank lines", () => {
    const text = `; a comment\n[General]\n# another comment\n\nCallsign=W3EZE\n`;
    expect(parseIni(text)).toEqual({ General: { Callsign: "W3EZE" } });
  });

  it("keeps identically-named keys separate across sections", () => {
    // The exact scenario applySectionEdits exists to handle correctly —
    // /etc/mmdvmhost has ~20 sections that each define their own "Enable".
    const text = `[D-Star]\nEnable=1\n\n[DMR]\nEnable=0\n`;
    const sections = parseIni(text);
    expect(sections["D-Star"]?.Enable).toBe("1");
    expect(sections.DMR?.Enable).toBe("0");
  });

  it("ignores key=value lines before any section header", () => {
    const text = `Orphan=1\n[General]\nCallsign=W3EZE\n`;
    expect(parseIni(text)).toEqual({ General: { Callsign: "W3EZE" } });
  });

  it("returns an empty object for empty input", () => {
    expect(parseIni("")).toEqual({});
  });
});

describe("iniString / iniNumber / iniBool", () => {
  const sections = parseIni(`[General]\nCallsign=W3EZE\nColorCode=1\nDuplex=1\nEnabled=yes\nOther=0\n`);

  it("reads a string value", () => {
    expect(iniString(sections, "General", "Callsign")).toBe("W3EZE");
  });

  it("falls back when the key is missing", () => {
    expect(iniString(sections, "General", "Missing", "fallback")).toBe("fallback");
    expect(iniString(sections, "Missing", "Missing")).toBe("");
  });

  it("reads a numeric value", () => {
    expect(iniNumber(sections, "General", "ColorCode")).toBe(1);
  });

  it("falls back to the numeric default for a non-numeric value", () => {
    const withGarbage = parseIni(`[General]\nColorCode=not-a-number\n`);
    expect(iniNumber(withGarbage, "General", "ColorCode", 7)).toBe(7);
  });

  it("treats 1/true/yes as boolean true, case-insensitively", () => {
    expect(iniBool(sections, "General", "Duplex")).toBe(true);
    expect(iniBool(sections, "General", "Enabled")).toBe(true);
    expect(iniBool(sections, "General", "Other")).toBe(false);
  });

  it("falls back to the boolean default when the key is missing", () => {
    expect(iniBool(sections, "General", "Missing", true)).toBe(true);
  });
});

describe("parseFlatKv", () => {
  it("parses key=value pairs with no section headers", () => {
    // /etc/timeserver's actual shape — flat, no [Section].
    const text = `Callsign=W3EZE\nSendA=1\nInterval=6\n`;
    expect(parseFlatKv(text)).toEqual({ Callsign: "W3EZE", SendA: "1", Interval: "6" });
  });

  it("strips quotes and ignores comments", () => {
    const text = `; comment\nCallsign="W3EZE"\n`;
    expect(parseFlatKv(text)).toEqual({ Callsign: "W3EZE" });
  });
});
