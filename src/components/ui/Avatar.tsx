import React, { useMemo, useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'full' | 'squircle';
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-lg',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-28 h-28 text-4xl',
};

/**
 * A person's photo, or a monogram in a colour derived from their name.
 *
 * The fallback matters more than it looks: every avatar in the app used to
 * fall back to the same stock photograph of an unrelated person, which on a
 * dating profile reads as a picture of that member. A letter cannot be
 * mistaken for a face. It also covers a photo that fails to load, which on a
 * private bucket happens whenever a signed URL has expired.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  rounded = 'squircle',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  const hue = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum = (sum + name.charCodeAt(i) * 17) % 360;
    return sum;
  }, [name]);

  const shape = rounded === 'full' ? 'rounded-full' : 'rounded-2xl';
  const base = `${SIZES[size]} ${shape} overflow-hidden shrink-0 border border-[var(--color-border)] flex items-center justify-center select-none ${className}`;

  if (src && !failed) {
    return (
      <div className={`${base} bg-[var(--color-stone-light)]`}>
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={base}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 40% 58%), hsl(${(hue + 40) % 360} 36% 36%))`,
      }}
      aria-hidden="true"
    >
      <span className="font-black text-white/85 tracking-tight">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    </div>
  );
};
