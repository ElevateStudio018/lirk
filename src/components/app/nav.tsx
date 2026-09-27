"use client";

import { BookOpenCheck, Home, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const ITEMS = [
  { href: "/dashboard", label: "Idag", icon: Home, match: (p: string) => p === "/dashboard" || p.startsWith("/study") },
  { href: "/exams", label: "Mina prov", icon: BookOpenCheck, match: (p: string) => (p.startsWith("/exams") && p !== "/exams/new") || p.startsWith("/exam/") || p.startsWith("/results") },
  { href: "/exams/new", label: "Nytt prov", icon: Plus, match: (p: string) => p === "/exams/new" },
  { href: "/profile", label: "Profil", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-60 flex-col rounded-xl px-3 py-6 lg:flex">
      <Logo className="px-3" />
      <nav className="mt-10 flex flex-col gap-1" aria-label="Huvudmeny">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors",
                active ? "bg-white text-black" : "text-muted hover:bg-white/8 hover:text-ink",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  // Focus mode: no navigation while taking a mock exam or studying.
  if (pathname.startsWith("/exam/") || pathname.startsWith("/study/")) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden"
      aria-label="Huvudmeny"
    >
      <div className="glass-panel mx-auto flex h-16 max-w-md items-stretch justify-around rounded-full px-2">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const isNew = item.href === "/exams/new";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("my-1.5 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors", active && !isNew ? "bg-white/12 text-ink" : "text-muted")}
            >
              {isNew ? (
                <span className="grid size-9 place-items-center rounded-full bg-primary text-on-primary">
                  <item.icon className="size-5" aria-hidden />
                </span>
              ) : (
                <item.icon className="size-[22px]" aria-hidden />
              )}
              <span className={cn(isNew && "sr-only")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileTopBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/exam/") || pathname.startsWith("/study/")) return null;
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center bg-black/40 px-5 pt-safe backdrop-blur-xl lg:hidden">
      <Logo />
    </header>
  );
}
