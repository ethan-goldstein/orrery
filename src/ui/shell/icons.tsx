import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

/** Line glyphs drawn on a 24-grid, 1.5 px strokes, currentColor. */
function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const Glyph = {
  /** the wordmark: a sun with two orbits and a planet */
  orrery: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6.5" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-20 12 12)" />
      <circle cx="19.2" cy="8.4" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  solar: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="6" strokeDasharray="1.5 2.5" />
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="18" cy="6.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="7.2" cy="15.8" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  earth: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 5.5c1.2 1.6 3.6 1.2 4 3.2s-2 2.2-1.6 4.2 2.8 1.6 3.2 3.6-1.2 3.2-1.2 3.2" />
      <path d="M16.5 6c-1 1.4.3 2.6 1.6 3.2s2.2 1.6 2.6 2.8" />
    </Svg>
  ),
  moon: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18 7 7 0 0 1 0-18z" fill="currentColor" stroke="none" opacity="0.35" />
      <circle cx="9" cy="9" r="1.4" />
      <circle cx="8" cy="14.5" r="0.9" />
    </Svg>
  ),
  mars: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 9.5c2.5.4 4.5-.8 7-.4s3.5 2 6 1.6 2-1.4 2-1.4" />
      <path d="M5 15.5c3-.6 5.5.8 8.5.2s4-1.8 5.5-1.6" />
      <path d="M8.5 6.5h7" strokeOpacity="0.5" />
    </Svg>
  ),
  orbit: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-30 12 12)" />
      <circle cx="20.4" cy="7.6" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  quakes: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M4 12h3l1.5-3 2 6 2-8 2 9 1.5-4h4" />
    </Svg>
  ),
  oceans: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 10c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3-1.4 4-.6" />
      <path d="M5 14.5c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 2.4-1.2 3.4-.8" />
    </Svg>
  ),
  civilization: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 17v-5l4-3 4 3v5" />
      <path d="M10.5 17v-3h3v3" />
      <path d="M12 6.5v1" />
    </Svg>
  ),
  play: (p: P) => (
    <Svg {...p}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  pause: (p: P) => (
    <Svg {...p}>
      <path d="M8 6v12M16 6v12" strokeWidth="2.4" />
    </Svg>
  ),
  plus: (p: P) => (
    <Svg {...p}>
      <path d="M12 6v12M6 12h12" />
    </Svg>
  ),
  minus: (p: P) => (
    <Svg {...p}>
      <path d="M6 12h12" />
    </Svg>
  ),
  reset: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" />
      <path d="M5 4.5v3.5h3.5" />
    </Svg>
  ),
  stepBack: (p: P) => (
    <Svg {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  ),
  stepForward: (p: P) => (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  now: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </Svg>
  ),
  sources: (p: P) => (
    <Svg {...p}>
      <path d="M6 4.5h9l3 3v12H6z" />
      <path d="M9 10h6M9 13.5h6M9 17h4" />
    </Svg>
  ),
  settings: (p: P) => (
    <Svg {...p}>
      <path d="M5 8h14M5 16h14" />
      <circle cx="9" cy="8" r="2" fill="var(--color-ink-2)" />
      <circle cx="15" cy="16" r="2" fill="var(--color-ink-2)" />
    </Svg>
  ),
  github: (p: P) => (
    <Svg {...p}>
      <path d="M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.6-.2.6-.4v-1.6c-2.4.5-2.9-1-2.9-1-.4-1-.9-1.3-.9-1.3-.8-.5.1-.5.1-.5.9.1 1.3.9 1.3.9.8 1.3 2 .9 2.5.7.1-.6.3-.9.5-1.1-1.9-.2-3.9-.9-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.3 0 0 .7-.2 2.3.9a8 8 0 0 1 4.2 0c1.6-1.1 2.3-.9 2.3-.9.5 1.2.2 2.1.1 2.3.6.6.9 1.4.9 2.3 0 3.3-2 4-3.9 4.2.3.3.6.8.6 1.6v2.4c0 .2.2.5.6.4A8.5 8.5 0 0 0 12 3.5z" />
    </Svg>
  ),
  home: (p: P) => (
    <Svg {...p}>
      <path d="M4.5 11.5 12 5l7.5 6.5V19h-5v-5h-5v5h-5z" />
    </Svg>
  ),
};

export type GlyphName = keyof typeof Glyph;
