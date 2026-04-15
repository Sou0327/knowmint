'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /**
   * When true, all close affordances are disabled:
   * - Escape key
   * - Backdrop click
   * - Header close button
   *
   * Use while an in-progress operation (e.g. payment) must not be interrupted.
   */
  disableClose?: boolean;
  /**
   * Override the default `role="dialog"`. Use `"alertdialog"` for modal
   * confirmations that require user response.
   */
  role?: 'dialog' | 'alertdialog';
  /**
   * Optional id for the description paragraph (for `aria-describedby`).
   */
  describedById?: string;
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  disableClose = false,
  role = 'dialog',
  describedById,
}: ModalProps) => {
  const t = useTranslations("Common");
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = title ? `modal-title-${reactId}` : undefined;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, disableClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!disableClose) onClose();
  };

  const handleCloseButton = () => {
    if (!disableClose) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* DQ-style dark backdrop */}
      <div
        className="fixed inset-0 bg-black/70 motion-safe:transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* DQ Window modal */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        className={`
          relative w-full ${sizeStyles[size]}
          dq-window
          max-h-[90vh] overflow-y-auto
          transform motion-safe:transition-all
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b-2 border-dq-border">
            <h2
              id={titleId}
              className="text-xl font-semibold font-display text-dq-gold"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={handleCloseButton}
              disabled={disableClose}
              className="text-dq-text-muted hover:text-dq-text transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t("close")}
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
