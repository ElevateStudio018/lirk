import { cn } from "@/lib/utils";

type ProgressRingProps = {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  label?: React.ReactNode;
  "aria-label"?: string;
};

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  className,
  trackClassName = "stroke-surface-sunken",
  indicatorClassName = "stroke-brand",
  label,
  ...rest
}: ProgressRingProps) {
  const v = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={rest["aria-label"]}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", indicatorClassName)}
        />
      </svg>
      {label !== undefined && <div className="absolute inset-0 grid place-items-center">{label}</div>}
    </div>
  );
}
