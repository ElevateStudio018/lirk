import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { NextStep } from "@/lib/engine/next-step";
import { cn } from "@/lib/utils";

export function NextStepCard({ step, eyebrow = "Nästa steg", className }: { step: NextStep; eyebrow?: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-primary p-6 text-on-primary shadow-lg sm:p-8", className)}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/25 blur-2xl" aria-hidden />
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2.25rem]">{step.title}</h2>
      <p className="mt-2 max-w-lg opacity-70">{step.description}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={step.href} className={cn(buttonVariants({ variant: "brand", size: "lg" }), "min-w-40")}>
          {step.label} <ArrowRight />
        </Link>
        {step.minutes !== null && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold opacity-80">
            <Clock className="size-4" /> {step.minutes} min
          </span>
        )}
      </div>
    </div>
  );
}
