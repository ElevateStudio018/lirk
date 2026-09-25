"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { LINKS, VALUES } from "@/lib/content";
import { ArrowRight } from "../ui/Icons";

const FACE_COLORS = ["text-ink", "text-blue", "text-navy"];

/**
 * Pinned. The three values sit on the faces of a 3D prism that turns one
 * face per scroll step, while the particles form the Kleo ring beside it.
 */
export default function Values() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: ".values-pin",
            start: "top top",
            end: "+=220%",
            scrub: 1,
            pin: true,
            snap: {
              snapTo: [0, 0.5, 1],
              directional: false,
              duration: { min: 0.2, max: 0.6 },
              ease: "power2.inOut",
              delay: 0.08,
            },
          },
        });
        tl.to(".prism", { rotateX: 90, ease: "power2.inOut", duration: 1 })
          .to(
            ".values-dot",
            { scale: (i) => (i === 1 ? 1 : 0.6), opacity: (i) => (i === 1 ? 1 : 0.3), duration: 0.3 },
            0.35,
          )
          .to(".prism", { rotateX: 180, ease: "power2.inOut", duration: 1 })
          .to(
            ".values-dot",
            { scale: (i) => (i === 2 ? 1 : 0.6), opacity: (i) => (i === 2 ? 1 : 0.3), duration: 0.3 },
            1.35,
          )
          .to(".values-count", { yPercent: -100, duration: 0.4, ease: "power2.inOut" }, 0.3)
          .to(".values-count", { yPercent: -200, duration: 0.4, ease: "power2.inOut" }, 1.3);

        gsap.from(".values-in", {
          y: 50,
          opacity: 0,
          stagger: 0.08,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: root.current, start: "top 70%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-stage="1" className="relative" aria-labelledby="values-title">
      <div className="values-pin relative flex h-svh min-h-[620px] items-start md:items-center">
        <div className="mx-auto w-full max-w-7xl px-5 pt-28 md:px-8 md:pt-0">
          <div className="max-w-[40rem]">
            <p className="values-in eyebrow flex items-center gap-3 text-blue">
              <span className="inline-flex h-5 overflow-hidden tabular-nums">
                <span className="values-count flex flex-col leading-5">
                  <span>01</span>
                  <span>02</span>
                  <span>03</span>
                </span>
              </span>
              <span className="h-px w-8 bg-blue/40" />
              {VALUES.label}
            </p>

            <h2 id="values-title" className="sr-only">
              {VALUES.words.join(" ")}
            </h2>

            {/* Square prism: faces at 0°, −90°, −180° around X */}
            <div
              className="values-in prism-wrap relative mt-6 h-[var(--ph)] [--ph:clamp(4.2rem,10vw,9rem)] [perspective:1100px]"
              aria-hidden
            >
              <div className="preserve-3d absolute inset-0" style={{ transform: "translateZ(calc(var(--ph) / -2))" }}>
                <div className="prism preserve-3d absolute inset-0">
                  {VALUES.words.map((w, i) => (
                    <div
                      key={w}
                      className={`headline backface-hidden absolute inset-0 flex items-center text-[clamp(3.4rem,9vw,8.4rem)] ${FACE_COLORS[i]}`}
                      style={{ transform: `rotateX(${-90 * i}deg) translateZ(calc(var(--ph) / 2))` }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="values-in mt-8 flex gap-2" aria-hidden>
              {VALUES.words.map((w, i) => (
                <span
                  key={w}
                  className="values-dot h-1.5 w-8 origin-left rounded-full bg-blue"
                  style={{ opacity: i === 0 ? 1 : 0.3, transform: `scale(${i === 0 ? 1 : 0.6})` }}
                />
              ))}
            </div>

            <p className="values-in mt-8 max-w-[34rem] text-[1.1rem] leading-relaxed text-ink-2">{VALUES.body}</p>
            <a href={LINKS.signup} className="values-in btn btn-primary mt-8">
              {VALUES.cta}
              <ArrowRight className="arrow" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
