"use client";

import { useRef } from "react";
import { gsap, MOTION, MOTION_DESKTOP, useGSAP } from "@/lib/gsap";
import { FEATURES, PRODUCT } from "@/lib/content";
import { useTilt } from "@/lib/useTilt";
import AppMock from "../ui/AppMock";
import { Check, Doc, Mail, Star } from "../ui/Icons";

const FLOATERS = [
  {
    who: "Ekonomin",
    initials: "EK",
    accent: "#2D8A4E",
    text: "Påminnelse klar: faktura 1043 är fem dagar sen.",
    pos: "left-[-4%] top-[14%]",
    z: 140,
  },
  {
    who: "Marknadsföraren",
    initials: "MA",
    accent: "#7A9B2D",
    text: "Tre svar på Google-recensioner väntar på dig.",
    pos: "right-[-5%] top-[38%]",
    z: 220,
  },
  {
    who: "HR-stödet",
    initials: "HR",
    accent: "#B06DA8",
    text: "Introduktionsplanen för Elin är klar.",
    pos: "left-[6%] bottom-[-6%]",
    z: 180,
  },
];

function FeatureVisual({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="rounded-2xl bg-mist p-4 text-[13px]">
        <div className="flex items-center gap-2 text-ink-3">
          <Mail size={14} /> Till: familjen Berg
        </div>
        <p className="mt-2 font-medium text-ink">Offert: badrumsrenovering</p>
        <p className="mt-1 leading-relaxed text-ink-2">
          Hej! Tack för att vi fick komma förbi i tisdags. Här kommer offerten, med ROT-avdraget redan uträknat
          <span className="caret text-blue">|</span>
        </p>
      </div>
    );
  if (index === 1)
    return (
      <div className="rounded-2xl bg-mist p-4 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-ink">
            <Doc size={14} /> Påminnelse · Faktura 1043
          </span>
          <span className="rounded-full bg-red/10 px-2 py-0.5 text-[11px] font-medium text-red">5 dagar sen</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-ink-2">Att betala</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">8 400 kr</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#2D8A4E]">
          <Check size={14} /> Underlaget redo för Fortnox
        </div>
      </div>
    );
  return (
    <div className="rounded-2xl bg-mist p-4 text-[13px]">
      <div className="flex items-center gap-0.5 text-[#E0A21B]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} />
        ))}
        <span className="ml-2 text-ink-3">Google-recension</span>
      </div>
      <p className="mt-2 text-ink-2">”Snabbt, noggrant och trevligt bemötande.”</p>
      <div className="mt-3 rounded-xl bg-white p-3 text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        Tack för fina ord, Maria! Vi ses i vår igen.
        <span className="caret text-blue">|</span>
      </div>
    </div>
  );
}

function FeatureCard({ index }: { index: number }) {
  const tilt = useRef<HTMLDivElement>(null);
  useTilt(tilt, 8);
  const f = FEATURES[index];
  return (
    <li className="feature-card [perspective:1200px]">
      <div className="feature-flip preserve-3d h-full">
        <div ref={tilt} className="card preserve-3d flex h-full flex-col p-6 md:p-7">
          <span className="eyebrow text-blue">0{index + 1}</span>
          <h3 className="headline mt-3 text-[1.9rem]">{f.title}</h3>
          <p className="mt-3 flex-1 leading-relaxed text-ink-2">{f.body}</p>
          <div className="mt-6" style={{ transform: "translateZ(40px)" }}>
            <FeatureVisual index={index} />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * The product screen lies tilted back in 3D and stands up as you scroll
 * (Linear/Apple style); notifications float above it at different depths.
 */
export default function Product() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MOTION, () => {
        gsap.from(".product-head > *", {
          y: 60,
          opacity: 0,
          stagger: 0.1,
          duration: 1.2,
          ease: "expo.out",
          scrollTrigger: { trigger: ".product-head", start: "top 80%" },
        });

        gsap
          .timeline({
            scrollTrigger: { trigger: ".product-stage", start: "top 95%", end: "center 55%", scrub: 1 },
          })
          .fromTo(
            ".product-screen",
            { rotateX: 58, scale: 0.78, y: 60, rotateZ: -3 },
            { rotateX: 0, scale: 1, y: 0, rotateZ: 0, ease: "power2.out" },
            0,
          )
          .fromTo(".product-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, ease: "none" }, 0)
          .from(
            ".floater",
            { z: 900, opacity: 0, rotateX: -30, stagger: 0.12, ease: "power3.out", duration: 0.7 },
            0.25,
          );

        // Cards fold in from the side, one after the other.
        gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card, i) => {
          gsap.fromTo(
            card.querySelector(".feature-flip"),
            { rotateY: -75, rotateX: 18, z: -380, opacity: 0, transformOrigin: "0% 50%" },
            {
              rotateY: 0,
              rotateX: 0,
              z: 0,
              opacity: 1,
              ease: "power3.out",
              scrollTrigger: { trigger: card, start: `top ${92 - i * 4}%`, end: `top ${52 - i * 4}%`, scrub: 1 },
            },
          );
        });
      });

      mm.add(MOTION_DESKTOP, () => {
        // Screen follows the pointer a little once it's upright.
        const el = root.current?.querySelector<HTMLElement>(".product-tilt");
        if (!el) return;
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          rx(-(e.clientY / window.innerHeight - 0.5) * 6);
          ry((e.clientX / window.innerWidth - 0.5) * 8);
        };
        window.addEventListener("pointermove", move);
        return () => window.removeEventListener("pointermove", move);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="teamet" className="relative pb-24 pt-10 md:pb-36" aria-labelledby="product-title">
      <div className="product-head mx-auto max-w-4xl px-5 text-center">
        <p className="eyebrow text-blue">{PRODUCT.eyebrow}</p>
        <h2 id="product-title" className="headline mt-5 text-[clamp(2.5rem,6vw,5.4rem)]">
          {PRODUCT.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-2">{PRODUCT.body}</p>
      </div>

      <div
        data-stage="2"
        className="product-stage relative mx-auto mt-14 max-w-6xl px-4 [perspective:1600px] md:mt-20 md:px-8"
      >
        <div className="product-glow pointer-events-none absolute inset-x-[10%] top-[10%] -z-10 h-[80%] rounded-full bg-blue/25 blur-[90px]" />
        <div className="product-tilt preserve-3d">
          <div className="product-screen preserve-3d relative" style={{ transformOrigin: "50% 0%" }}>
            <div className="aspect-[4/5] overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_50px_100px_-30px_rgba(16,41,110,0.45)] sm:aspect-[16/10]">
              <div className="flex h-7 items-center gap-1.5 px-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="h-[calc(100%-1.75rem)] rounded-[16px]">
                <AppMock />
              </div>
            </div>

            {FLOATERS.map((f) => (
              <div
                key={f.who}
                className={`floater absolute hidden w-[17rem] md:block ${f.pos}`}
                style={{ transform: `translateZ(${f.z}px)` }}
              >
                <div className="card flex gap-3 rounded-2xl p-3.5 text-[13px]">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: f.accent }}
                  >
                    {f.initials}
                  </span>
                  <span>
                    <span className="block font-medium">{f.who}</span>
                    <span className="block text-ink-2">{f.text}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="mx-auto mt-24 grid max-w-6xl gap-5 px-4 md:mt-36 md:grid-cols-3 md:px-8">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} index={i} />
        ))}
      </ul>
    </section>
  );
}
