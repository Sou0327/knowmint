'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-dq-gold focus:ring-offset-1 focus:ring-offset-dq-bg disabled:opacity-50 disabled:cursor-not-allowed border-2';

    const variantStyles = {
      primary:
        'bg-dq-gold text-dq-bg border-dq-gold hover:brightness-110',
      secondary:
        'bg-dq-surface text-dq-text border-dq-border hover:bg-dq-hover',
      outline:
        'border-dq-gold text-dq-gold bg-transparent hover:bg-dq-gold/10',
      ghost:
        'text-dq-text-sub border-transparent hover:bg-dq-surface hover:text-dq-text',
      danger:
        'bg-dq-red text-white border-dq-red hover:brightness-110',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-base gap-2',
      lg: 'px-6 py-3 text-lg gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 bg-current rounded-full dq-cursor" />
            <span className="h-1.5 w-1.5 bg-current rounded-full dq-cursor" style={{ animationDelay: '0.2s' }} />
            <span className="h-1.5 w-1.5 bg-current rounded-full dq-cursor" style={{ animationDelay: '0.4s' }} />
          </span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
