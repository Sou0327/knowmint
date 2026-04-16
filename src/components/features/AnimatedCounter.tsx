"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  /** Display value like "$10M+" or "77%" — prefix/suffix auto-detected */
  value: string;
  /** Duration of count-up in ms */
  duration?: number;
  className?: string;
}

/** Parse "$10M+" → { prefix: "$", number: 10, suffix: "M+" } */
function parseValue(raw: string) {
  const match = raw.match(/^([^0-9]*)(\d+)(.*)$/);
  if (!match) return { prefix: "", number: 0, suffix: raw };
  return { prefix: match[1], number: parseInt(match[2], 10), suffix: match[3] };
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return; // show final value immediately

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.unobserve(el);
          animate();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();

    function animate() {
      const { prefix, number, suffix } = parseValue(value);
      if (number === 0) return;

      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * number);
        setDisplay(`${prefix}${current}${suffix}`);
        if (progress < 1) requestAnimationFrame(step);
      };

      setDisplay(`${prefix}0${suffix}`);
      requestAnimationFrame(step);
    }
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
