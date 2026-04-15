"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export interface UsePopoverResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}

/**
 * Combined outside-click + Escape dismissal for popovers / dropdown menus.
 *
 * - Clicking outside `panelRef` (and not on `triggerRef`) closes the popover.
 * - Pressing Escape closes the popover and returns focus to `triggerRef`.
 * - `toggle` / `close` are stable callbacks.
 *
 * Designed for menu-style popovers where the trigger is a button and the
 * panel is a sibling container. Consumers attach the refs to the trigger
 * button and the panel root respectively.
 */
export function usePopover(initialOpen = false): UsePopoverResult {
  const [open, setOpenState] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  const close = useCallback(() => {
    setOpenState(false);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      setOpenState(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpenState(false);
        // Return focus to the trigger for predictable keyboard navigation.
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle, close, triggerRef, panelRef };
}

export default usePopover;
