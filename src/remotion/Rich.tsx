import { useCurrentFrame } from "remotion";
import { progress } from "./animation";
import { theme } from "./theme";

/**
 * Renders text with emphasis terms highlighted by an animated marker stroke.
 * `start` is the frame at which the highlight begins sweeping in.
 */
export function Rich({ text, emphasis, start = 20, color = theme.brandSoft }: { text: string; emphasis: string[]; start?: number; color?: string }) {
  const frame = useCurrentFrame();
  const terms = emphasis.filter((e) => e.trim()).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escape).join("|")})`, "gi");
  const parts = text.split(pattern);
  let hit = 0;
  return (
    <>
      {parts.map((part, i) => {
        const isTerm = terms.some((t) => t.toLowerCase() === part.toLowerCase());
        if (!isTerm) return <span key={i}>{part}</span>;
        const p = progress(frame, start + hit++ * 10, 16);
        return (
          <span
            key={i}
            style={{
              backgroundImage: `linear-gradient(${color}, ${color})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${p * 100}% 100%`,
              borderRadius: 6,
              padding: "0 4px",
              margin: "0 -2px",
              fontWeight: 700,
              color: theme.ink,
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
