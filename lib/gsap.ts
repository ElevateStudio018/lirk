"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
}

/** Media queries for gsap.matchMedia(): heavy motion only when the visitor allows it. */
export const MOTION = "(prefers-reduced-motion: no-preference)";
export const MOTION_DESKTOP = "(prefers-reduced-motion: no-preference) and (min-width: 768px)";
export const MOTION_MOBILE = "(prefers-reduced-motion: no-preference) and (max-width: 767px)";

export { gsap, ScrollTrigger, SplitText, useGSAP };
