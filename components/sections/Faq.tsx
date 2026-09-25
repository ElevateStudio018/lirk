"use client";

import { useRef, useState } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { FAQ } from "@/lib/content";
import { Plus } from "../ui/Icons";

/** Questions unfold towards the viewer like pages as they scroll in. */
export default function Faq() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(".faq-head > *", {
          y: 50,
          opacity: 0,
          stagger: 0.1,
          duration: 1.1,
          ease: "expo.out",
          scrollTrigger: { trigger: ".faq-head", start: "top 85%" },
        });
        gsap.utils.toArray<HTMLElement>(".faq-item").forEach((el) => {
          gsap.from(el, {
            rotateX: -75,
            y: 40,
            opacity: 0,
            transformOrigin: "50% 0%",
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 98%", end: "top 70%", scrub: 1 },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="vanliga-fragor" className="relative py-28 md:py-40" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:px-8">
        <div className="faq-head md:sticky md:top-32 md:self-start">
          <h2 id="faq-title" className="headline text-[clamp(2.6rem,6vw,5rem)]">
            {FAQ.title}
          </h2>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-ink-2">
            {FAQ.body.split("Hör av dig.")[0]}
            <a href="#kontakt" className="font-medium text-blue underline-offset-4 hover:underline">
              Hör av dig.
            </a>
          </p>
        </div>
        <ul className="flex flex-col gap-3 [perspective:1200px]">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="faq-item card overflow-hidden !rounded-2xl">
                <h3>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-[1.05rem] font-medium md:text-lg"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-500 ${
                        isOpen ? "rotate-45 bg-blue text-white" : "bg-mist text-ink"
                      }`}
                    >
                      <Plus />
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-${i}`}
                  role="region"
                  className="grid transition-[grid-template-rows] duration-500 ease-out-expo"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 leading-relaxed text-ink-2">{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
