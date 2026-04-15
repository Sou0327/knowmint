"use client";

import { useEffect, type RefObject } from "react";

/**
 * WAI-ARIA APG Dialog Pattern focus trap hook.
 *
 * Behavior when `isActive` is true:
 * - Saves `document.activeElement` (the opener) so focus can be restored.
 * - Moves focus to the first tabbable element inside `containerRef`
 *   (or the container itself if none is tabbable) on activation.
 * - Wraps Tab / Shift+Tab inside the container.
 *
 * When `isActive` becomes false, focus returns to the previously focused element.
 *
 * Ref: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => {
    // Skip elements that are not actually focusable (hidden / inert)
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // offsetParent is null for display:none; dialogs using visibility:hidden are rare here
    return el.offsetParent !== null || el === document.activeElement;
  });
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Move focus into the dialog. If nothing is tabbable, make the container
    // itself focusable so screen readers still land inside the dialog.
    const focusables = getFocusableElements(container);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const current = getFocusableElements(container);
      if (current.length === 0) {
        // Keep focus inside the dialog even when no tabbable child exists.
        e.preventDefault();
        container.focus();
        return;
      }

      const first = current[0];
      const last = current[current.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the opener if it is still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isActive, containerRef]);
}

export default useFocusTrap;
