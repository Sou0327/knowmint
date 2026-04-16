"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Animation = "fade-up" | "fade-in" | "fade-left" | "fade-right" | "scale-in";

interface AnimateOnScrollProps {
  children: ReactNode;
  animation?: Animation;
  /** Delay in ms before animation starts */
  delay?: number;
  /** IntersectionObserver threshold (0-1) */
  threshold?: number;
  /** Once visible, stay visible */
  once?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

const ANIMATION_MAP: Record<Animation, string> = {
  "fade-up": "animate-fade-up",
  "fade-in": "animate-fade-in",
  "fade-left": "animate-fade-left",
  "fade-right": "animate-fade-right",
  "scale-in": "animate-scale-in",
};

export default function AnimateOnScroll({
  children,
  animation = "fade-up",
  delay = 0,
  threshold = 0.15,
  once = true,
  className = "",
  as: Tag = "div",
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Progressive enhancement:
  //   "initial" — SSR / hydration 初期: style 無し = visible。JS 未実行でも見える。
  //   "hidden"  — viewport 外で mount したときだけ JS hydrate 後に設定。opacity 0 で scroll 待ち。
  //   "visible" — IntersectionObserver 発火後: scroll-in animation 再生。
  // IntersectionObserver が発火しない環境 (古いブラウザ / JS 失敗) でも "initial" のまま = visible。
  const [mode, setMode] = useState<"initial" | "hidden" | "visible">("initial");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;

    if (inViewport) {
      // 既に viewport 内 — scroll-in animation 不要。visible のまま維持。
      return;
    }

    setMode("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMode("visible");
          if (once) observer.unobserve(el);
        } else if (!once) {
          setMode("hidden");
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const animationName = ANIMATION_MAP[animation];

  // prefers-reduced-motion は globals.css の [data-animate] rule で処理。
  const style: React.CSSProperties | undefined =
    mode === "hidden"
      ? { opacity: 0 }
      : mode === "visible"
        ? {
            animation: `${animationName} 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            animationDelay: `${delay}ms`,
          }
        : undefined;

  return (
    // @ts-expect-error -- dynamic tag
    <Tag ref={ref} className={className} style={style} data-animate>
      {children}
    </Tag>
  );
}

/* Stagger wrapper: applies incremental delay to each AnimateOnScroll child */
interface StaggerProps {
  children: ReactNode;
  /** Base delay for first child in ms */
  baseDelay?: number;
  /** Delay increment per child in ms */
  increment?: number;
  animation?: Animation;
  className?: string;
  threshold?: number;
}

export function AnimateStagger({
  children,
  baseDelay = 0,
  increment = 80,
  animation = "fade-up",
  className = "",
  threshold = 0.1,
}: StaggerProps) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <>
      {items.map((child, i) => (
        <AnimateOnScroll
          key={i}
          animation={animation}
          delay={baseDelay + i * increment}
          threshold={threshold}
          className={className}
        >
          {child}
        </AnimateOnScroll>
      ))}
    </>
  );
}
