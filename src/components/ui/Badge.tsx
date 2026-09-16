import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'accent' | 'forest' | 'outline' | 'stone';
  size?: 'sm' | 'md';
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  onClick,
  selected = false,
  className = '',
}) => {
  const isClickable = Boolean(onClick);

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 select-none whitespace-nowrap';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1 rounded-full',
    md: 'text-xs font-semibold px-3 py-1.5 rounded-full',
  };

  let variantStyles = '';

  if (selected) {
    variantStyles = 'bg-[var(--color-ink)] text-[var(--color-offwhite)] border border-[var(--color-ink)]';
  } else {
    switch (variant) {
      case 'accent':
        variantStyles = 'bg-[var(--color-arrow-orange-subtle)] text-[var(--color-arrow-orange-text)] border border-[var(--color-danger)]';
        break;
      case 'forest':
        variantStyles = 'bg-[var(--color-forest-subtle)] text-[var(--color-forest)] border border-[var(--color-border-subtle)]';
        break;
      case 'outline':
        variantStyles = 'bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)]';
        break;
      case 'stone':
        variantStyles = 'bg-[var(--color-stone-light)] text-[var(--color-ink-soft)] border border-transparent';
        break;
      case 'neutral':
      default:
        variantStyles = 'bg-[var(--color-surface-subtle)] text-[var(--color-ink)] border border-[var(--color-border)]';
        break;
    }
  }

  const clickableStyles = isClickable
    ? 'cursor-pointer hover:opacity-90 active:scale-95'
    : '';

  return (
    <span
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles} ${clickableStyles} ${className}`}
    >
      {children}
    </span>
  );
};

