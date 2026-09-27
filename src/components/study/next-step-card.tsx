import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { NextStep } from "@/lib/engine/next-step";
import { cn } from "@/lib/utils";

export function NextStepCard({ step, eyebrow = "Nästa steg", className }: { step: NextStep; eyebrow?: string; className?: string }) {
  return (
    <div className={cn("glass-strong relative overflow-hidden rounded-xl p-6 sm:p-8", className)}>
      {/* specular highlight – the "liquid" sheen on the glass */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.12] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
      <h2 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2.25rem]">{step.title}</h2>
      <p className="mt-2 max-w-lg text-muted">{step.description}</p>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Link href={step.href} className={cn(buttonVariants({ variant: "brand", size: "lg" }), "min-w-44")}>
          {step.label} <ArrowRight />
        </Link>
        {step.minutes !== null && (
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-ink">
            <Clock className="size-4" /> {step.minutes} min
          </span>
        )}
      </div>
    </div>
  );
}
