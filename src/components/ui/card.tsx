import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "muted" | "brand" | "ink";
  padded?: boolean;
  interactive?: boolean;
};

export function Card({ className, tone = "default", padded = true, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card",
        tone === "default" && "bg-surface border border-border shadow-sm",
        tone === "muted" && "bg-surface-muted",
        tone === "brand" && "bg-brand-soft",
        tone === "ink" && "bg-primary text-on-primary",
        padded && "p-5 sm:p-6",
        interactive && "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
