import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const ArrowRight = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const Check = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const Plus = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Menu = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);
export const Close = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Spark = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
);
export const Shield = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const Users = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M16 14.3c2.3.1 4 1.6 4.5 4.2" />
  </svg>
);
export const Hand = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M8 11V5.5a1.5 1.5 0 013 0V10M11 10V4.5a1.5 1.5 0 013 0V10M14 10V6a1.5 1.5 0 013 0v7.5c0 4-2.6 7-6.5 7-2.4 0-4.2-1.2-5.6-3.3L3.6 13.8a1.4 1.4 0 012.2-1.7L8 14" />
  </svg>
);
export const Clock = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const Mail = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
export const Doc = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-10.5a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" />
    <path d="M14 3.5V8h4M9 12h6M9 15.5h6" />
  </svg>
);
export const Star = ({ size = 14, ...p }: P) => (
  <svg {...base(size, { fill: "currentColor", stroke: "none", ...p })}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5z" />
  </svg>
);
export const Send = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
  </svg>
);
