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
    variantStyles = 'bg-[#111111] text-[#F5F3EE] border border-[#111111]';
  } else {
    switch (variant) {
      case 'accent':
        variantStyles = 'bg-[#FDF1EB] text-[#E85D2A] border border-[#F9C3AF]';
        break;
      case 'forest':
        variantStyles = 'bg-[#EAF1EF] text-[#17352F] border border-[#C5DCD6]';
        break;
      case 'outline':
        variantStyles = 'bg-transparent text-[#111111] border border-[#D9D6CF] hover:border-[#111111]';
        break;
      case 'stone':
        variantStyles = 'bg-[#EBE8E1] text-[#333333] border border-transparent';
        break;
      case 'neutral':
      default:
        variantStyles = 'bg-[#FAF8F4] text-[#111111] border border-[#D9D6CF]';
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

