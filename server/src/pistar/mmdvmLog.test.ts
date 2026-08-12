import { describe, expect, it } from "vitest";
import { MmdvmLogParser } from "./mmdvmLog.js";

describe("MmdvmLogParser", () => {
  it("emits nothing on a header line — only once the matching end line arrives", () => {
    const parser = new MmdvmLogParser();
    const result = parser.feedLine(
      "M: 2000-00-00 00:00:00.000 D-Star, received RF header from M1ABC   /ABCD to CQCQCQ",
    );
    expect(result).toBeNull();
  });

  it("pairs a D-Star RF header with its end-of-transmission line into one entry", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 D-Star, received RF header from M1ABC   /ABCD to CQCQCQ");
    const entry = parser.feedLine(
      "M: 2000-00-00 00:00:05.000 D-Star, received RF end of transmission from M1ABC   /ABCD to CQCQCQ  , 4.8 seconds, BER: 0.0%, RSSI: -43/-43/-43 dBm",
    );

    expect(entry).not.toBeNull();
    expect(entry?.mode).toBe("dstar");
    expect(entry?.callsign).toBe("M1ABC/ABCD");
    expect(entry?.target).toBe("CQCQCQ");
    expect(entry?.src).toBe("RF");
    expect(entry?.durationSeconds).toBe(4.8);
    expect(entry?.berPercent).toBe(0);
    expect(entry?.rssiDbm).toBe(-43);
    expect(entry?.gps).toBe(true); // D-Star always carries the aprs.fi badge, per the file's own comment
  });

  it("pairs a DMR network voice header with its end-of-voice line, mapping both slots to mode dmr", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 DMR Slot 2, received network voice header from M1ABC to TG 1");
    const entry = parser.feedLine(
      "M: 2000-00-00 00:00:01.800 DMR Slot 2, received RF end of voice transmission, 1.8 seconds, BER: 3.9%",
    );

    expect(entry?.mode).toBe("dmr");
    expect(entry?.callsign).toBe("M1ABC");
    expect(entry?.target).toBe("TG 1");
    expect(entry?.src).toBe("Net"); // "network voice header" -> Net, even though the end line says "RF end"
    expect(entry?.durationSeconds).toBe(1.8);
    expect(entry?.berPercent).toBe(3.9);
  });

  it("pairs a YSF RF transmission with its end line", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 YSF, received RF data from MW0MWZ     to ALL");
    const entry = parser.feedLine("M: 2000-00-00 00:00:05.100 YSF, received RF end of transmission, 5.1 seconds, BER: 3.8%");

    expect(entry?.mode).toBe("ysf");
    expect(entry?.callsign).toBe("MW0MWZ");
    expect(entry?.target).toBe("ALL");
    expect(entry?.durationSeconds).toBe(5.1);
  });

  it("pairs a P25 transmission with its end line", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 P25, received RF transmission from M1ABC to TG 10200");
    const entry = parser.feedLine("M: 2000-00-00 00:00:00.400 P25, received RF end of transmission, 0.4 seconds, BER: 0.0%");

    expect(entry?.mode).toBe("p25");
    expect(entry?.target).toBe("TG 10200");
    expect(entry?.durationSeconds).toBe(0.4);
  });

  it("pairs an M17 late-entry header with its end line, including RSSI", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 M17, received RF late entry voice transmission from M1ABC to INFO");
    const entry = parser.feedLine(
      "M: 2000-00-00 00:00:02.100 M17, received RF end of transmission from M1ABC to INFO, 2.1 seconds, BER: 0.2%, RSSI: -60/-60/-60 dBm",
    );

    expect(entry?.mode).toBe("m17");
    expect(entry?.durationSeconds).toBe(2.1);
    expect(entry?.berPercent).toBe(0.2);
    expect(entry?.rssiDbm).toBe(-60);
  });

  it("drops an end line with no matching pending header rather than guessing", () => {
    const parser = new MmdvmLogParser();
    const entry = parser.feedLine("M: 2000-00-00 00:00:05.000 D-Star, received RF end of transmission from M1ABC/ABCD to CQCQCQ, 4.8 seconds, BER: 0.0%");
    expect(entry).toBeNull();
  });

  it("ignores non-M:/E: lines", () => {
    const parser = new MmdvmLogParser();
    expect(parser.feedLine("some unrelated line")).toBeNull();
  });

  it("ignores known noise patterns even on an otherwise-matching channel line", () => {
    const parser = new MmdvmLogParser();
    const result = parser.feedLine("M: 2000-00-00 00:00:00.000 DMR Slot 1, received network CSBK Preamble from M1ABC to TG 1");
    expect(result).toBeNull();
  });

  it("keeps DMR Slot 1 and Slot 2 as independent in-flight calls", () => {
    const parser = new MmdvmLogParser();
    parser.feedLine("M: 2000-00-00 00:00:00.000 DMR Slot 1, received RF voice header from N0CALL to TG 91");
    parser.feedLine("M: 2000-00-00 00:00:00.000 DMR Slot 2, received RF voice header from M1ABC to TG 1");

    const slot2 = parser.feedLine("M: 2000-00-00 00:00:01.800 DMR Slot 2, received RF end of voice transmission, 1.8 seconds, BER: 3.9%");
    expect(slot2?.callsign).toBe("M1ABC");
    expect(slot2?.target).toBe("TG 1");

    const slot1 = parser.feedLine("M: 2000-00-00 00:00:02.500 DMR Slot 1, received RF end of voice transmission, 2.5 seconds, BER: 1.0%");
    expect(slot1?.callsign).toBe("N0CALL");
    expect(slot1?.target).toBe("TG 91");
  });
});
