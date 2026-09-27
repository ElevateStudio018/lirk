import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneOf } from "@/lib/video/schema";
import { enter, pop, progress, staggerDelay } from "../animation";
import { Rich } from "../Rich";
import { Card, SceneFrame } from "../SceneFrame";
import { accents, theme } from "../theme";

/** Pretty-prints plain-text math: * → ·, - → −, x^2 → x². */
export function prettyMath(expr: string) {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return expr
    .replace(/\^(\d+)/g, (_, d: string) => d.split("").map((c) => sup[c] ?? c).join(""))
    .replace(/\s*\*\s*/g, " · ")
    .replace(/(^|[\s(=])-(?=\s|\d|[a-z(])/gi, "$1−")
    .replace(/ - /g, " − ");
}

export function BigNumberScene({ scene }: { scene: SceneOf<"big-number"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { value, decimals, prefix, suffix, caption } = scene.visual;
  const count = progress(frame, 8, Math.min(50, durationInFrames * 0.4));
  const shown = (value * count).toFixed(decimals).replace(".", ",");
  const pulse = scene.animation === "pulse" ? 1 + Math.sin(Math.max(0, frame - 60) / 6) * 0.015 * (frame > 60 ? 1 : 0) : 1;
  const arc = 2 * Math.PI * 150;
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", alignItems: "center", gap: 64, height: "100%" }}>
        <div style={{ position: "relative", width: 340, height: 340, flexShrink: 0, transform: `scale(${pop(frame, fps, 0) * pulse})` }}>
          <svg width={340} height={340} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx={170} cy={170} r={150} fill="none" stroke={theme.brandSoft} strokeWidth={18} />
            <circle cx={170} cy={170} r={150} fill="none" stroke={theme.brand} strokeWidth={18} strokeLinecap="round" strokeDasharray={arc} strokeDashoffset={arc * (1 - count)} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: shown.length > 6 ? 58 : 76, fontWeight: 850, color: theme.ink, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
              {prefix}
              {shown}
              {suffix && <span style={{ fontSize: "0.5em", marginLeft: 6, color: theme.muted }}>{suffix}</span>}
            </div>
          </div>
        </div>
        <div style={{ ...enter(frame, 30), fontSize: 36, lineHeight: 1.35, color: theme.ink, fontWeight: 600, maxWidth: 620 }}>
          <Rich text={caption} emphasis={scene.emphasis} start={44} />
        </div>
      </div>
    </SceneFrame>
  );
}

function Highlighted({ text, highlight, p }: { text: string; highlight: string | null; p: number }) {
  const pretty = prettyMath(text);
  const h = highlight ? prettyMath(highlight) : null;
  const idx = h ? pretty.indexOf(h) : -1;
  if (!h || idx === -1) return <>{pretty}</>;
  return (
    <>
      {pretty.slice(0, idx)}
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ position: "absolute", left: -6, right: -6, top: "8%", bottom: "8%", borderRadius: 10, background: theme.brandSoft, border: `3px solid ${theme.brand}`, opacity: p, transform: `scale(${0.8 + p * 0.2})` }} />
        <span style={{ position: "relative", color: p > 0.5 ? "#e8431f" : undefined }}>{h}</span>
      </span>
      {pretty.slice(idx + h.length)}
    </>
  );
}

export function EquationScene({ scene }: { scene: SceneOf<"equation"> }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const lines = scene.visual.lines;
  const avail = durationInFrames * 0.75;
  const delays = lines.map((_, i) => staggerDelay(i, lines.length, 8, avail, 14, 60));
  const currentIdx = delays.filter((d) => frame >= d).length - 1;
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", flexDirection: "column", gap: lines.length > 4 ? 10 : 18 }}>
        {lines.map((l, i) => {
          const d = delays[i];
          const isCurrent = i === currentIdx;
          const dim = i < currentIdx ? 0.45 : 1;
          const hl = progress(frame, d + 14, 14);
          return (
            <div key={i} style={{ ...enter(frame, d, 20), display: "flex", alignItems: "center", gap: 36 }}>
              <div
                style={{
                  fontSize: lines.length > 4 ? 46 : 58,
                  fontWeight: 650,
                  color: theme.ink,
                  opacity: frame >= d ? dim : 0,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                  minWidth: 520,
                  transition: "none",
                }}
              >
                <Highlighted text={l.expression} highlight={l.highlight} p={isCurrent || i === lines.length - 1 ? hl : 0} />
              </div>
              {l.note && (
                <div style={{ ...enter(frame, d + 10, 12), fontSize: 26, color: accents[i % accents.length], fontWeight: 700, padding: "6px 16px", borderRadius: 999, background: `${accents[i % accents.length]}14`, opacity: frame >= d + 10 ? dim : 0 }}>
                  {prettyMath(l.note)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
}

export function GraphScene({ scene }: { scene: SceneOf<"graph"> }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { kind, series, x_label, y_label, source_note } = scene.visual;
  const W = 900;
  const H = 380;
  const pad = { l: 80, r: 30, t: 20, b: 60 };
  const xs = series[0].points.map((p) => p.x);
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const minY = Math.min(0, ...all);
  const maxY = Math.max(...all) * 1.1 || 1;
  const sx = (i: number) => pad.l + ((W - pad.l - pad.r) * (kind === "bar" ? i + 0.5 : i)) / Math.max(1, kind === "bar" ? xs.length : xs.length - 1);
  const sy = (y: number) => H - pad.b - ((H - pad.t - pad.b) * (y - minY)) / (maxY - minY);
  const axes = progress(frame, 4, 16);
  const draw = progress(frame, 18, Math.min(70, durationInFrames * 0.5));
  const ticks = 4;
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = minY + ((maxY - minY) * i) / ticks;
            return (
              <g key={i} opacity={axes}>
                <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={theme.line} strokeWidth={1.5} />
                <text x={pad.l - 12} y={sy(v) + 6} textAnchor="end" fontSize={18} fill={theme.muted} fontFamily={theme.font}>
                  {Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}
                </text>
              </g>
            );
          })}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={(H - pad.b) * axes + pad.t * (1 - axes)} stroke={theme.ink} strokeWidth={2.5} />
          <line x1={pad.l} x2={pad.l + (W - pad.r - pad.l) * axes} y1={H - pad.b} y2={H - pad.b} stroke={theme.ink} strokeWidth={2.5} />
          {xs.map((x, i) => (
            <text key={i} x={sx(i)} y={H - pad.b + 30} textAnchor="middle" fontSize={18} fill={theme.muted} fontFamily={theme.font} opacity={axes}>
              {x}
            </text>
          ))}
          <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill={theme.ink} fontFamily={theme.font} opacity={axes}>
            {x_label}
          </text>
          <text x={-(H - pad.b) / 2} y={22} transform="rotate(-90)" textAnchor="middle" fontSize={20} fontWeight={700} fill={theme.ink} fontFamily={theme.font} opacity={axes}>
            {y_label}
          </text>
          {series.map((s, si) => {
            const color = accents[si % accents.length];
            if (kind === "bar") {
              const bw = ((W - pad.l - pad.r) / xs.length) * (series.length > 1 ? 0.35 : 0.6);
              return s.points.map((p, i) => {
                const g = progress(frame, 18 + i * 5 + si * 3, 20);
                const top = sy(p.y);
                const h = (H - pad.b - top) * g;
                const x = sx(i) - (series.length > 1 ? bw * (si === 0 ? 1 : 0) : bw / 2);
                return <rect key={`${si}-${i}`} x={x} y={H - pad.b - h} width={bw} height={h} rx={8} fill={color} />;
              });
            }
            const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(p.y)}`).join(" ");
            const len = s.points.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(sx(i) - sx(i - 1), sy(p.y) - sy(s.points[i - 1].y))), 0);
            const visible = Math.floor(draw * (s.points.length - 1) + 0.001);
            return (
              <g key={si}>
                <path d={d} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
                {s.points.map((p, i) => (i <= visible ? <circle key={i} cx={sx(i)} cy={sy(p.y)} r={7} fill="#fff" stroke={color} strokeWidth={4} /> : null))}
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 20 }}>
          {series.map((s, i) => (
            <div key={i} style={{ ...enter(frame, 24 + i * 6), display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 650 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: accents[i % accents.length] }} />
              {s.name}
            </div>
          ))}
          {source_note && <div style={{ ...enter(frame, 40), fontSize: 16, color: theme.muted, maxWidth: 200, marginTop: 10 }}>{source_note}</div>}
        </div>
      </div>
    </SceneFrame>
  );
}

export function ExampleScene({ scene }: { scene: SceneOf<"example"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const steps = scene.visual.steps;
  const avail = durationInFrames * 0.65;
  const answerAt = 14 + avail;
  const ans = pop(frame, fps, answerAt);
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", gap: 28 }}>
        <Card style={{ ...enter(frame, 4), flex: "0 0 380px", background: theme.infoSoft, border: "none" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.info, textTransform: "uppercase", letterSpacing: "0.06em" }}>Uppgift</div>
          <div style={{ fontSize: 28, color: theme.ink, marginTop: 10, lineHeight: 1.35, fontWeight: 600 }}>{prettyMath(scene.visual.problem)}</div>
        </Card>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((s, i) => {
            const d = staggerDelay(i, steps.length, 14, avail - 10);
            return (
              <div key={i} style={{ ...enter(frame, d, 20), display: "flex", gap: 16, alignItems: "baseline" }}>
                <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 17, background: theme.ink, color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 800 }}>{i + 1}</div>
                <div style={{ fontSize: steps.length > 4 ? 24 : 28, color: theme.ink, lineHeight: 1.35 }}>
                  <Rich text={prettyMath(s)} emphasis={scene.emphasis} start={d + 10} />
                </div>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 8,
              alignSelf: "flex-start",
              opacity: ans,
              transform: `scale(${interpolate(ans, [0, 1], [0.85, 1])})`,
              background: theme.goodSoft,
              color: theme.good,
              borderRadius: 18,
              padding: "12px 22px",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            Svar: {prettyMath(scene.visual.answer)}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}
