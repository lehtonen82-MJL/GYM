import { effectiveEquipment, matchesEquipment, pickLatestEntryForEquipment } from "./equipment";

describe("effectiveEquipment", () => {
  it("prefers the explicit entry tool", () => {
    expect(effectiveEquipment("dumbbell", "barbell")).toBe("dumbbell");
  });
  it("falls back to the definition default", () => {
    expect(effectiveEquipment(null, "barbell")).toBe("barbell");
    expect(effectiveEquipment(undefined, "barbell")).toBe("barbell");
  });
  it("is null for unlinked exercises without a tool", () => {
    expect(effectiveEquipment(null, null)).toBeNull();
  });
});

describe("matchesEquipment", () => {
  it("treats an untagged entry as the default tool", () => {
    expect(matchesEquipment(null, "barbell", "barbell")).toBe(true);
    expect(matchesEquipment(null, undefined, "barbell")).toBe(true);
  });
  it("separates tools", () => {
    expect(matchesEquipment("dumbbell", "barbell", "barbell")).toBe(false);
    expect(matchesEquipment(null, "dumbbell", "barbell")).toBe(false);
    expect(matchesEquipment("dumbbell", undefined, "barbell")).toBe(false);
  });
  it("keeps legacy behaviour for unlinked exercises", () => {
    expect(matchesEquipment(null, null, null)).toBe(true);
    expect(matchesEquipment("dumbbell", null, null)).toBe(false);
  });
});

describe("pickLatestEntryForEquipment", () => {
  const workoutIds = ["w3", "w2", "w1"]; // most recent first
  const entries = [
    { id: "a", workout_id: "w1", equipment_type: null },
    { id: "b", workout_id: "w2", equipment_type: "dumbbell" },
    { id: "c", workout_id: "w3", equipment_type: "barbell" },
  ];

  it("returns the most recent entry with the same tool", () => {
    expect(pickLatestEntryForEquipment(entries, workoutIds, "dumbbell", "barbell")?.id).toBe("b");
    expect(pickLatestEntryForEquipment(entries, workoutIds, "barbell", "barbell")?.id).toBe("c");
  });

  it("uses the default tool when none is requested", () => {
    expect(pickLatestEntryForEquipment(entries, workoutIds, undefined, "barbell")?.id).toBe("c");
  });

  it("skips entries rejected by accept", () => {
    expect(pickLatestEntryForEquipment(entries, workoutIds, "barbell", "barbell", (e) => e.id !== "c")?.id).toBe("a");
  });

  it("returns null when the tool was never used", () => {
    expect(pickLatestEntryForEquipment(entries, workoutIds, "kettlebell", "barbell")).toBeNull();
  });
});
