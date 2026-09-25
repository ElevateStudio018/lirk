"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { LINKS, NAV, HERO } from "@/lib/content";
import { KleoLockup } from "./ui/Brand";
import { ArrowRight, Close, Menu } from "./ui/Icons";

export default function Nav() {
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useGSAP(
    () => {
      gsap.from(".nav-pill", { y: -30, opacity: 0, duration: 1.1, ease: "expo.out", delay: 0.2 });

      // Hide on scroll down, reveal on scroll up.
      let last = 0;
      let hidden = false;
      const onScroll = () => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        const down = y > last && y > 240;
        if (down !== hidden) {
          hidden = down;
          gsap.to(".nav-pill", { yPercent: down ? -140 : 0, duration: 0.6, ease: "expo.out", overwrite: true });
        }
        last = y;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    },
    { scope: root },
  );

  return (
    <header ref={root} className="nav fixed inset-x-0 top-0 z-50">
      <div className="nav-progress absolute inset-x-0 top-0 h-[2px] overflow-hidden">
        <div ref={bar} className="h-full origin-left bg-blue" style={{ transform: "scaleX(0)" }} />
      </div>
      <div className="mx-auto max-w-7xl px-4 pt-3 md:px-6 md:pt-4">
        <nav className="nav-pill flex h-14 items-center justify-between rounded-full pl-5 pr-2" aria-label="Huvudmeny">
          <a href="#top" className="nav-logo" aria-label="Kleo – till toppen">
            <KleoLockup size={24} />
          </a>
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="nav-link rounded-full px-4 py-2 text-[0.9rem] font-medium">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            <a
              href={LINKS.login}
              className="nav-link hidden rounded-full px-4 py-2 text-[0.9rem] font-medium sm:inline-flex"
            >
              Logga in
            </a>
            <a href={LINKS.signup} className="btn btn-primary !h-10 !px-4 text-[0.9rem]">
              {HERO.primary}
              <ArrowRight className="arrow" />
            </a>
            <button
              type="button"
              className="nav-link grid h-10 w-10 place-items-center rounded-full lg:hidden"
              aria-label={open ? "Stäng meny" : "Öppna meny"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <Close /> : <Menu />}
            </button>
          </div>
        </nav>
        {open && (
          <div className="card mt-2 overflow-hidden p-2 lg:hidden">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-lg font-medium text-ink hover:bg-mist"
              >
                {item.label}
              </a>
            ))}
            <a href={LINKS.login} className="block rounded-2xl px-4 py-3 text-lg font-medium text-ink hover:bg-mist">
              Logga in
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
