"use client";

import { useRef } from "react";
import { gsap, MOTION, SplitText, useGSAP } from "@/lib/gsap";
import { HERO, LINKS } from "@/lib/content";
import { ArrowRight } from "../ui/Icons";

const PROOF = ["3 dagar gratis utan kort", "Ingen bindningstid", "Kontot lagras i EU"];

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const split = SplitText.create(".hero-title", {
        type: "words,chars",
        wordsClass: "hero-word",
        charsClass: "hero-char",
      });
      const mm = gsap.matchMedia();

      mm.add(MOTION, () => {
        // Intro: letters flip up out of the floor.
        gsap
          .timeline({ delay: 0.15 })
          .from(split.chars, {
            yPercent: 115,
            rotateX: -100,
            opacity: 0,
            transformOrigin: "50% 100%",
            stagger: 0.022,
            duration: 1.3,
            ease: "expo.out",
          })
          .from(
            ".hero-fade",
            { y: 28, opacity: 0, filter: "blur(10px)", stagger: 0.09, duration: 1.1, ease: "expo.out" },
            "-=1.05",
          );

        // Scroll: the headline blows apart towards the viewer.
        const rand = gsap.utils.random;
        gsap
          .timeline({
            scrollTrigger: {
              trigger: ".hero-pin",
              start: "top top",
              end: "+=110%",
              scrub: 1,
              pin: true,
            },
          })
          .to(
            split.chars,
            {
              x: () => rand(-420, 420),
              y: () => rand(-260, 200),
              z: () => rand(250, 1100),
              rotationY: () => rand(-200, 200),
              rotationZ: () => rand(-90, 90),
              stagger: { each: 0.006, from: "center" },
              ease: "power2.in",
              duration: 1,
            },
            0,
          )
          .to(".hero-title", { opacity: 0, duration: 0.35, ease: "none" }, 0.65)
          .to(
            ".hero-after",
            { y: -80, opacity: 0, filter: "blur(12px)", stagger: 0.05, duration: 0.5, ease: "power2.in" },
            0,
          )
          .to(".hero-hint", { opacity: 0, duration: 0.2 }, 0)
          .to(".hero-veil", { opacity: 0, duration: 0.6, ease: "none" }, 0.2);
      });

      return () => split.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" data-stage="0" className="relative">
      <div className="hero-pin relative isolate flex h-svh min-h-[640px] flex-col items-center justify-center px-4 pb-[18vh] pt-24 text-center">
        <div
          aria-hidden
          className="hero-veil pointer-events-none absolute left-1/2 top-[44%] -z-10 h-[62%] w-[min(1200px,110vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(248,248,248,0.94),rgba(248,248,248,0.75)_50%,rgba(248,248,248,0))]"
        />
        <p className="hero-fade hero-after mb-7 inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-[0.82rem] font-medium text-ink-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="pulse-dot absolute inset-0 rounded-full bg-blue" />
            <span className="relative h-2 w-2 rounded-full bg-blue" />
          </span>
          {HERO.eyebrow}
        </p>

        <h1 className="hero-title headline max-w-[15ch] text-[clamp(2.9rem,8.2vw,7.6rem)] text-ink [perspective:900px]">
          {HERO.title}
        </h1>

        <p className="hero-fade hero-after mt-7 max-w-[40rem] text-[clamp(1rem,1.35vw,1.2rem)] leading-relaxed text-ink-2">
          {HERO.lead}
        </p>

        <div className="hero-fade hero-after mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href={LINKS.signup} className="btn btn-primary">
            {HERO.primary}
            <ArrowRight className="arrow" />
          </a>
          <a href={LINKS.signup} className="btn btn-ghost">
            {HERO.secondary}
          </a>
        </div>

        <ul className="hero-fade hero-after mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.8rem] text-ink-3">
          {PROOF.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-blue" />
              {p}
            </li>
          ))}
        </ul>

        <div className="hero-hint hero-fade absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ink-3">
          Scrolla
          <span className="relative h-10 w-[1.5px] overflow-hidden rounded bg-ink/10">
            <span className="absolute inset-x-0 top-0 h-4 animate-[hint_1.8s_ease-in-out_infinite] rounded bg-blue" />
          </span>
        </div>
      </div>
    </section>
  );
}
