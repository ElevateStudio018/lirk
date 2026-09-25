"use client";

import { useRef } from "react";
import { gsap, MOTION, SplitText, useGSAP } from "@/lib/gsap";
import { FINAL_CTA, FOOTER, LINKS, NAV } from "@/lib/content";
import { KleoMark } from "../ui/Brand";
import { ArrowRight } from "../ui/Icons";

/** Dark finale: the particles gather into the Kleo ring above the last call to action. */
export default function Finale() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const split = SplitText.create(".finale-title", { type: "words,chars", wordsClass: "finale-word" });
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(split.chars, {
          rotateY: -110,
          x: 40,
          z: -160,
          opacity: 0,
          transformOrigin: "0% 50%",
          stagger: 0.03,
          ease: "power3.out",
          scrollTrigger: { trigger: ".finale", start: "top 70%", end: "top 5%", scrub: 1 },
        });
        gsap.from(".finale-fade", {
          y: 40,
          opacity: 0,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: ".finale", start: "top 40%", end: "top 0%", scrub: 1 },
        });
        gsap.fromTo(
          ".footer-word",
          { rotateX: 75, yPercent: 40, opacity: 0.2 },
          {
            rotateX: 0,
            yPercent: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: { trigger: ".footer-word-wrap", start: "top bottom", end: "bottom bottom", scrub: 1 },
          },
        );
      });
      return () => split.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} data-dark className="relative text-white">
      <section
        data-stage="6"
        className="finale relative flex min-h-[115svh] flex-col items-center justify-end px-5 pb-[12svh] text-center"
        aria-labelledby="finale-title"
      >
        <p className="finale-fade eyebrow text-sky">{FINAL_CTA.sub}</p>
        <h2
          id="finale-title"
          className="finale-title headline mt-5 max-w-[14ch] text-[clamp(3rem,8vw,7.4rem)] [perspective:900px]"
        >
          {FINAL_CTA.title}
        </h2>
        <div className="finale-fade mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href={LINKS.signup} className="btn btn-primary">
            {FINAL_CTA.primary}
            <ArrowRight className="arrow" />
          </a>
          <a href="#kontakt" className="btn btn-outline-light">
            {FINAL_CTA.secondary}
          </a>
        </div>
      </section>

      <footer className="relative overflow-hidden rounded-t-[2.5rem] bg-deep pt-16 shadow-[0_-40px_80px_-40px_rgba(0,0,0,0.5)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
          <div>
            <a href="#top" className="inline-flex items-center gap-2" aria-label="Kleo – till toppen">
              <KleoMark size={28} />
              <span className="font-display text-2xl font-semibold tracking-[-0.045em]">Kleo</span>
            </a>
            <p className="mt-4 max-w-xs text-white/60">{FOOTER.tagline}</p>
          </div>
          <nav aria-label="Meny">
            <p className="eyebrow text-white/40">Meny</p>
            <ul className="mt-4 space-y-2.5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="text-white/75 transition-colors hover:text-white">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="eyebrow text-white/40">Kontakt</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href={`mailto:${LINKS.email}`} className="text-white/75 transition-colors hover:text-white">
                  {LINKS.email}
                </a>
              </li>
              <li>
                <a href="#kontakt" className="text-white/75 transition-colors hover:text-white">
                  Kontakta oss
                </a>
              </li>
              <li>
                <a href={LINKS.login} className="text-white/75 transition-colors hover:text-white">
                  Logga in
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow text-white/40">Juridik</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href={LINKS.privacy} className="text-white/75 transition-colors hover:text-white">
                  Integritetspolicy
                </a>
              </li>
              <li>
                <a href={LINKS.terms} className="text-white/75 transition-colors hover:text-white">
                  Villkor
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-word-wrap relative mt-16 [perspective:900px]" aria-hidden>
          <p
            className="footer-word headline select-none text-center text-[30vw] leading-[0.8] tracking-[-0.07em] text-transparent"
            style={{
              transformOrigin: "50% 100%",
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(111,157,255,0.35) 70%, rgba(111,157,255,0) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            Kleo
          </p>
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 px-5 py-6 text-sm text-white/45 md:flex-row md:justify-between md:px-8">
          <p>{FOOTER.copyright}</p>
          <a href="#top" className="hover:text-white">
            Till toppen ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
