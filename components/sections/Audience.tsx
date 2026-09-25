"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { AUDIENCE } from "@/lib/content";

/**
 * Industries wrapped around a spinning 3D cylinder, spaced by their width
 * like text printed on a drum. Scroll speed winds it faster.
 */
export default function Audience() {
  const root = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".aud-word");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let radius = 0;
      let angles: number[] = [];

      const layout = () => {
        const widths = items.map((el) => el.offsetWidth);
        const gap = parseFloat(getComputedStyle(items[0]).fontSize) * 0.7;
        const total = widths.reduce((a, w) => a + w + gap, 0);
        radius = total / (Math.PI * 2);
        let run = 0;
        angles = widths.map((w) => {
          const a = ((run + w / 2) / total) * 360;
          run += w + gap;
          return a;
        });
        items.forEach((el, i) => {
          el.style.transform = `translate(-50%, -50%) rotateY(${angles[i]}deg) translateZ(${radius}px)`;
        });
      };
      layout();

      let spin = 0;
      let boost = 0;
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onRefresh: layout,
        onUpdate: (self) => {
          boost += self.getVelocity() * 0.0007;
        },
      });

      const render = (_t: number, dt: number) => {
        if (!ring.current || (!st.isActive && spin > 0)) return;
        if (!reduced) {
          boost *= 0.92;
          spin += (dt / 1000) * 10 + boost;
        }
        const angle = spin + st.progress * 120;
        // The tilt drops the front of the drum; lift it back to the centre line.
        ring.current.style.transform = `translateY(${-radius * Math.sin((8 * Math.PI) / 180)}px) translateZ(${-radius}px) rotateX(-8deg) rotateY(${-angle}deg)`;
        items.forEach((el, i) => {
          const facing = Math.cos(((angles[i] - angle) * Math.PI) / 180);
          el.style.opacity = String(Math.max(0, facing) ** 1.4);
        });
      };
      gsap.ticker.add(render);

      gsap.from(".aud-head", {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 80%" },
      });

      return () => {
        gsap.ticker.remove(render);
        st.kill();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden py-24 md:py-36" aria-labelledby="audience-title">
      <div className="aud-head mx-auto max-w-3xl px-4 text-center">
        <h2 id="audience-title" className="eyebrow text-ink-3">
          {AUDIENCE.title}
        </h2>
      </div>

      <div className="relative mx-auto mt-6 h-[8rem] w-full [perspective:1400px] md:mt-10 md:h-[12rem]" aria-hidden>
        <div ref={ring} className="preserve-3d absolute left-1/2 top-1/2 h-0 w-0">
          {[...AUDIENCE.industries, ...AUDIENCE.industries].map((w, i) => (
            <span
              key={i}
              className="aud-word headline backface-hidden absolute left-0 top-0 whitespace-nowrap text-[clamp(2.4rem,6.4vw,5.6rem)] text-ink"
            >
              {w}
            </span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {AUDIENCE.industries.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <p className="aud-head mx-auto mt-6 max-w-md px-4 text-center text-ink-2 md:mt-10">{AUDIENCE.note}</p>
    </section>
  );
}
