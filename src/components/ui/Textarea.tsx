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
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 text-base rounded-lg border
            bg-white dark:bg-zinc-900
            text-zinc-900 dark:text-zinc-100
            placeholder:text-zinc-400 dark:placeholder:text-zinc-500
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            resize-vertical
            min-h-[100px]
            ${
              error
                ? 'border-red-600 focus:ring-red-500 focus:border-red-600'
                : 'border-zinc-300 dark:border-zinc-600 focus:ring-blue-500 focus:border-blue-500'
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
            className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400"
          >
            {hint}
          </p>
        )}
        {error && (
          <p
            id={`${textareaId}-error`}
            className="mt-1.5 text-sm text-red-600 dark:text-red-500"
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
