import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'amber'
    | 'blue'
    | 'success'
    | 'warning'
    | 'ghost'
    | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isFullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'secondary',
      size = 'sm',
      isFullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-mono font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#38BDF8] disabled:opacity-50 disabled:cursor-not-allowed select-none rounded';

    const sizeStyles = {
      xs: 'px-2 py-0.5 text-[11px] gap-1',
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-3.5 py-1.5 text-xs gap-2',
      lg: 'px-4 py-2 text-sm gap-2',
    };

    const variantStyles = {
      primary:
        'bg-[#38BDF8] text-slate-950 hover:bg-[#38BDF8]/90 font-semibold border border-[#38BDF8]',
      secondary:
        'bg-[#101827] text-slate-200 border border-[#263449] hover:bg-[#152033] hover:border-[#38BDF8]/40 hover:text-white',
      amber:
        'bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30 hover:bg-[#FBBF24]/20',
      blue:
        'bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/30 hover:bg-[#60A5FA]/20',
      success:
        'bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30 hover:bg-[#34D399]/20',
      warning:
        'bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/30 hover:bg-[#F87171]/20',
      ghost:
        'text-slate-400 hover:text-slate-100 hover:bg-[#152033] border border-transparent',
      outline:
        'border border-[#263449] text-slate-300 hover:bg-[#152033] hover:text-white',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
          isFullWidth ? 'w-full' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
