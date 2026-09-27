export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

export const theme = {
  bg: "#000000",
  surface: "rgba(255,255,255,0.06)",
  ink: "#ffffff",
  text: "#ededf0",
  muted: "#9b9ba3",
  subtle: "#5f5f66",
  line: "rgba(255,255,255,0.12)",
  brand: "#ffffff",
  brandSoft: "rgba(255,255,255,0.14)",
  onBrand: "#000000",
  good: "#30d158",
  goodSoft: "rgba(48,209,88,0.16)",
  bad: "#ff453a",
  badSoft: "rgba(255,69,58,0.16)",
  info: "#64a8ff",
  infoSoft: "rgba(10,132,255,0.18)",
  warn: "#ffd60a",
  warnSoft: "rgba(255,214,10,0.15)",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** Accent palette for multi-item scenes (steps, series). */
export const accents = ["#ffffff", "#64a8ff", "#30d158", "#ffd60a", "#bf5af2", "#64d2ff"];
