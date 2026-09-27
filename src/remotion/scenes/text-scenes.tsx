import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, HelpCircle, Lightbulb, Quote } from "lucide-react";
import type { SceneOf } from "@/lib/video/schema";
import { enter, pop, progress, staggerDelay } from "../animation";
import { SceneIconView } from "../icons";
import { Rich } from "../Rich";
import { Card, SceneFrame } from "../SceneFrame";
import { theme } from "../theme";

export function TitleScene({ scene }: { scene: SceneOf<"title"> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = scene.headline.split(" ");
  const iconPop = pop(frame, fps, 4);
  const ring = progress(frame, 10, 40);
  return (
    <SceneFrame scene={scene} showHeadline={false} align="center">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 28 }}>
        {scene.visual.icon && (
          <div style={{ position: "relative", width: 104, height: 104, transform: `scale(${iconPop})` }}>
            <div
              style={{
                position: "absolute",
                inset: -18 * ring,
                borderRadius: "50%",
                border: `2px solid ${theme.brand}`,
                opacity: 1 - ring,
              }}
            />
            <div style={{ width: 104, height: 104, borderRadius: 32, background: theme.brand, display: "grid", placeItems: "center" }}>
              <SceneIconView name={scene.visual.icon} size={52} color="#fff" />
            </div>
          </div>
        )}
        {scene.visual.kicker && (
          <div style={{ ...enter(frame, 6), fontSize: 24, fontWeight: 700, color: theme.brand, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {scene.visual.kicker}
          </div>
        )}
        <div style={{ fontSize: 84, fontWeight: 850, letterSpacing: "-0.045em", lineHeight: 1, color: theme.ink, maxWidth: 1000 }}>
          {words.map((w, i) => (
            <span key={i} style={{ display: "inline-block", marginRight: 22, ...enter(frame, 10 + i * 4, 40, 20) }}>
              {w}
            </span>
          ))}
        </div>
        {scene.subheadline && <div style={{ ...enter(frame, 14 + words.length * 4), fontSize: 30, color: theme.muted, maxWidth: 900 }}>{scene.subheadline}</div>}
      </div>
    </SceneFrame>
  );
}

export function QuoteScene({ scene }: { scene: SceneOf<"quote"> }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const words = scene.visual.text.split(" ");
  const per = Math.max(1, Math.min(5, (durationInFrames * 0.5) / words.length));
  return (
    <SceneFrame scene={scene} align="center">
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <Quote size={72} color={theme.brand} style={{ flexShrink: 0, ...enter(frame, 4) }} />
        <div>
          <div style={{ fontSize: 42, lineHeight: 1.3, fontWeight: 600, color: theme.ink, letterSpacing: "-0.02em" }}>
            {words.map((w, i) => (
              <span key={i} style={{ opacity: 0.15 + 0.85 * progress(frame, 12 + i * per, 8) }}>
                {w}{" "}
              </span>
            ))}
          </div>
          {scene.visual.attribution && (
            <div style={{ ...enter(frame, 16 + words.length * per), marginTop: 24, fontSize: 24, color: theme.muted }}>— {scene.visual.attribution}</div>
          )}
        </div>
      </div>
    </SceneFrame>
  );
}

export function DefinitionScene({ scene }: { scene: SceneOf<"definition"> }) {
  const frame = useCurrentFrame();
  const underline = progress(frame, 14, 22);
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ ...enter(frame, 6), alignSelf: "flex-start" }}>
          <div style={{ fontSize: 72, fontWeight: 850, color: theme.ink, letterSpacing: "-0.04em" }}>{scene.visual.term}</div>
          <div style={{ height: 8, borderRadius: 4, background: theme.brand, width: `${underline * 100}%`, marginTop: 4 }} />
        </div>
        <div style={{ ...enter(frame, 22), fontSize: 34, lineHeight: 1.4, color: theme.text, maxWidth: 1040 }}>
          <Rich text={scene.visual.definition} emphasis={scene.emphasis} start={36} />
        </div>
        {scene.visual.example && (
          <Card style={{ ...enter(frame, 48), background: theme.infoSoft, border: "none", maxWidth: 1040 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.info, textTransform: "uppercase", letterSpacing: "0.06em" }}>Exempel</div>
            <div style={{ fontSize: 28, marginTop: 6, color: theme.ink }}>{scene.visual.example}</div>
          </Card>
        )}
      </div>
    </SceneFrame>
  );
}

export function MemoryScene({ scene }: { scene: SceneOf<"memory-trick"> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = scene.visual.mnemonic.split("");
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ transform: `scale(${pop(frame, fps, 2)}) rotate(${interpolate(pop(frame, fps, 2), [0, 1], [-20, 0])}deg)` }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: theme.warnSoft, display: "grid", placeItems: "center" }}>
              <Lightbulb size={46} color={theme.warn} />
            </div>
          </div>
          <div style={{ fontSize: 64, fontWeight: 850, color: theme.ink, letterSpacing: "-0.02em", display: "flex", flexWrap: "wrap" }}>
            {letters.map((ch, i) => (
              <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${(1 - pop(frame, fps, 8 + i * 1.5)) * 30}px)`, opacity: pop(frame, fps, 8 + i * 1.5) }}>
                {ch}
              </span>
            ))}
          </div>
        </div>
        <div style={{ ...enter(frame, 20 + letters.length * 1.5), fontSize: 32, lineHeight: 1.45, color: theme.text, maxWidth: 1040 }}>
          <Rich text={scene.visual.explanation} emphasis={scene.emphasis} start={40 + letters.length} />
        </div>
      </div>
    </SceneFrame>
  );
}

export function SummaryScene({ scene }: { scene: SceneOf<"summary"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const n = scene.visual.points.length;
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {scene.visual.points.map((p, i) => {
          const d = staggerDelay(i, n, 12, durationInFrames * 0.6);
          const check = pop(frame, fps, d + 8);
          return (
            <div key={i} style={{ ...enter(frame, d, 30), display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: theme.goodSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Check size={28} color={theme.good} strokeWidth={3} style={{ transform: `scale(${check})` }} />
              </div>
              <div style={{ fontSize: 32, color: theme.ink, lineHeight: 1.3 }}>
                <Rich text={p} emphasis={scene.emphasis} start={d + 12} />
              </div>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
}

export function QuestionTransitionScene({ scene }: { scene: SceneOf<"question-transition"> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = pop(frame, fps, 0);
  const wobble = Math.sin(frame / 8) * 4 * Math.max(0, 1 - frame / 60);
  return (
    <SceneFrame scene={scene} showHeadline={false} align="center">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 28 }}>
        <div style={{ transform: `scale(${q}) rotate(${wobble}deg)` }}>
          <div style={{ width: 128, height: 128, borderRadius: "50%", background: theme.brand, display: "grid", placeItems: "center" }}>
            <HelpCircle size={72} color="#fff" />
          </div>
        </div>
        <div style={{ ...enter(frame, 10), fontSize: 26, fontWeight: 700, color: theme.brand, textTransform: "uppercase", letterSpacing: "0.08em" }}>{scene.headline}</div>
        <div style={{ ...enter(frame, 16), fontSize: 54, fontWeight: 800, color: theme.ink, letterSpacing: "-0.03em", lineHeight: 1.15, maxWidth: 1000 }}>
          <Rich text={scene.visual.question} emphasis={scene.emphasis} start={30} />
        </div>
        {scene.visual.hint && <div style={{ ...enter(frame, 40), fontSize: 26, color: theme.muted }}>Tips: {scene.visual.hint}</div>}
      </div>
    </SceneFrame>
  );
}
