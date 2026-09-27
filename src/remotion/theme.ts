export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

export const theme = {
  bg: "#fbfbfc",
  surface: "#ffffff",
  ink: "#0c0e13",
  text: "#1a1d24",
  muted: "#5d6472",
  subtle: "#a3a9b5",
  line: "#e5e7eb",
  brand: "#ff5a36",
  brandSoft: "#fff0eb",
  good: "#12a150",
  goodSoft: "#e7f7ee",
  bad: "#e5484d",
  badSoft: "#fdecec",
  info: "#2f6fed",
  infoSoft: "#eaf1ff",
  warn: "#d99a00",
  warnSoft: "#fff6dc",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** Accent palette for multi-item scenes (steps, series). */
export const accents = [theme.brand, theme.info, theme.good, theme.warn, "#8b5cf6", "#0ea5a4"];
