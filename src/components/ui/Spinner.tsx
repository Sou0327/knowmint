export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Spinner = ({ size = 'md', className = '' }: SpinnerProps) => {
  const sizeStyles = {
    sm: 'text-sm gap-1',
    md: 'text-lg gap-1.5',
    lg: 'text-2xl gap-2',
  };

  return (
    <div
      className={`inline-flex items-center ${sizeStyles[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="dq-cursor text-dq-gold">▶</span>
      <span className="dq-cursor dq-cursor-d3 text-dq-gold">▶</span>
      <span className="dq-cursor dq-cursor-d6 text-dq-gold">▶</span>
    </div>
  );
};

export default Spinner;
