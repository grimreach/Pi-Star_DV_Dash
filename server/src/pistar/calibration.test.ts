import { describe, expect, it } from "vitest";
import { parseCalibrationChunk } from "./calibration.js";

const EMPTY_STATS = { frames: 0, bits: 0, errors: 0, berPercent: 0 };

describe("parseCalibrationChunk", () => {
  it("signals finished on MMDVMCal's completion marker, with no patch", () => {
    const result = parseCalibrationChunk("Finnished...\n", { baseFrequencyHz: 431_075_000, current: EMPTY_STATS, total: EMPTY_STATS });
    expect(result.finished).toBe(true);
    expect(result.patch).toEqual({});
  });

  it("sets activeMode when a BER Test Mode banner appears", () => {
    const result = parseCalibrationChunk("BER Test Mode (FEC) for DMR Simplex\n", {
      baseFrequencyHz: 431_075_000,
      current: EMPTY_STATS,
      total: EMPTY_STATS,
    });
    expect(result.finished).toBe(false);
    expect(result.patch.activeMode).toBe("dmr");
  });

  it("computes offsetHz from a reported frequency relative to the base", () => {
    const result = parseCalibrationChunk("Setting the frequency: 431075100\n", {
      baseFrequencyHz: 431_075_000,
      current: EMPTY_STATS,
      total: EMPTY_STATS,
    });
    expect(result.patch.offsetHz).toBe(100);
  });

  it("resets current stats but keeps total on a 'voice end received' marker with no BER tokens", () => {
    const current = { frames: 5, bits: 500, errors: 5, berPercent: 1 };
    const total = { frames: 20, bits: 2000, errors: 20, berPercent: 1 };
    const result = parseCalibrationChunk("voice end received, some trailer\n", { baseFrequencyHz: 0, current, total });

    expect(result.patch.current).toEqual({ frames: 0, bits: 0, errors: 0, berPercent: 0 });
    expect(result.patch.total).toEqual(total);
  });

  it("accumulates BER tokens into both current and total, computing berPercent from errors/bits", () => {
    const result = parseCalibrationChunk("BER: 2.0% (2/100)\n", { baseFrequencyHz: 0, current: EMPTY_STATS, total: EMPTY_STATS });

    expect(result.patch.current).toEqual({ frames: 1, bits: 100, errors: 2, berPercent: 2 });
    expect(result.patch.total).toEqual({ frames: 1, bits: 100, errors: 2, berPercent: 2 });
  });

  it("accumulates multiple BER tokens in a single chunk onto the running totals", () => {
    const current = { frames: 1, bits: 100, errors: 2, berPercent: 2 };
    const total = { frames: 1, bits: 100, errors: 2, berPercent: 2 };
    const result = parseCalibrationChunk("BER: 1.0% (1/100) ... BER: 1.0% (1/100)\n", { baseFrequencyHz: 0, current, total });

    expect(result.patch.current).toEqual({ frames: 3, bits: 300, errors: 4, berPercent: (4 / 300) * 100 });
    expect(result.patch.total).toEqual({ frames: 3, bits: 300, errors: 4, berPercent: (4 / 300) * 100 });
  });

  it("returns an empty patch for a chunk with no recognizable markers", () => {
    const result = parseCalibrationChunk("some unrelated MMDVMCal log noise\n", {
      baseFrequencyHz: 431_075_000,
      current: EMPTY_STATS,
      total: EMPTY_STATS,
    });
    expect(result.finished).toBe(false);
    expect(result.patch).toEqual({});
  });

  it("reports berPercent 0 rather than NaN when bits is zero on a voice-end reset", () => {
    const result = parseCalibrationChunk("voice end received, trailer\n", { baseFrequencyHz: 0, current: EMPTY_STATS, total: EMPTY_STATS });
    expect(result.patch.current?.berPercent).toBe(0);
    expect(result.patch.total?.berPercent).toBe(0);
  });
});
