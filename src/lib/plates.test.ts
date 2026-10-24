import { platesFor, DEFAULT_PLATES } from "./plates";

describe("platesFor", () => {
  it("loads 100 kg on a 20 kg bar", () => {
    expect(platesFor(100, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [25, 15], loaded: 100, remainder: 0 });
  });

  it("uses small plates", () => {
    expect(platesFor(62.5, 20, DEFAULT_PLATES.kg).perSide).toEqual([20, 1.25]);
  });

  it("works in lb", () => {
    expect(platesFor(225, 45, DEFAULT_PLATES.lb).perSide).toEqual([45, 45]);
    expect(platesFor(135, 45, DEFAULT_PLATES.lb).perSide).toEqual([45]);
  });

  it("finds exact loads greedy would miss", () => {
    // 80 on a 20 bar = 30 per side; greedy 20 + (10 unavailable) fails, 15 + 15 works
    expect(platesFor(80, 20, [20, 15])).toEqual({ perSide: [15, 15], loaded: 80, remainder: 0 });
  });

  it("rounds down to the nearest loadable weight", () => {
    expect(platesFor(101, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [25, 15], loaded: 100, remainder: 1 });
  });

  it("handles an empty or too-light bar", () => {
    expect(platesFor(20, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [], loaded: 20, remainder: 0 });
    expect(platesFor(15, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [], loaded: 20, remainder: -5 });
  });
});
