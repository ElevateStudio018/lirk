import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-ink", className)} aria-label="Lirk – till startsidan">
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
        <rect width="64" height="64" rx="18" fill="#fff" />
        <path d="M22 16v26h20" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight">Lirk</span>
    </Link>
  );
}
