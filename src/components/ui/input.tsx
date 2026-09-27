import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-lg border border-border bg-white/[0.06] px-4 text-base text-ink placeholder:text-subtle [color-scheme:dark]",
        "focus:border-white/40 focus:bg-white/[0.09] focus:outline-none focus:ring-4 focus:ring-white/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-32 w-full rounded-lg border border-border bg-white/[0.06] px-4 py-3 text-base text-ink placeholder:text-subtle",
        "focus:border-white/40 focus:bg-white/[0.09] focus:outline-none focus:ring-4 focus:ring-white/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-sm font-semibold text-ink", className)} {...props} />;
}
