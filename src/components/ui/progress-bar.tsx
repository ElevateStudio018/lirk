import { cn } from "@/lib/utils";

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  className?: string;
  indicatorClassName?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
};

export function ProgressBar({ value, className, indicatorClassName, size = "md", ...rest }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={rest["aria-label"]}
      className={cn("w-full overflow-hidden rounded-full bg-white/10", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div
        className={cn("h-full rounded-full bg-white transition-[width] duration-500 ease-out", indicatorClassName)}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}
