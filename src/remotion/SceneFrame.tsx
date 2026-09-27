import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "@/lib/video/schema";
import { enter, progress } from "./animation";
import { Rich } from "./Rich";
import { theme } from "./theme";

/**
 * Shared scene chrome: background, headline, camera move and transitions.
 * The camera ("zoom-in", "pan") is a slow continuous move that keeps the frame
 * alive without distracting from the content.
 */
export function SceneFrame({
  scene,
  children,
  showHeadline = true,
  align = "top",
}: {
  scene: Scene;
  children: React.ReactNode;
  showHeadline?: boolean;
  align?: "top" | "center";
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = scene.transition;

  const inP = t === "none" ? 1 : progress(frame, 0, 14);
  const outP = t === "none" ? 0 : interpolate(frame, [durationInFrames - 10, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  let transform = "";
  if (t === "slide") transform += `translateX(${(1 - inP) * 60 - outP * 60}px) `;
  if (t === "zoom") transform += `scale(${0.94 + inP * 0.06 + outP * 0.04}) `;

  const camera = progress(frame, 0, durationInFrames);
  if (scene.animation === "zoom-in") transform += `scale(${1 + camera * 0.06}) `;
  if (scene.animation === "pan") transform += `translateX(${(0.5 - camera) * 40}px) `;

  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.font, color: theme.text, overflow: "hidden" }}>
      <Backdrop />
      <AbsoluteFill style={{ opacity: inP * (1 - outP), transform, transformOrigin: "50% 55%" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "64px 88px",
            display: "flex",
            flexDirection: "column",
            justifyContent: align === "center" ? "center" : "flex-start",
            gap: 36,
          }}
        >
          {showHeadline && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...enter(frame, 2), fontSize: 50, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08, color: theme.ink }}>
                <Rich text={scene.headline} emphasis={scene.emphasis} start={16} />
              </div>
              {scene.subheadline && (
                <div style={{ ...enter(frame, 8), fontSize: 26, color: theme.muted, lineHeight: 1.35 }}>{scene.subheadline}</div>
              )}
            </div>
          )}
          <div
            style={{
              flex: align === "center" ? undefined : 1,
              position: "relative",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingBottom: align === "center" ? 0 : 24,
            }}
          >
            {children}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Quiet moving dot grid + a soft accent blob. */
function Backdrop() {
  const frame = useCurrentFrame();
  const drift = (frame * 0.15) % 32;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: -40,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.4px, transparent 1.4px)",
          backgroundSize: "32px 32px",
          transform: `translate(${drift}px, ${drift / 2}px)`,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          right: -140 + Math.sin(frame / 60) * 20,
          top: -160 + Math.cos(frame / 70) * 20,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%)",
          filter: "blur(20px)",
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        // Liquid glass card
        background: "linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.06))",
        border: `1.5px solid ${theme.line}`,
        borderRadius: 28,
        boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.5)",
        backdropFilter: "blur(24px) saturate(160%)",
        padding: "24px 28px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
