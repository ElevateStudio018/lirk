"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { TESTIMONIALS } from "@/lib/content";

type Item = (typeof TESTIMONIALS.items)[number];

function Quote({ item }: { item: Item }) {
  return (
    <figure className="card mx-2.5 flex w-[21rem] shrink-0 flex-col p-6 md:w-[26rem] md:p-7">
      <span className="eyebrow w-fit rounded-full bg-blue/[0.08] px-2.5 py-1 text-[0.65rem] text-blue">
        {TESTIMONIALS.label}
      </span>
      <blockquote className="mt-5 flex-1 text-[1.05rem] leading-relaxed text-ink md:text-[1.15rem]">
        {item.quote}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-[0.7rem] font-semibold text-white">
          {item.name
            .split(/[\s&]+/)
            .filter(Boolean)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </span>
        <span className="leading-tight">
          <span className="block font-medium">{item.name}</span>
          <span className="block text-sm text-ink-3">{item.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function Row({ reverse }: { reverse?: boolean }) {
  const items = reverse ? [...TESTIMONIALS.items].reverse() : TESTIMONIALS.items;
  const loop = [...items, ...items];
  return (
    <div className="flex w-max py-3">
      <div className={`flex ${reverse ? "marquee-right" : "marquee-left"}`}>
        {loop.map((t, i) => (
          <Quote key={i} item={t} />
        ))}
        {loop.map((t, i) => (
          <Quote key={`b${i}`} item={t} />
        ))}
      </div>
    </div>
  );
}

/** Quotes stream past on a plane tilted back in 3D; scrolling shears the rows apart. */
export default function Testimonials() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(".testi-head > *", {
          y: 50,
          opacity: 0,
          stagger: 0.1,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: ".testi-head", start: "top 80%" },
        });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: ".testi-plane-wrap", start: "top bottom", end: "bottom top", scrub: 1 },
        });
        tl.fromTo(
          ".testi-plane",
          { rotateX: 48, rotateZ: -12, y: 80 },
          { rotateX: 14, rotateZ: -4, y: -40, ease: "none" },
          0,
        )
          .fromTo(".testi-row-a", { xPercent: 6 }, { xPercent: -10, ease: "none" }, 0)
          .fromTo(".testi-row-b", { xPercent: -12 }, { xPercent: 4, ease: "none" }, 0);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden py-28 md:py-40" aria-labelledby="testi-title">
      <div className="testi-head mx-auto max-w-4xl px-5 text-center">
        <h2 id="testi-title" className="headline text-[clamp(2.6rem,6.5vw,5.8rem)]">
          {TESTIMONIALS.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{TESTIMONIALS.body}</p>
      </div>

      <ul className="sr-only">
        {TESTIMONIALS.items.map((t) => (
          <li key={t.name}>
            {t.quote} — {t.name}, {t.role}
          </li>
        ))}
      </ul>

      <div className="testi-plane-wrap relative mt-12 [perspective:1300px] md:mt-20" aria-hidden>
        <div
          className="testi-plane preserve-3d flex flex-col gap-2"
          style={{ transform: "rotateX(24deg) rotateZ(-6deg)", transformOrigin: "50% 50%" }}
        >
          <div className="testi-row-a">
            <Row />
          </div>
          <div className="testi-row-b">
            <Row reverse />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[12vw] bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[12vw] bg-gradient-to-l from-bg to-transparent" />
      </div>
    </section>
  );
}
