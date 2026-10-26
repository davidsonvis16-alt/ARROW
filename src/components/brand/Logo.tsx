import React, { useId } from 'react';

/**
 * The ARROW mark: an arrow in flight, set in a rounded tile like an app icon.
 * The same drawing is used for the favicon and install icon in /public, so the
 * brand looks identical in the tab, on the home screen and inside the app.
 */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => {
  // A per-instance gradient id. With a shared id, every mark points at the
  // first definition in the page — and when that copy sits in a hidden
  // container (the desktop rail on a phone) the browser paints no fill at all.
  const gradientId = `arrow-mark-${useId().replace(/:/g, '')}`;

  return (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={className}
    role="img"
    aria-label="ARROW"
  >
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FF7A45" />
        <stop offset="1" stopColor="#E0482A" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="#E85D2A" />
    <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
    {/* Shaft, head and fletching */}
    <path
      d="M18 46 L44 20 M30 20 H44 V34 M18 46 l-2 -7 M18 46 l7 2"
      fill="none"
      stroke="#fff"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
  );
};

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Light text for use on the dark rail. */
  inverted?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', inverted = false, className = '' }) => {
  const mark = { sm: 24, md: 28, lg: 40 }[size];
  const text = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' }[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={mark} />
      <span
        className={`${text} font-black tracking-[-0.04em] leading-none ${
          inverted ? 'text-[var(--color-rail-ink)]' : 'text-[var(--color-ink)]'
        }`}
      >
        ARROW
      </span>
    </span>
  );
};

/** Eden's portfolio — where the "Created by Eden" credit leads. */
export const EDEN_URL = 'https://portfolio-e-mu.vercel.app/';

/** The maker's credit. Shown in the rail, the profile tab, legal pages and onboarding. */
export const CreatedByEden: React.FC<{ className?: string; inverted?: boolean }> = ({
  className = '',
  inverted = false,
}) => (
  <p
    className={`text-[11px] tracking-wide ${
      inverted ? 'text-white/45' : 'text-[var(--color-stone-dark)]'
    } ${className}`}
  >
    Created by{' '}
    <a
      href={EDEN_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-bold underline-offset-2 hover:underline ${
        inverted ? 'text-white/80 hover:text-white' : 'text-[var(--color-ink)] hover:text-[var(--color-arrow-orange-text)]'
      }`}
    >
      Eden
    </a>
  </p>
);
