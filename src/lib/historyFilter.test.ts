import { visibleSelection } from "./historyFilter";

describe("visibleSelection", () => {
  const visible = [{ id: "a" }, { id: "b" }];

  it("drops selected workouts that the search has hidden", () => {
    expect(visibleSelection(new Set(["a", "hidden"]), visible)).toEqual(["a"]);
  });

  it("is empty when only hidden workouts are selected", () => {
    expect(visibleSelection(new Set(["hidden"]), visible)).toEqual([]);
  });
});
