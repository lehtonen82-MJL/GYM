import {
  KG_PER_LB,
  formatDuration,
  formatPace,
  formatSet,
  formatVolume,
  formatWeight,
  fromDisplay,
  toDisplay,
  weightStep,
} from "./format";

describe("toDisplay / fromDisplay", () => {
  it("leaves kg untouched", () => {
    expect(toDisplay(102.5, "kg")).toBe(102.5);
    expect(fromDisplay(102.5, "kg")).toBe(102.5);
  });

  it("converts kg to lb rounded to 0.1", () => {
    expect(toDisplay(100, "lb")).toBe(220.5);
    expect(toDisplay(20, "lb")).toBe(44.1);
  });

  it("round-trips typed lb values through kg", () => {
    for (const lb of [5, 10, 22.5, 45, 135, 137.5, 225, 315, 405.5, 999.9]) {
      expect(toDisplay(fromDisplay(lb, "lb"), "lb")).toBe(lb);
    }
  });

  it("rounds lb input to the DB's 0.01 kg precision", () => {
    expect(fromDisplay(10, "lb")).toBe(4.54);
    expect(fromDisplay(137.5, "lb")).toBe(62.37);
    expect(fromDisplay(1, "lb")).toBe(Math.round(KG_PER_LB * 100) / 100);
  });
});

describe("weightStep", () => {
  it("is 2.5 kg or 5 lb", () => {
    expect(weightStep("kg")).toBe(2.5);
    expect(weightStep("lb")).toBe(5);
  });
});

describe("formatWeight / formatSet / formatVolume", () => {
  it("formats kg without trailing zeros", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg");
    expect(formatWeight(102.5, "kg")).toBe("102.5 kg");
    expect(formatWeight(100, "kg", { compact: true })).toBe("100kg");
    expect(formatWeight(116.67, "kg", { maxDecimals: 1 })).toBe("116.7 kg");
  });

  it("formats lb", () => {
    expect(formatWeight(100, "lb")).toBe("220.5 lb");
    expect(formatSet(60, 5, "lb")).toBe("132.3lb × 5");
  });

  it("formats sets and volume", () => {
    expect(formatSet(100, 5, "kg")).toBe("100kg × 5");
    expect(formatVolume(1999.6, "kg")).toBe("2000 kg");
    expect(formatVolume(1000, "lb")).toBe("2205 lb");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration("2026-01-01T10:00:00Z", "2026-01-01T10:45:00Z")).toBe("45m");
    expect(formatDuration("2026-01-01T10:00:00Z", "2026-01-01T11:05:00Z")).toBe("1h 5m");
    expect(formatDuration("2026-01-01T10:00:00Z", null)).toBe("");
  });
});

describe("formatPace", () => {
  it("formats m:ss", () => {
    expect(formatPace(112)).toBe("1:52");
    expect(formatPace(65.4)).toBe("1:05");
  });

  it("never shows 60 seconds", () => {
    expect(formatPace(119.6)).toBe("2:00");
  });
});
