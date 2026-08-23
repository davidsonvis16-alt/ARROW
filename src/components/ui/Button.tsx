import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  arrow?: 'right' | 'up-right' | 'none';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  arrow = 'none',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2 rounded-xl gap-1.5 font-bold tracking-wider uppercase',
    md: 'text-sm px-5 py-3 rounded-2xl gap-2 font-bold',
    lg: 'text-base px-6 py-4 rounded-2xl gap-2.5 font-bold tracking-wide uppercase',
  };

  const variantStyles = {
    primary:
      'bg-[#111111] text-[#F5F3EE] hover:bg-[#262626] shadow-sm active:bg-black',
    secondary:
      'bg-[#E85D2A] text-white hover:bg-[#D05325] shadow-md hover:shadow-lg',
    outline:
      'bg-transparent border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-[#F5F3EE]',
    ghost:
      'bg-transparent text-[#111111] hover:bg-[#EBE8E1]',
    danger:
      'bg-[#D9383A] text-white hover:bg-[#BF2B2D]',
    glass:
      'bg-[#D9D6CF]/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
      {arrow === 'right' && (
        <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 font-mono">
          →
        </span>
      )}
      {arrow === 'up-right' && (
        <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 font-mono">
          ↗
        </span>
      )}
    </button>
  );
};

