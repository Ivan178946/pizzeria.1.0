import { useEffect, useRef, useState } from 'react';

// =========================================================
// NÚMERO ANIMADO (cuenta desde el valor anterior al nuevo)
// =========================================================

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(target, duration = 900) {
  const to = Number(target) || 0;
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0);
  const current = useRef(prefersReducedMotion() ? to : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = to;
      setValue(to);
      return;
    }

    const from = current.current;
    const start = performance.now();
    let frame;

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;

      current.current = next;
      setValue(next);

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return value;
}

export default function AnimatedNumber({
  value,
  format = v => Math.round(v),
  duration
}) {
  const animated = useCountUp(value, duration);

  return <>{format(animated)}</>;
}
