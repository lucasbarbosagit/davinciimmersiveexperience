"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type Particle = {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  driftY: number; // px/s, negativo = subindo
  swayAmp: number;
  swayFreq: number;
  twinkleFreq: number;
  phase: number;
  sprite: number; // índice em SPRITE_COLORS
};

// os dois dourados do design system (--gold / --gold-soft em globals.css)
const SPRITE_COLORS = ["201, 162, 75", "217, 188, 122"];
const PARTICLE_COUNT = 80;

// poeira dourada suspensa na luz do museu — canvas 2D puro (não precisa
// de Three.js pra 80 pontinhos), desenhando sprites pré-renderizados em
// vez de um radial-gradient novo por partícula por frame
export default function GoldDust({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    // sprite: disco dourado com halo suave, um por tom
    const sprites = SPRITE_COLORS.map((rgb) => {
      const s = document.createElement("canvas");
      const size = 32;
      s.width = size;
      s.height = size;
      const sctx = s.getContext("2d")!;
      const g = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, `rgba(${rgb}, 1)`);
      g.addColorStop(0.25, `rgba(${rgb}, 0.55)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, size, size);
      return s;
    });

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: rand(1.2, 3.4),
      baseAlpha: rand(0.25, 0.8),
      driftY: rand(-14, -4),
      swayAmp: rand(4, 18),
      swayFreq: rand(0.08, 0.25),
      twinkleFreq: rand(0.2, 0.7),
      phase: Math.random() * Math.PI * 2,
      sprite: Math.random() < 0.5 ? 0 : 1,
    }));

    function resize() {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // no ticker do GSAP (mesmo relógio do Lenis/ScrollTrigger no projeto);
    // como o ticker roda em rAF, aba em segundo plano pausa sozinha
    const draw = (time: number, deltaMs: number) => {
      if (!width || !height) return;
      const dt = Math.min(deltaMs / 1000, 0.25);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.y += (p.driftY * dt) / height;
        // recicla por baixo quando sai por cima, em x novo
        if (p.y < -0.04) {
          p.y = 1.04;
          p.x = Math.random();
        }
        const sway = Math.sin(time * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp;
        const twinkle = 0.55 + 0.45 * Math.sin(time * p.twinkleFreq * Math.PI * 2 + p.phase * 1.7);
        const drawSize = p.size * 4; // o sprite tem halo — desenha maior que o "grão"

        ctx.globalAlpha = p.baseAlpha * twinkle;
        ctx.drawImage(
          sprites[p.sprite],
          p.x * width + sway - drawSize / 2,
          p.y * height - drawSize / 2,
          drawSize,
          drawSize,
        );
      }
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(draw);

    return () => {
      gsap.ticker.remove(draw);
      resizeObserver.disconnect();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
