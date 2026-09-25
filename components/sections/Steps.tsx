"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { LINKS, STEPS } from "@/lib/content";
import { ArrowRight } from "../ui/Icons";

/**
 * Pinned, dark. The camera flies down a particle tunnel; each step rushes
 * up out of the depth, holds, and flies past the viewer.
 */
export default function Steps() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const steps = gsap.utils.toArray<HTMLElement>(".step");
        const nums = gsap.utils.toArray<HTMLElement>(".step-num");
        gsap.set(steps, { z: -2600, opacity: 0, rotateX: 22 });
        gsap.set(nums, { z: -3400, opacity: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: {
            trigger: ".steps-pin",
            start: "top top",
            end: "+=380%",
            scrub: 1,
            pin: true,
          },
        });

        // Opacity runs on its own tweens so the outgoing card is gone before
        // the next one is close enough to read.
        steps.forEach((step, i) => {
          const at = i * 2;
          tl.to(step, { z: 0, rotateX: 0, duration: 1 }, at)
            .to(step, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, at + (i === 0 ? 0 : 0.1))
            .to(nums[i], { z: -600, opacity: 1, duration: 1.2 }, at - 0.1)
            .to(`.steps-node-${i}`, { scale: 1, backgroundColor: "#6f9dff", duration: 0.4 }, at + 0.4)
            .to(".steps-line", { scaleX: (i + 1) / STEPS.items.length, duration: 1, ease: "none" }, at);
          if (i < steps.length - 1) {
            tl.to(step, { z: 900, rotateX: -18, duration: 0.9, ease: "power2.in" }, at + 1.5)
              .to(step, { opacity: 0, duration: 0.35, ease: "power1.in" }, at + 1.6)
              .to(nums[i], { z: 600, opacity: 0, duration: 0.9, ease: "power2.in" }, at + 1.45);
          }
        });

        // Last step: the three control levels light up one by one.
        const last = (steps.length - 1) * 2;
        tl.from(".level", { y: 20, opacity: 0, stagger: 0.15, duration: 0.4 }, last + 0.6)
          .to(".level-hl", { xPercent: 100, duration: 0.5, ease: "power2.inOut" }, last + 1.2)
          .to(".level-hl", { xPercent: 200, duration: 0.5, ease: "power2.inOut" }, last + 1.8)
          .from(".steps-cta", { y: 30, opacity: 0, duration: 0.4 }, last + 1.6)
          .to({}, { duration: 0.6 });

        gsap.from(".steps-head", {
          y: 50,
          opacity: 0,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: root.current, start: "top 60%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="sa-funkar-det"
      data-stage="4"
      data-dark
      className="relative text-white"
      aria-labelledby="steps-title"
    >
      <div className="steps-pin relative flex h-svh min-h-[680px] flex-col items-center overflow-hidden pt-24 md:pt-28">
        <h2 id="steps-title" className="steps-head headline max-w-3xl px-5 text-center text-[clamp(2.4rem,6vw,5.2rem)]">
          {STEPS.title}
        </h2>

        <div className="steps-stage relative w-full flex-1 [perspective:1000px]">
          {STEPS.items.map((s, i) => (
            <div key={s.n} className="absolute inset-0 grid place-items-center">
              <span
                className={`step-num headline pointer-events-none absolute select-none text-[clamp(10rem,32vw,26rem)] text-white/[0.07] steps-num-${i}`}
                aria-hidden
              >
                {s.n}
              </span>
              <article className="step glass-dark relative mx-5 w-full max-w-xl rounded-[2rem] p-7 md:p-10">
                <p className="eyebrow text-sky">Steg {s.n}</p>
                <h3 className="headline mt-4 text-[clamp(2rem,4vw,3.2rem)]">{s.title}</h3>
                <p className="mt-4 text-[1.05rem] leading-relaxed text-white/70">{s.body}</p>
                {i === STEPS.items.length - 1 && (
                  <div className="relative mt-7 grid grid-cols-3 rounded-full bg-white/[0.06] p-1 text-center text-[0.8rem] font-medium md:text-[0.9rem]">
                    <span className="level-hl absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-blue shadow-[0_8px_24px_-8px_rgba(10,62,255,0.8)]" />
                    {STEPS.levels.map((l) => (
                      <span key={l} className="level relative px-2 py-2.5">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            </div>
          ))}
        </div>

        <div className="relative mb-10 flex w-full max-w-md flex-col items-center gap-6 px-8">
          <div className="relative flex w-full items-center justify-between" aria-hidden>
            <span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
            <span className="steps-line absolute inset-x-0 top-1/2 h-px origin-left scale-x-0 bg-sky" />
            {STEPS.items.map((s, i) => (
              <span key={s.n} className={`steps-node-${i} relative h-2.5 w-2.5 scale-75 rounded-full bg-white/30`} />
            ))}
          </div>
          <a href={LINKS.signup} className="steps-cta btn btn-light">
            {STEPS.cta}
            <ArrowRight className="arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
