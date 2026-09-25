"use client";

import { useRef } from "react";
import { gsap, MOTION_DESKTOP, MOTION_MOBILE, useGSAP } from "@/lib/gsap";
import { LINKS, PRICING } from "@/lib/content";
import { useTilt } from "@/lib/useTilt";
import { ArrowRight, Check } from "../ui/Icons";

function Plan({ index }: { index: number }) {
  const tilt = useRef<HTMLDivElement>(null);
  useTilt(tilt, 6);
  const plan = PRICING.plans[index];
  const featured = index === 1;
  return (
    <li className="plan [perspective:1400px]" style={{ zIndex: featured ? 3 : 2 - index / 2 }}>
      <div className="plan-move preserve-3d h-full">
        <div
          ref={tilt}
          className={`preserve-3d flex h-full flex-col rounded-[1.75rem] p-7 md:p-8 ${
            featured ? "bg-navy text-white shadow-[0_40px_80px_-30px_rgba(16,41,110,0.7)]" : "card"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl font-medium tracking-[-0.03em]">{plan.name}</h3>
            <span className={`eyebrow text-[0.65rem] ${featured ? "text-sky" : "text-blue"}`}>0{index + 1}</span>
          </div>
          <p className="headline mt-6 text-[2.6rem]" style={{ transform: "translateZ(30px)" }}>
            {plan.price}
          </p>
          <p className={`mt-4 leading-relaxed ${featured ? "text-white/70" : "text-ink-2"}`}>{plan.body}</p>
          <p className={`eyebrow mt-7 text-[0.68rem] ${featured ? "text-white/50" : "text-ink-3"}`}>
            {PRICING.includes}
          </p>
          <ul className="mt-3 flex-1 space-y-2.5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    featured ? "bg-sky/20 text-sky" : "bg-blue/10 text-blue"
                  }`}
                >
                  <Check size={12} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <a
            href={LINKS.signup}
            className={`btn mt-8 w-full ${featured ? "btn-primary" : "btn-ghost"}`}
            style={{ transform: "translateZ(20px)" }}
          >
            {PRICING.cta}
            <ArrowRight className="arrow" />
          </a>
        </div>
      </div>
    </li>
  );
}

/** The plans start as a stacked deck and fan out into place as you scroll. */
export default function Pricing() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MOTION_DESKTOP, () => {
        const plans = gsap.utils.toArray<HTMLElement>(".plan");
        const grid = root.current?.querySelector<HTMLElement>(".plan-grid");
        if (!grid) return;
        const offset = (el: HTMLElement) => {
          const g = grid.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return g.left + g.width / 2 - (r.left + r.width / 2);
        };
        gsap
          .timeline({
            scrollTrigger: {
              trigger: grid,
              start: "top 98%",
              end: "top 22%",
              scrub: 1,
              invalidateOnRefresh: true,
            },
          })
          .fromTo(
            plans.map((p) => p.querySelector(".plan-move")),
            {
              x: (i: number) => offset(plans[i]),
              y: (i: number) => (i === 1 ? -10 : 18),
              rotateZ: (i: number) => [-7, 0, 7][i],
              rotateY: (i: number) => [30, 0, -30][i],
              z: (i: number) => (i === 1 ? 0 : -140),
              scale: 0.92,
            },
            { x: 0, y: 0, rotateZ: 0, rotateY: 0, z: 0, scale: 1, ease: "power3.inOut", stagger: 0.04 },
          );
        gsap.from(".pricing-head > *", {
          y: 50,
          opacity: 0,
          stagger: 0.1,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: ".pricing-head", start: "top 85%" },
        });
      });

      mm.add(MOTION_MOBILE, () => {
        gsap.utils.toArray<HTMLElement>(".plan-move").forEach((el) => {
          gsap.from(el, {
            rotateX: -50,
            y: 80,
            opacity: 0,
            transformOrigin: "50% 0%",
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 95%", end: "top 55%", scrub: 1 },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="priser" className="relative" aria-labelledby="pricing-title">
      <div className="relative py-24 md:py-36">
        <div className="pricing-head mx-auto max-w-3xl px-5 text-center">
          <h2 id="pricing-title" className="headline text-[clamp(2.6rem,6.5vw,5.8rem)]">
            {PRICING.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{PRICING.body}</p>
        </div>
        <ul className="plan-grid mx-auto mt-12 grid w-full max-w-6xl gap-5 px-4 md:mt-14 md:grid-cols-3 md:px-8">
          {PRICING.plans.map((p, i) => (
            <Plan key={p.name} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
