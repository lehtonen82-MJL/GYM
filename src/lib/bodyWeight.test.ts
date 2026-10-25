import { bodyWeightSummary } from "./bodyWeight";

const m = (measured_on: string, weight_kg: number) => ({ measured_on, weight_kg });

describe("bodyWeightSummary", () => {
  it("gives the latest weight, the change since the previous one and since ~30 days before it", () => {
    expect(
      bodyWeightSummary([m("2026-09-20", 84), m("2026-09-26", 83.5), m("2026-10-18", 82.6), m("2026-10-25", 82.1)])
    ).toEqual({ latest: m("2026-10-25", 82.1), sincePrevious: -0.5, since30Days: -1.4 });
  });

  it("sorts by date and leaves changes out when there is nothing to compare with", () => {
    expect(bodyWeightSummary([m("2026-10-25", 82), m("2026-10-20", 82.5)])).toEqual({
      latest: m("2026-10-25", 82),
      sincePrevious: -0.5,
      since30Days: null,
    });
    expect(bodyWeightSummary([m("2026-10-25", 82)])).toEqual({ latest: m("2026-10-25", 82), sincePrevious: null, since30Days: null });
    expect(bodyWeightSummary([])).toBeNull();
  });
});
