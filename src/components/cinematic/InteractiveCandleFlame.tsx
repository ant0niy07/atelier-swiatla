'use client';

import { CSSProperties, useEffect, useId, useRef, useState } from 'react';

import './flame.css';

type InteractiveCandleFlameProps = {
  className?: string;
  /** The rendered flame height in CSS pixels. */
  size?: number;
  /** Keeps a calm, accessible flame for visitors who request reduced motion. */
  reducedMotion?: boolean;
};

type WindState = {
  bend: number;
  velocity: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  frame: number | null;
};

/**
 * An SVG flame with a separate waxy outer envelope, bright core and diffuse glow.
 * It derives its impulse from pointer velocity (not pointer position), so a hand
 * passing quickly nearby feels like a small gust rather than a magnetic cursor.
 */
export function InteractiveCandleFlame({
  className = '',
  size = 76,
  reducedMotion = false,
}: InteractiveCandleFlameProps) {
  const id = useId().replace(/:/g, '');
  const outerGradientId = `flameOuter-${id}`;
  const coreGradientId = `flameCore-${id}`;
  const flameRef = useRef<HTMLDivElement>(null);
  const wind = useRef<WindState>({
    bend: 0,
    velocity: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    frame: null,
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(reducedMotion);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(reducedMotion || media.matches);

    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, [reducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const windState = wind.current;

    const animate = () => {
      const node = flameRef.current;
      if (!node) return;

      // Spring recovery: enough inertia to read as air flow, but never enough to
      // distort the flame into a cartoon.
      windState.velocity += -windState.bend * 0.12;
      windState.velocity *= 0.78;
      windState.bend += windState.velocity;
      windState.bend *= 0.965;

      const bend = Math.max(-12, Math.min(12, windState.bend));
      node.style.setProperty('--flame-bend', `${bend.toFixed(2)}deg`);
      node.style.setProperty('--flame-drift', `${(bend * 0.075).toFixed(2)}px`);
      windState.frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      const node = flameRef.current;
      if (!node) return;

      const now = performance.now();
      const previousTime = windState.lastTime || now;
      const elapsed = Math.max(16, now - previousTime);
      const dx = event.clientX - windState.lastX;
      const dy = event.clientY - windState.lastY;
      windState.lastX = event.clientX;
      windState.lastY = event.clientY;
      windState.lastTime = now;

      const bounds = node.getBoundingClientRect();
      const distanceX = event.clientX - (bounds.left + bounds.width / 2);
      const distanceY = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(distanceX, distanceY);
      const proximity = Math.max(0, 1 - distance / 300);
      const pointerSpeed = Math.min(1.8, Math.hypot(dx, dy) / elapsed);

      if (proximity > 0.02 && pointerSpeed > 0.06) {
        const impulse = Math.max(-4.4, Math.min(4.4, dx * pointerSpeed * proximity * 0.11));
        windState.velocity += impulse;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    windState.frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (windState.frame) window.cancelAnimationFrame(windState.frame);
    };
  }, [prefersReducedMotion]);

  const style = {
    '--flame-size': `${size}px`,
    '--flame-bend': '0deg',
    '--flame-drift': '0px',
  } as CSSProperties;

  return (
    <div
      ref={flameRef}
      className={`interactive-flame ${prefersReducedMotion ? 'interactive-flame--still' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <span className="interactive-flame__halo" />
      <svg className="interactive-flame__svg" viewBox="0 0 64 92" role="presentation">
        <defs>
          <linearGradient id={outerGradientId} x1="0" x2="0.9" y1="1" y2="0">
            <stop offset="0" stopColor="#ffae3d" />
            <stop offset="0.45" stopColor="#ffd88c" />
            <stop offset="1" stopColor="#fff5d9" />
          </linearGradient>
          <linearGradient id={coreGradientId} x1="0.3" x2="0.7" y1="1" y2="0">
            <stop offset="0" stopColor="#fff1b1" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <g className="interactive-flame__body">
          <path
            className="interactive-flame__outer"
            d="M32 88C10 76 11 51 25 32c5-7 7-16 7-25 14 14 22 29 19 43 8-5 10-13 10-19 9 18 4 43-15 54-5 3-10 4-14 3Z"
            fill={`url(#${outerGradientId})`}
          />
          <path
            className="interactive-flame__core"
            d="M32 79c-10-8-8-21 1-36 8 11 13 22 6 31-2 3-4 5-7 5Z"
            fill={`url(#${coreGradientId})`}
          />
        </g>
      </svg>
    </div>
  );
}
