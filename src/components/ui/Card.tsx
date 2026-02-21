import { type ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const Card = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
}: CardProps) => {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={`
        rounded-lg border border-zinc-200 dark:border-zinc-700
        bg-white dark:bg-zinc-900
        shadow-sm
        transition-shadow
        ${hover ? 'hover:shadow-md' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
