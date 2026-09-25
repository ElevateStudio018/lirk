"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { scene, STAGES } from "@/lib/scene";

const ParticleField = dynamic(() => import("./three/ParticleField"), { ssr: false });

let lenisInstance: Lenis | null = null;

/** Smooth-scrolls to an in-page anchor, falling back to native scrolling. */
export function scrollToHash(hash: string) {
  const el = hash === "#top" ? document.body : document.querySelector(hash);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el as HTMLElement, { offset: hash === "#top" ? 0 : -24, duration: 1.6 });
  else (el as HTMLElement).scrollIntoView({ behavior: "smooth" });
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Page-level motion: Lenis smooth scroll, the fixed backdrop, and the
 * director that turns scroll position into the particle stage and the
 * light/dark mix. Mounted after the sections so their pins exist first.
 */
export default function Experience() {
  const darkLayer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.reducedMotion = reduced;

    // Smooth scroll
    let lenis: Lenis | null = null;
    const raf = (time: number) => lenis?.raf(time * 1000);
    if (!reduced) {
      lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.4,
      });
      lenisInstance = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    // In-page anchors
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const hash = a.getAttribute("href");
      if (!hash || hash === "#") return;
      e.preventDefault();
      scrollToHash(hash);
      history.replaceState(null, "", hash === "#top" ? location.pathname : hash);
    };
    document.addEventListener("click", onClick);

    // Pointer for the particle "leaf blower"
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      scene.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      scene.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      scene.pointer.active = 1;
    };
    const onLeave = () => {
      scene.pointer.active = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    // Stage markers: each section with data-stage=k morphs the field k-1 → k as it enters.
    const markers = Array.from(document.querySelectorAll<HTMLElement>("[data-stage]"))
      .map((el) => ({ el, k: Number(el.dataset.stage) }))
      .filter((m) => m.k > 0)
      .sort((a, b) => a.k - b.k)
      .map(({ el, k }) => ({ k, st: ScrollTrigger.create({ trigger: el, start: "top 95%", end: "top 20%" }) }));

    const darkSections = Array.from(document.querySelectorAll<HTMLElement>("[data-dark]")).map((el) =>
      ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top" }),
    );

    let theme = "";
    const tick = (_time: number, deltaMs: number) => {
      const y = window.scrollY;
      const vh = window.innerHeight;

      // Markers are in page order; the last one that has started decides the stage.
      let stage = 0;
      for (const m of markers) {
        const p = clamp01((y - m.st.start) / Math.max(m.st.end - m.st.start, 1));
        if (p > 0) stage = m.k - 1 + p;
      }
      scene.stage = Math.min(stage, STAGES.length - 1);

      // Fade in while the section's top travels 70% → 30% of the viewport,
      // out while its bottom travels 90% → 60%.
      let dark = 0;
      for (const st of darkSections) {
        const fadeIn = clamp01((y - (st.start + vh * 0.3)) / (vh * 0.4));
        const fadeOut = clamp01((y - (st.end - vh * 0.9)) / (vh * 0.3));
        dark = Math.max(dark, fadeIn * (1 - fadeOut));
      }
      scene.dark += (dark - scene.dark) * (1 - Math.exp((-Math.min(deltaMs, 250) / 1000) * 12));
      if (darkLayer.current) darkLayer.current.style.opacity = scene.dark.toFixed(3);

      const next = scene.dark > 0.5 ? "dark" : "light";
      if (next !== theme) {
        theme = next;
        document.documentElement.dataset.theme = next;
      }
    };
    gsap.ticker.add(tick);

    // Fonts change line breaks and therefore every trigger position.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 600);

    return () => {
      window.clearTimeout(refresh);
      gsap.ticker.remove(tick);
      gsap.ticker.remove(raf);
      markers.forEach((m) => m.st.kill());
      darkSections.forEach((st) => st.kill());
      document.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      lenis?.destroy();
      lenisInstance = null;
    };
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden>
        <div className="backdrop__grain" />
        <div ref={darkLayer} className="backdrop__dark" />
      </div>
      <ParticleField />
    </>
  );
}
