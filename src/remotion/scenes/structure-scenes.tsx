import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ArrowRight, Check, RotateCw, X } from "lucide-react";
import type { SceneOf } from "@/lib/video/schema";
import { enter, pop, progress, staggerDelay } from "../animation";
import { SceneIconView } from "../icons";
import { Rich } from "../Rich";
import { Card, SceneFrame } from "../SceneFrame";
import { accents, theme } from "../theme";

export function ConceptScene({ scene }: { scene: SceneOf<"concept"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pts = scene.visual.points;
  const cols = pts.length <= 2 ? pts.length : 2;
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 22 }}>
        {pts.map((p, i) => {
          const d = scene.animation === "sequential" ? staggerDelay(i, pts.length, 14, durationInFrames * 0.55) : 14 + i * 6;
          const s = pop(frame, fps, d);
          return (
            <Card key={i} style={{ opacity: s, transform: `translateY(${(1 - s) * 30}px) scale(${0.96 + s * 0.04})`, display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 20, background: `${accents[i % accents.length]}18`, display: "grid", placeItems: "center" }}>
                {p.icon ? <SceneIconView name={p.icon} size={34} color={accents[i % accents.length]} /> : <span style={{ fontSize: 30, fontWeight: 800, color: accents[i % accents.length] }}>{i + 1}</span>}
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 750, color: theme.ink, letterSpacing: "-0.02em" }}>
                  <Rich text={p.label} emphasis={scene.emphasis} start={d + 10} />
                </div>
                {p.detail && <div style={{ fontSize: 23, color: theme.muted, marginTop: 6, lineHeight: 1.35 }}>{p.detail}</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </SceneFrame>
  );
}

export function ComparisonScene({ scene }: { scene: SceneOf<"comparison"> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { left, right, verdict } = scene.visual;
  const side = (s: typeof left, dir: 1 | -1, color: string, soft: string, base: number) => {
    const p = progress(frame, base, 20);
    return (
      <Card style={{ flex: 1, opacity: p, transform: `translateX(${(1 - p) * 60 * dir}px)`, borderTop: `6px solid ${color}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          {s.icon && (
            <div style={{ width: 52, height: 52, borderRadius: 16, background: soft, display: "grid", placeItems: "center" }}>
              <SceneIconView name={s.icon} size={28} color={color} />
            </div>
          )}
          <div style={{ fontSize: 34, fontWeight: 800, color: theme.ink }}>{s.title}</div>
        </div>
        {s.items.map((it, i) => (
          <div key={i} style={{ ...enter(frame, base + 14 + i * 8, 14), display: "flex", gap: 12, fontSize: 25, lineHeight: 1.35, marginTop: 10, color: theme.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: color, marginTop: 12, flexShrink: 0 }} />
            <span>
              <Rich text={it} emphasis={scene.emphasis} start={base + 24 + i * 8} />
            </span>
          </div>
        ))}
      </Card>
    );
  };
  const vs = pop(frame, fps, 22);
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", gap: 28, alignItems: "stretch", position: "relative" }}>
        {side(left, -1, theme.info, theme.infoSoft, 6)}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${vs})`, width: 64, height: 64, borderRadius: 32, background: theme.ink, color: theme.onBrand, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22, zIndex: 2 }}>
          vs
        </div>
        {side(right, 1, theme.brand, theme.brandSoft, 12)}
      </div>
      {verdict && <div style={{ ...enter(frame, 60), marginTop: 26, fontSize: 28, fontWeight: 650, color: theme.ink, textAlign: "center" }}>{verdict}</div>}
    </SceneFrame>
  );
}

export function TimelineScene({ scene }: { scene: SceneOf<"timeline"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ev = scene.visual.events;
  const line = progress(frame, 8, Math.min(60, durationInFrames * 0.5));
  return (
    <SceneFrame scene={scene}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ position: "relative", height: 8, background: theme.line, borderRadius: 4 }}>
          <div style={{ position: "absolute", inset: 0, width: `${line * 100}%`, background: theme.brand, borderRadius: 4 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${ev.length}, 1fr)`, marginTop: -26 }}>
          {ev.map((e, i) => {
            const at = 8 + (Math.min(60, durationInFrames * 0.5) * (i + 0.5)) / ev.length;
            const s = pop(frame, fps, at);
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 10px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: theme.bg, border: `6px solid ${theme.brand}`, transform: `scale(${s})` }} />
                <div style={{ ...enter(frame, at + 4, 16), marginTop: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: theme.brand }}>{e.time}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: theme.ink, marginTop: 6, lineHeight: 1.2 }}>
                    <Rich text={e.label} emphasis={scene.emphasis} start={at + 12} />
                  </div>
                  {e.detail && <div style={{ fontSize: 20, color: theme.muted, marginTop: 6, lineHeight: 1.3 }}>{e.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
}

export function ProcessScene({ scene }: { scene: SceneOf<"process"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const steps = scene.visual.steps;
  const avail = durationInFrames * 0.6;
  if (scene.visual.cyclic && steps.length >= 3) {
    const R = 190;
    const cx = 560;
    const cy = 230;
    const spin = interpolate(frame, [0, durationInFrames], [0, 360]);
    return (
      <SceneFrame scene={scene}>
        <div style={{ position: "relative", width: 1120, height: 470 }}>
          <svg width={1120} height={470} style={{ position: "absolute", inset: 0 }}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={theme.line} strokeWidth={6} strokeDasharray="10 12" />
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={theme.brand} strokeWidth={6} strokeLinecap="round" strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - progress(frame, 10, avail))} transform={`rotate(-90 ${cx} ${cy})`} />
          </svg>
          <div style={{ position: "absolute", left: cx - 32, top: cy - 32, transform: `rotate(${spin}deg)` }}>
            <RotateCw size={64} color={theme.subtle} />
          </div>
          {steps.map((s, i) => {
            const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
            const d = staggerDelay(i, steps.length, 10, avail);
            const p = pop(frame, fps, d);
            return (
              <div key={i} style={{ position: "absolute", left: cx + Math.cos(a) * R, top: cy + Math.sin(a) * R, transform: `translate(-50%, -50%) scale(${p})`, width: 250 }}>
                <Card style={{ padding: "14px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: accents[i % accents.length] }}>{i + 1}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: theme.ink, lineHeight: 1.2 }}>{s.label}</div>
                </Card>
              </div>
            );
          })}
        </div>
      </SceneFrame>
    );
  }
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {steps.map((s, i) => {
          const d = staggerDelay(i, steps.length, 10, avail);
          const p = pop(frame, fps, d);
          const arrow = progress(frame, d + 8, 12);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <Card style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, padding: "22px 20px", minHeight: 210 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: accents[i % accents.length], color: theme.onBrand, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>{i + 1}</div>
                  {s.icon && <SceneIconView name={s.icon} size={28} color={accents[i % accents.length]} />}
                </div>
                <div style={{ fontSize: steps.length > 4 ? 22 : 26, fontWeight: 750, color: theme.ink, lineHeight: 1.2 }}>
                  <Rich text={s.label} emphasis={scene.emphasis} start={d + 12} />
                </div>
                {s.detail && <div style={{ fontSize: steps.length > 4 ? 17 : 20, color: theme.muted, marginTop: 8, lineHeight: 1.3 }}>{s.detail}</div>}
              </Card>
              {i < steps.length - 1 && (
                <div style={{ width: 36, display: "grid", placeItems: "center", opacity: arrow, transform: `translateX(${(1 - arrow) * -10}px)` }}>
                  <ArrowRight size={28} color={theme.subtle} strokeWidth={2.5} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
}

export function CauseEffectScene({ scene }: { scene: SceneOf<"cause-effect"> }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const chain = scene.visual.chain;
  const avail = durationInFrames * 0.7;
  const W = 1100;
  const nodeW = Math.min(250, (W - (chain.length - 1) * 60) / chain.length);
  const gap = chain.length > 1 ? (W - nodeW * chain.length) / (chain.length - 1) : 0;
  // The "current" link glows as the narration moves through the chain.
  const active = Math.min(chain.length - 1, Math.floor(progress(frame, 10, avail) * chain.length));
  return (
    <SceneFrame scene={scene}>
      <div style={{ position: "relative", width: W, height: 360 }}>
        <svg width={W} height={360} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <marker id="ce-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.brand} />
            </marker>
          </defs>
          {chain.slice(0, -1).map((_, i) => {
            const x1 = i * (nodeW + gap) + nodeW + 6;
            const x2 = (i + 1) * (nodeW + gap) - 10;
            const d = staggerDelay(i, chain.length, 10, avail) + 14;
            const p = progress(frame, d, 16);
            const len = x2 - x1;
            const flow = (frame * 1.5) % 20;
            return (
              <g key={i}>
                <line x1={x1} y1={180} x2={x1 + len * p} y2={180} stroke={theme.brand} strokeWidth={5} strokeLinecap="round" markerEnd={p > 0.95 ? "url(#ce-arrow)" : undefined} strokeDasharray={p >= 1 ? "12 8" : undefined} strokeDashoffset={-flow} />
              </g>
            );
          })}
        </svg>
        {chain.map((c, i) => {
          const d = staggerDelay(i, chain.length, 10, avail);
          const p = pop(frame, fps, d);
          const isActive = i === active;
          return (
            <div key={i} style={{ position: "absolute", left: i * (nodeW + gap), top: 180, width: nodeW, transform: `translateY(-50%) scale(${p * (isActive ? 1.04 : 1)})`, opacity: p }}>
              <Card style={{ padding: "20px 18px", textAlign: "center", borderColor: isActive ? theme.brand : theme.line, borderWidth: 2 }}>
                {c.icon && (
                  <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}>
                    <SceneIconView name={c.icon} size={40} color={isActive ? theme.brand : theme.muted} />
                  </div>
                )}
                <div style={{ fontSize: 25, fontWeight: 750, color: theme.ink, lineHeight: 1.2 }}>
                  <Rich text={c.label} emphasis={scene.emphasis} start={d + 10} />
                </div>
                {c.detail && <div style={{ fontSize: 18, color: theme.muted, marginTop: 8, lineHeight: 1.3 }}>{c.detail}</div>}
              </Card>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
}

export function MisconceptionScene({ scene }: { scene: SceneOf<"misconception"> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = pop(frame, fps, 26);
  const right = progress(frame, 40, 20);
  return (
    <SceneFrame scene={scene}>
      <div style={{ display: "flex", gap: 28 }}>
        <Card style={{ ...enter(frame, 6), flex: 1, background: theme.badSoft, border: "none", position: "relative" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: theme.bad, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vanligt missförstånd</div>
          <div style={{ fontSize: 32, color: theme.ink, marginTop: 12, lineHeight: 1.3, textDecorationLine: frame > 30 ? "line-through" : "none", textDecorationColor: theme.bad, textDecorationThickness: 3 }}>
            {scene.visual.wrong}
          </div>
          <div style={{ position: "absolute", right: 20, top: 16, transform: `scale(${stamp}) rotate(-12deg)`, width: 64, height: 64, borderRadius: 32, background: theme.bad, display: "grid", placeItems: "center" }}>
            <X size={40} color="#fff" strokeWidth={3} />
          </div>
        </Card>
        <Card style={{ flex: 1, background: theme.goodSoft, border: "none", opacity: right, transform: `translateX(${(1 - right) * 40}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 800, color: theme.good, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Check size={24} strokeWidth={3} /> Så är det
          </div>
          <div style={{ fontSize: 32, color: theme.ink, marginTop: 12, lineHeight: 1.3 }}>
            <Rich text={scene.visual.right} emphasis={scene.emphasis} start={52} color="rgba(48,209,88,0.3)" />
          </div>
        </Card>
      </div>
      <div style={{ ...enter(frame, 64), marginTop: 28, fontSize: 27, color: theme.text, lineHeight: 1.4, maxWidth: 1080 }}>
        <span style={{ fontWeight: 800, color: theme.ink }}>Varför? </span>
        {scene.visual.why}
      </div>
    </SceneFrame>
  );
}
