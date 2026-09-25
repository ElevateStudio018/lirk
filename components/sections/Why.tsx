"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { WHY } from "@/lib/content";
import { useTilt } from "@/lib/useTilt";
import { KleoMark } from "../ui/Brand";
import { Clock, Hand, Shield, Users } from "../ui/Icons";

const ICONS = [Users, Hand, Shield, Clock];

function FlipCard({ index }: { index: number }) {
  const tilt = useRef<HTMLDivElement>(null);
  useTilt(tilt, 6);
  const item = WHY.items[index];
  const Icon = ICONS[index];
  return (
    <li className="why-card [perspective:1400px]">
      <div ref={tilt} className="preserve-3d h-full">
        <div className="why-flip preserve-3d relative h-full min-h-[18rem]">
          {/* Front */}
          <div className="card backface-hidden relative flex h-full flex-col p-7 md:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue/[0.08] text-blue">
              <Icon />
            </span>
            <h3 className="headline mt-auto pt-10 text-[clamp(1.7rem,2.6vw,2.3rem)]">{item.title}</h3>
            <p className="mt-3 max-w-md leading-relaxed text-ink-2">{item.body}</p>
          </div>
          {/* Back */}
          <div
            className="backface-hidden absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[1.5rem] bg-blue p-7 text-white md:p-9"
            style={{ transform: "rotateY(180deg)" }}
            aria-hidden
          >
            <KleoMark size={40} />
            <span className="headline text-[7rem] leading-none text-white/90">0{index + 1}</span>
            <KleoMark size={320} className="absolute -bottom-24 -right-20 text-white/10" />
          </div>
        </div>
      </div>
    </li>
  );
}

/** Four reasons on cards that start face-down and flip over as they arrive. */
export default function Why() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(".why-head > *", {
          y: 60,
          opacity: 0,
          stagger: 0.1,
          duration: 1.2,
          ease: "expo.out",
          scrollTrigger: { trigger: ".why-head", start: "top 80%" },
        });
        gsap.utils.toArray<HTMLElement>(".why-card").forEach((card, i) => {
          gsap.fromTo(
            card.querySelector(".why-flip"),
            { rotateY: i % 2 ? 180 : -180, rotateX: 12, z: -200, y: 80 },
            {
              rotateY: 0,
              rotateX: 0,
              z: 0,
              y: 0,
              ease: "power2.inOut",
              scrollTrigger: { trigger: card, start: "top 95%", end: "top 40%", scrub: 1 },
            },
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-stage="5" className="relative pb-28 pt-40 md:pb-40 md:pt-56" aria-labelledby="why-title">
      <div className="why-head mx-auto max-w-4xl px-5 text-center">
        <h2 id="why-title" className="headline text-[clamp(2.6rem,6.5vw,5.8rem)]">
          {WHY.title}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">{WHY.body}</p>
      </div>
      <ul className="mx-auto mt-16 grid max-w-6xl gap-5 px-4 md:mt-24 md:grid-cols-2 md:px-8">
        {WHY.items.map((item, i) => (
          <FlipCard key={item.title} index={i} />
        ))}
      </ul>
    </section>
  );
}
