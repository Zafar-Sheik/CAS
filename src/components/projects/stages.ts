export const STAGES = ["DISCOVERY", "CONCEPT", "DEVELOPMENT", "DELIVERY", "COMPLETE"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  DISCOVERY: "Discovery",
  CONCEPT: "Concept",
  DEVELOPMENT: "Development",
  DELIVERY: "Delivery",
  COMPLETE: "Complete",
};
export const STAGE_HINT: Record<Stage, string> = {
  DISCOVERY: "Site analysis, brief, budget",
  CONCEPT: "Sketches and 3D models",
  DEVELOPMENT: "Detailed plans and renders",
  DELIVERY: "Documents and site admin",
  COMPLETE: "Handed over",
};
