"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "error" | "success" | "info" | "warning";

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

export interface ToastShowOptions {
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  show: (message: string, options?: ToastShowOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;

const variantStyles: Record<ToastVariant, string> = {
  error: "border-dq-red bg-dq-red/15 text-dq-red",
  success: "border-dq-green bg-dq-green/15 text-dq-green",
  warning: "border-dq-gold bg-dq-gold/15 text-dq-gold",
  info: "border-dq-cyan bg-dq-cyan/15 text-dq-cyan",
};

let toastIdSeq = 0;

function nextToastId(): number {
  toastIdSeq += 1;
  return toastIdSeq;
}

// Stable, SSR-safe mount detection: `useSyncExternalStore` returns the server
// snapshot (`false`) during SSR and the client snapshot (`true`) after hydration,
// without calling `setState` inside an effect.
const subscribeMount = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const mounted = useSyncExternalStore(
    subscribeMount,
    getMountedClient,
    getMountedServer,
  );

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((t) => clearTimeout(t));
      timerMap.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, options?: ToastShowOptions) => {
      const id = nextToastId();
      const toast: ToastMessage = {
        id,
        variant: options?.variant ?? "info",
        message,
        durationMs: options?.durationMs ?? DEFAULT_DURATION,
      };
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => {
        dismiss(id);
      }, toast.durationMs);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <ToastViewport toasts={toasts} onDismiss={dismiss} />,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  // Two stacked live regions: assertive for errors, polite for others.
  const assertive = toasts.filter((t) => t.variant === "error");
  const polite = toasts.filter((t) => t.variant !== "error");

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      aria-hidden={toasts.length === 0}
    >
      <div aria-live="assertive" aria-atomic="false" role="alert" className="contents">
        {assertive.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
      <div aria-live="polite" aria-atomic="false" role="status" className="contents">
        {polite.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className={`pointer-events-auto dq-window-sm border-2 ${variantStyles[toast.variant]} flex items-start gap-3 px-3 py-2 text-sm`}
    >
      <p className="flex-1 whitespace-pre-wrap break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-dq-text-muted hover:text-dq-text focus:outline-none focus:ring-2 focus:ring-dq-gold"
        aria-label="Close notification"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast must be used within a <ToastProvider>. Wrap your app in a ToastProvider.",
    );
  }
  return ctx;
}

export default ToastProvider;
