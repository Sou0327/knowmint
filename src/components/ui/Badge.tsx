import { type ReactNode } from 'react';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
  className?: string;
}

const Badge = ({ variant = 'default', children, className = '' }: BadgeProps) => {
  const variantStyles = {
    default:
      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    success:
      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    warning:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    error:
      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    info:
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;
