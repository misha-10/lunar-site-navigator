import React from 'react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
  isMonospace?: boolean;
  sizeVariant?: 'sm' | 'md';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      prefixElement,
      suffixElement,
      isMonospace = true,
      sizeVariant = 'sm',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const sizeStyles = {
      sm: 'py-1 px-2 text-xs',
      md: 'py-1.5 px-3 text-xs',
    };

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium select-none"
          >
            {label}
          </label>
        )}
        <div
          className={`flex items-center rounded border border-[#263449] bg-[#080D18] focus-within:border-[#38BDF8] focus-within:ring-1 focus-within:ring-[#38BDF8] transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {prefixElement && (
            <span className="pl-2 text-slate-500 text-xs select-none">
              {prefixElement}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none ${
              isMonospace ? 'font-mono' : 'font-sans'
            } ${sizeStyles[sizeVariant]} ${className}`}
            {...props}
          />
          {suffixElement && (
            <span className="pr-2 text-slate-500 text-xs font-mono select-none">
              {suffixElement}
            </span>
          )}
        </div>
      </div>
    );
  }
);
Input.displayName = 'Input';
