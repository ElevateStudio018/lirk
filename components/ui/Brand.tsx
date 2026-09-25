import type { CSSProperties } from "react";

/** Kleo Ring — same geometry as kleo-platform components/brand/kleo-ring.tsx. */
export const RING_UPPER_ARC = "M100,20 a80,80 0 0 1 69.3,40 L152,70 a60,60 0 0 0 -52,-30 Z";
export const RING_LOWER_ARC = "M169.3,140 a80,80 0 0 1 -138.6,0 L48,130 a60,60 0 0 0 104,0 Z";

export function KleoMark({
  size = 28,
  color = "currentColor",
  className,
  style,
}: {
  size?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} style={style} aria-hidden>
      <path d={RING_UPPER_ARC} fill={color} />
      <path d={RING_LOWER_ARC} fill={color} />
      <circle cx="100" cy="100" r="22" fill={color} />
    </svg>
  );
}

export function KleoLockup({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} aria-label="Kleo">
      <KleoMark size={size} />
      <span
        className="font-display font-semibold"
        style={{ fontSize: size * 0.9, letterSpacing: "-0.045em", lineHeight: 1 }}
      >
        Kleo
      </span>
    </span>
  );
}
