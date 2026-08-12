import { describe, expect, it } from "vitest";
import { applySectionEdits } from "./configWriter.js";

// /etc/mmdvmhost has ~20 sections, and keys like "Enable" repeat across
// nearly all of them — this is the exact multi-section, duplicate-key file
// applySectionEdits was written to handle correctly (a naive first-match
// replace would silently edit the wrong section; see the file's own header
// comment and the original PHP's config_writer.php, which excludes this
// file from its allow-list for that reason).
const SAMPLE_LINES = [
  "[General]",
  "Callsign=W3EZE",
  "Enable=1",
  "",
  "[D-Star]",
  "Enable=1",
  "Module=A",
  "",
  "[DMR]",
  "Enable=0",
  "ColorCode=1",
];

describe("applySectionEdits", () => {
  it("edits the key in the correct section only, leaving identically-named keys elsewhere untouched", () => {
    const { lines, skipped } = applySectionEdits(SAMPLE_LINES, [{ section: "DMR", key: "Enable", value: "9" }]);

    expect(skipped).toEqual([]);
    // A naive first-match-of-"Enable=" replace would have rewritten
    // General's (line 2), not DMR's (line 9) — this is the exact failure
    // mode applySectionEdits exists to avoid.
    expect(lines[2]).toBe("Enable=1"); // General, untouched
    expect(lines[5]).toBe("Enable=1"); // D-Star, untouched
    expect(lines[9]).toBe("Enable=9"); // DMR, the one that should change
  });

  it("applies multiple edits across different sections independently", () => {
    const { lines, skipped } = applySectionEdits(SAMPLE_LINES, [
      { section: "General", key: "Callsign", value: "N0CALL" },
      { section: "DMR", key: "ColorCode", value: "3" },
    ]);

    expect(skipped).toEqual([]);
    expect(lines).toContain("Callsign=N0CALL");
    expect(lines).toContain("ColorCode=3");
  });

  it("skips an edit whose section doesn't exist in the file", () => {
    const { lines, skipped } = applySectionEdits(SAMPLE_LINES, [{ section: "YSF", key: "Enable", value: "1" }]);

    expect(skipped).toEqual([{ section: "YSF", key: "Enable", value: "1" }]);
    expect(lines).toEqual(SAMPLE_LINES);
  });

  it("skips an edit whose key doesn't exist within an existing section", () => {
    const { lines, skipped } = applySectionEdits(SAMPLE_LINES, [{ section: "DMR", key: "Master", value: "BM_3102" }]);

    expect(skipped).toEqual([{ section: "DMR", key: "Master", value: "BM_3102" }]);
    expect(lines).toEqual(SAMPLE_LINES);
  });

  it("does not mutate the input array", () => {
    const original = [...SAMPLE_LINES];
    applySectionEdits(SAMPLE_LINES, [{ section: "General", key: "Callsign", value: "N0CALL" }]);
    expect(SAMPLE_LINES).toEqual(original);
  });

  it("rejects a value containing a newline or NUL byte", () => {
    expect(() => applySectionEdits(SAMPLE_LINES, [{ section: "General", key: "Callsign", value: "X\nY" }])).toThrow();
    expect(() => applySectionEdits(SAMPLE_LINES, [{ section: "General", key: "Callsign", value: "X\0Y" }])).toThrow();
  });

  it("rejects an unsafe section or key name", () => {
    expect(() => applySectionEdits(SAMPLE_LINES, [{ section: "General]\n[Injected", key: "Callsign", value: "X" }])).toThrow();
    expect(() => applySectionEdits(SAMPLE_LINES, [{ section: "General", key: "Callsign=X\n[Injected", value: "X" }])).toThrow();
  });

  it("stops editing a section at the next [Section] header, even if the last section in the file", () => {
    const { lines } = applySectionEdits(SAMPLE_LINES, [{ section: "DMR", key: "ColorCode", value: "5" }]);
    expect(lines[lines.length - 1]).toBe("ColorCode=5");
  });
});
