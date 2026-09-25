"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { STATS } from "@/lib/content";
import { KleoMark } from "../ui/Brand";

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

/** One digit on a ten-sided 3D drum that spins to its value. */
function Drum({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] [perspective:600px]" aria-hidden>
      <span className="preserve-3d absolute inset-0" style={{ transform: "translateZ(-1.54em)" }}>
        <span
          className="drum preserve-3d absolute inset-0"
          data-digit={digit}
          style={{ transform: `rotateX(${digit * 36}deg)` }}
        >
          {DIGITS.map((d) => (
            <span
              key={d}
              className="backface-hidden absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotateX(${-d * 36}deg) translateZ(1.54em)` }}
            >
              {d}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

export default function Stats() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.fromTo(
          ".stats-panel",
          { rotateX: 32, y: 120, scale: 0.9, transformOrigin: "50% 100%" },
          {
            rotateX: 0,
            y: 0,
            scale: 1,
            ease: "power2.out",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "top 25%", scrub: 1 },
          },
        );
        const drums = gsap.utils.toArray<HTMLElement>(".drum");
        gsap.fromTo(
          drums,
          { rotateX: (i, el: HTMLElement) => Number(el.dataset.digit) * 36 - 720 - i * 36 },
          {
            rotateX: (_i, el: HTMLElement) => Number(el.dataset.digit) * 36,
            duration: 2.4,
            stagger: 0.15,
            ease: "expo.out",
            scrollTrigger: { trigger: ".stats-grid", start: "top 80%" },
          },
        );
        gsap.from(".stats-item", {
          y: 40,
          opacity: 0,
          stagger: 0.12,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: ".stats-grid", start: "top 85%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative px-3 py-10 md:px-6 md:py-16" aria-labelledby="stats-title">
      <div className="mx-auto max-w-7xl [perspective:1600px]">
        <div className="stats-panel relative overflow-hidden rounded-[2.5rem] bg-blue px-6 py-16 text-white shadow-[0_60px_120px_-40px_rgba(10,62,255,0.6)] md:px-14 md:py-24">
          <KleoMark size={620} className="pointer-events-none absolute -right-40 -top-40 text-white/[0.07]" />
          <div className="relative max-w-2xl">
            <h2 id="stats-title" className="headline text-[clamp(2.6rem,6vw,5.4rem)]">
              {STATS.title}
            </h2>
            <p className="mt-5 text-lg text-white/75">{STATS.body}</p>
          </div>

          <ul className="stats-grid relative mt-14 grid gap-10 md:mt-20 md:grid-cols-3 md:gap-8">
            {STATS.items.map((s) => (
              <li key={s.label} className="stats-item border-t border-white/20 pt-6">
                <p className="headline flex items-baseline text-[clamp(4rem,8vw,7rem)] leading-none">
                  <span className="sr-only">
                    {s.value}
                    {s.suffix}
                  </span>
                  <span
                    className="inline-flex [mask-image:linear-gradient(transparent,#000_22%,#000_78%,transparent)]"
                    aria-hidden
                  >
                    {String(s.value)
                      .split("")
                      .map((d, i) => (
                        <Drum key={i} digit={Number(d)} />
                      ))}
                  </span>
                  <span className="ml-2 text-[0.38em] tracking-[-0.03em] text-white/80" aria-hidden>
                    {s.suffix.trim()}
                  </span>
                </p>
                <p className="mt-5 text-lg font-medium">{s.label}</p>
                <p className="mt-2 leading-relaxed text-white/65">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
