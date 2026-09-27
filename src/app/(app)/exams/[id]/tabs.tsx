"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ExamTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/exams/${id}`;
  const tabs = [
    { href: base, label: "Översikt" },
    { href: `${base}/materials`, label: "Underlag" },
    { href: `${base}/map`, label: "Vad du ska kunna" },
    { href: `${base}/plan`, label: "Plan" },
    { href: `${base}/report`, label: "Resultat" },
  ];
  return (
    <nav className="no-scrollbar -mx-5 mb-8 flex gap-1 overflow-x-auto border-b border-border px-5 sm:mx-0 sm:px-0" aria-label="Provets sidor">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition-colors",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
