export const SOURCE_PANEL_NAME = "Source";

export const SOURCE_TOGGLE_LABEL = {
  open: "hide source",
  closed: "show source",
} as const;

export type SourceToggleLabel = (typeof SOURCE_TOGGLE_LABEL)[keyof typeof SOURCE_TOGGLE_LABEL];
