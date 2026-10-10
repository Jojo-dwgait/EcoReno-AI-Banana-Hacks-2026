export type PlannedChange = {
  id: string;
  /** What to add or replace, in concrete visual terms. */
  instruction: string;
  /** Where in the photo, in plain words ("front lawn, lower left"). */
  targetArea: string;
  /** Region-specific visual descriptors from the site profile (never numbers, never city names). */
  styleDescriptors: string[];
};

export type EditPlan = {
  changes: PlannedChange[];
  preserve: string[];
  forbidden: string[];
  /** Metric keys behind the changes; kept for the evidence trail, never sent to the image model. */
  climateBasis: string[];
};

export const BASE_PRESERVE = [
  "the exact building geometry, roofline, and roof shape",
  "every window and door: position, size, and style",
  "the driveway and walkway footprints and materials, unless a change below targets them",
  "the camera angle, framing, and perspective",
  "the lighting direction, time of day, and shadows",
  "the current weather and sky",
  "the visible age, dirt, and wear of the house",
  "neighboring houses, cars, fences, and street",
  "vegetation outside the target areas",
];

export const BASE_FORBIDDEN = [
  "repainting or re-siding the house",
  "adding new buildings, rooms, fences, or structures",
  "turning planted or grass areas into new concrete or paving",
  "changing the sky, season, or weather",
  "adding people, animals, vehicles, text, or logos",
  "making the house look newly built or staged",
];

/** Renders the plan into the prompt template from CLAUDE.md. Numbers and city names are deliberately excluded. */
export function buildEditPrompt(plan: EditPlan): string {
  const changes = plan.changes
    .map((c, i) => {
      const style = c.styleDescriptors.length ? ` Style: ${c.styleDescriptors.join("; ")}.` : "";
      return `${i + 1}. ${c.instruction} Target: ${c.targetArea}.${style}`;
    })
    .join("\n");
  return [
    "Edit the UPLOADED home photograph. This is a realistic renovation concept of the same house, not a new image.",
    "Apply ONLY these changes:",
    changes,
    "Preserve exactly:",
    ...plan.preserve.map((p) => `- ${p}`),
    "Never:",
    ...plan.forbidden.map((f) => `- ${f}`),
    "Keep ordinary realistic imperfections. Match the original photo's color, grain, and sharpness so the edit blends in. Output the full edited photograph at the same framing.",
  ].join("\n");
}
