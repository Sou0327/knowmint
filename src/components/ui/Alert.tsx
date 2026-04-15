import { type ReactNode } from 'react';

export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  /**
   * Override the default role. Errors default to `role="alert"` for assistive
   * tech; other variants default to `role="status"`.
   */
  role?: 'alert' | 'status' | 'note';
}

const variantStyles: Record<AlertVariant, string> = {
  error:
    'border-l-4 border-dq-red bg-dq-red/10 text-dq-red',
  success:
    'border-l-4 border-dq-green bg-dq-green/10 text-dq-green',
  warning:
    'border-l-4 border-dq-gold bg-dq-gold/10 text-dq-gold',
  info:
    'border-l-4 border-dq-cyan bg-dq-cyan/10 text-dq-cyan',
};

/**
 * DQ-themed block-level status banner. Pairs with Badge (inline).
 *
 * Defaults:
 * - `error` → `role="alert"` + `aria-live="assertive"`
 * - others → `role="status"` + `aria-live="polite"`
 */
const Alert = ({
  variant = 'info',
  children,
  className = '',
  title,
  role,
}: AlertProps) => {
  const computedRole = role ?? (variant === 'error' ? 'alert' : 'status');
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <div
      role={computedRole}
      aria-live={ariaLive}
      className={`rounded-sm px-3 py-2 text-sm ${variantStyles[variant]} ${className}`}
    >
      {title && (
        <p className="mb-0.5 font-semibold">{title}</p>
      )}
      {children}
    </div>
  );
};

export default Alert;
