import { describe, expect, it } from "vitest";
import { INTERVENTIONS } from "../lib/interventions";
import { nextStepsFor } from "../lib/nextSteps";

describe("next steps", () => {
  it("gives every upgrade at least one next step, using only https links", () => {
    for (const iv of INTERVENTIONS) {
      const steps = nextStepsFor(iv.id, "MN");
      expect(steps.length, iv.id).toBeGreaterThan(0);
      for (const s of steps) if (s.url) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it("adds a state-specific incentives link where energy incentives commonly apply", () => {
    expect(nextStepsFor("rooftop-solar", "AZ").some((s) => s.url?.endsWith("state=AZ"))).toBe(true);
    expect(nextStepsFor("rain-barrels", "AZ").some((s) => s.url?.includes("dsireusa"))).toBe(false);
  });
});
