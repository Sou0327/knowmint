'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-dq-text-sub mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 text-base rounded-sm border-2
            bg-dq-surface
            text-dq-text
            placeholder:text-dq-text-muted
            focus:outline-none focus:ring-2 focus:ring-dq-gold focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            resize-vertical
            min-h-[100px]
            ${
              error
                ? 'border-dq-red focus:ring-dq-red'
                : 'border-dq-border focus:border-dq-gold'
            }
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : hint
                ? `${textareaId}-hint`
                : undefined
          }
          {...props}
        />
        {hint && !error && (
          <p
            id={`${textareaId}-hint`}
            className="mt-1.5 text-sm text-dq-text-muted"
          >
            {hint}
          </p>
        )}
        {error && (
          <p
            id={`${textareaId}-error`}
            className="mt-1.5 text-sm text-dq-red"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
