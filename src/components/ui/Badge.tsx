import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'amber' | 'blue' | 'success' | 'warning' | 'neutral';
  hasDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  hasDot = false,
  children,
  ...props
}) => {
  const variantStyles = {
    cyan: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30',
    amber: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/30',
    blue: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/30',
    success: 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/30',
    warning: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30',
    neutral: 'bg-[#152033] text-slate-400 border-[#263449]',
  };

  const dotColors = {
    cyan: 'bg-[#38BDF8]',
    amber: 'bg-[#FBBF24]',
    blue: 'bg-[#60A5FA]',
    success: 'bg-[#34D399]',
    warning: 'bg-[#F87171]',
    neutral: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider border select-none ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {hasDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
