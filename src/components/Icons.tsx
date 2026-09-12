import type { SVGProps } from 'react';

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

type P = SVGProps<SVGSVGElement>;

export const IconArrowRight = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
);
export const IconArrowLeft = (p: P) => (
  <svg {...base} {...p}><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}><path d="m5 12 5 5L20 7" /></svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
export const IconHome = (p: P) => (
  <svg {...base} {...p}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base} {...p}><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z" /><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z" /></svg>
);
export const IconPie = (p: P) => (
  <svg {...base} {...p}><path d="M21.2 15.9A10 10 0 1 1 8 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconScale = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12h8" /><path d="M8 8h8" /><path d="M8 16h5" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base} {...p}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base} {...p}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 21h16" /></svg>
);

/** BASELINE 로고 마크: 세로 기준선 + b 곡선 */
export const LogoMark = (p: P) => (
  <svg viewBox="0 0 24 28" width="18" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden {...p}>
    <path d="M6 2v24" />
    <path d="M6 11c6 0 10 2.4 10 7.5S12 26 6 26" />
  </svg>
);
