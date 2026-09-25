"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { SPECIALISTS, SPECIALISTS_INTRO } from "@/lib/content";

const STEP = 360 / SPECIALISTS.length;

/**
 * Pinned, dark. The twelve specialists stand on a 3D carousel that turns a
 * full lap as you scroll; the particle field splits into twelve orbs behind.
 */
export default function Specialists() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const ring = root.current?.querySelector<HTMLElement>(".spec-ring");
      const cards = gsap.utils.toArray<HTMLElement>(".spec-card");
      if (!ring) return;

      // Fade cards by how much they face the viewer. Opacity goes on the faces:
      // on the card itself it would flatten the 3D context and show mirrored text.
      const faces = cards.map((c) => Array.from(c.querySelectorAll<HTMLElement>(".spec-face")));
      const shade = () => {
        const angle = Number(gsap.getProperty(ring, "rotationY")) || 0;
        cards.forEach((c, i) => {
          const facing = Math.cos(((i * STEP + angle) * Math.PI) / 180);
          const opacity = String(0.12 + 0.88 * Math.max(0, facing) ** 2);
          faces[i].forEach((f) => (f.style.opacity = opacity));
          c.style.pointerEvents = facing > 0.8 ? "auto" : "none";
        });
      };
      shade();

      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(".spec-head > *", {
          y: 50,
          opacity: 0,
          stagger: 0.1,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: root.current, start: "top 60%" },
        });

        gsap
          .timeline({
            scrollTrigger: {
              trigger: ".spec-pin",
              start: "top top",
              end: "+=320%",
              scrub: 1.2,
              pin: true,
            },
            onUpdate: shade,
          })
          .fromTo(
            ring,
            { rotationY: 40, rotationX: -14 },
            { rotationY: -(360 - STEP) - 20, rotationX: 6, ease: "none" },
            0,
          )
          .fromTo(
            ".spec-counter",
            { yPercent: 0 },
            { yPercent: -((SPECIALISTS.length - 1) / SPECIALISTS.length) * 100, ease: "none" },
            0,
          );
      });

      // Reduced motion: turn one step per second instead.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(ring, { rotationY: 0, rotationX: -8 });
        shade();
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="specialister"
      data-stage="3"
      data-dark
      className="relative text-white"
      aria-labelledby="spec-title"
    >
      <div className="spec-pin relative h-svh min-h-[720px] overflow-hidden">
        <header className="spec-head relative z-10 mx-auto max-w-5xl px-5 pt-24 text-center md:pt-28">
          <p className="eyebrow flex items-center justify-center gap-3 text-sky">
            <span className="inline-flex h-4 overflow-hidden tabular-nums">
              <span className="spec-counter flex flex-col leading-4">
                {SPECIALISTS.map((_, i) => (
                  <span key={i}>{String(i + 1).padStart(2, "0")}</span>
                ))}
              </span>
            </span>
            <span className="h-px w-6 bg-sky/50" />
            {SPECIALISTS_INTRO.eyebrow}
          </p>
          <h2 id="spec-title" className="headline mt-5 text-[clamp(2.4rem,5.2vw,4.6rem)]">
            {SPECIALISTS_INTRO.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/70">
            {SPECIALISTS_INTRO.body}
          </p>
        </header>

        <div className="spec-stage absolute inset-0 [perspective:1500px] [--r:340px] md:[--r:520px]">
          <div
            className="preserve-3d absolute left-1/2 top-[70%] h-0 w-0 md:top-[68%]"
            style={{ transform: "translateZ(calc(var(--r) * -1))" }}
          >
            <div className="spec-ring preserve-3d absolute left-0 top-0 h-0 w-0">
              {SPECIALISTS.map((s, i) => (
                <article
                  key={s.name}
                  className="spec-card preserve-3d absolute left-0 top-0 h-[15.5rem] w-[12rem] -translate-x-1/2 -translate-y-1/2 md:h-[17.5rem] md:w-[14rem]"
                  style={{ transform: `rotateY(${i * STEP}deg) translateZ(var(--r))` }}
                >
                  <div className="spec-face backface-hidden absolute inset-0 flex flex-col rounded-3xl p-5">
                    <div className="flex items-center justify-between">
                      <span
                        className="grid h-11 w-11 place-items-center rounded-2xl text-[0.8rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                        style={{ background: s.accent }}
                      >
                        {s.initials}
                      </span>
                      <span className="text-[0.7rem] tabular-nums text-white/40">
                        {String(i + 1).padStart(2, "0")}/{SPECIALISTS.length}
                      </span>
                    </div>
                    <h3 className="font-display mt-auto text-[1.3rem] font-medium tracking-[-0.03em]">{s.name}</h3>
                    <p
                      className="mt-1 text-[0.8rem] font-medium"
                      style={{ color: `color-mix(in srgb, ${s.accent} 50%, white)` }}
                    >
                      {s.role}
                    </p>
                    <p className="mt-3 text-[0.85rem] leading-snug text-white/65">{s.tagline}</p>
                    <p className="mt-4 flex items-center gap-1.5 text-[0.72rem] text-white/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                      Online
                    </p>
                  </div>
                  <div
                    className="spec-face spec-back backface-hidden absolute inset-0 rounded-3xl"
                    style={{ transform: "rotateY(180deg)" }}
                    aria-hidden
                  />
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
