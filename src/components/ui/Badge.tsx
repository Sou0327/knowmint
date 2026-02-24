import { type ReactNode } from 'react';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
  className?: string;
}

const Badge = ({ variant = 'default', children, className = '' }: BadgeProps) => {
  const variantStyles = {
    default:
      'bg-dq-surface text-dq-text-sub border-dq-border',
    success:
      'bg-dq-green/20 text-dq-green border-dq-green/40',
    warning:
      'bg-dq-yellow/20 text-dq-yellow border-dq-yellow/40',
    error:
      'bg-dq-red/20 text-dq-red border-dq-red/40',
    info:
      'bg-dq-cyan/20 text-dq-cyan border-dq-cyan/40',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        rounded-sm text-xs font-medium border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;
