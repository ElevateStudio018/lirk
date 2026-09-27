import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-muted",
        brand: "bg-brand-soft text-brand-strong",
        good: "bg-good-soft text-good",
        warn: "bg-warn-soft text-warn",
        bad: "bg-bad-soft text-bad",
        unknown: "bg-unknown-soft text-unknown",
        info: "bg-info-soft text-info",
        outline: "border border-border text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
