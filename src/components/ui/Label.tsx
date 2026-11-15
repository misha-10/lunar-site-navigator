import React from 'react';

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  variant?: 'technical' | 'standard';
}

export const Label: React.FC<LabelProps> = ({
  className = '',
  variant = 'technical',
  children,
  ...props
}) => {
  const variantStyles = {
    technical:
      'text-[11px] font-mono font-medium uppercase tracking-wider text-slate-400 select-none',
    standard: 'text-xs font-sans font-medium text-slate-300 select-none',
  };

  return (
    <label className={`${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </label>
  );
};
