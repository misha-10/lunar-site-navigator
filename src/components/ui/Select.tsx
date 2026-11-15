import React from 'react';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  sizeVariant?: 'sm' | 'md';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = '',
      label,
      sizeVariant = 'sm',
      disabled,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId =
      id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const sizeStyles = {
      sm: 'py-1 px-2.5 text-xs',
      md: 'py-1.5 px-3 text-xs',
    };

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium select-none"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`rounded border border-[#263449] bg-[#080D18] text-slate-200 font-mono transition-colors focus:border-[#38BDF8] focus:outline-none focus:ring-1 focus:ring-[#38BDF8] disabled:opacity-50 disabled:cursor-not-allowed ${
            sizeStyles[sizeVariant]
          } ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = 'Select';
