import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,transform,box-shadow,color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
        brand: "bg-brand text-on-brand hover:bg-brand-strong shadow-sm",
        secondary: "bg-surface text-ink border border-border hover:bg-surface-muted shadow-sm",
        ghost: "text-ink hover:bg-surface-muted",
        subtle: "bg-surface-muted text-ink hover:bg-surface-sunken",
        danger: "bg-bad text-white hover:opacity-90",
        link: "text-info underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 rounded-sm px-3.5 text-sm",
        md: "h-11 rounded-md px-5 text-[15px]",
        lg: "h-14 rounded-lg px-7 text-base",
        icon: "size-10 rounded-md",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
