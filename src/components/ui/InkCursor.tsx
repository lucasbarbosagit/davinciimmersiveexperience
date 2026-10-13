"use client";

import { useEffect, useRef } from "react";

// A pena: o cursor deixa um traço fino de tinta dourada pelo site
// inteiro, que seca (some) em pouco mais de um segundo. É o fio que
// atravessa todas as seções — o hero, a galeria, o voador, a linha do
// tempo — e que vira pincel de verdade na seção do sfumato. Como uma
// pena de verdade, o traço afina quando a mão anda rápido e engrossa
// quando ela desacelera.
//
// Só em ponteiro fino (mouse/caneta) e sem "reduzir movimento". Um
// elemento com [data-ink-cursor="off"] embaixo do ponteiro suspende o
// traço (a seção de pintura usa o próprio pincel).
const LIFE = 1.15; // segundos até a tinta secar
const MAX_W = 2.2; // espessura máxima (px css)
const MIN_W = 0.5;
const COLOR = "217, 180, 106";

type Pt = { x: number; y: number; t: number; w: number };

export default function InkCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // um traço é uma lista de pontos; um traço novo começa quando o
    // ponteiro sai/volta da janela ou passa por uma área "off"
    let strokes: Pt[][] = [];
    let current: Pt[] | null = null;
    let raf = 0;
    let lastW = MAX_W;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const target = e.target as Element | null;
      if (target?.closest?.('[data-ink-cursor="off"]')) {
        current = null;
        return;
      }
      const now = performance.now() / 1000;
      const prev = current?.[current.length - 1];
      if (!current) {
        current = [];
        strokes.push(current);
      }
      let w = lastW;
      if (prev) {
        const d = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
        if (d < 1.5) return;
        const v = d / Math.max(0.004, now - prev.t); // px/s
        const goal = MAX_W - Math.min(1, v / 2600) * (MAX_W - MIN_W);
        w = lastW + (goal - lastW) * 0.35;
      }
      lastW = w;
      current.push({ x: e.clientX, y: e.clientY, t: now, w });
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onLeave = () => {
      current = null;
    };

    function draw() {
      raf = 0;
      const now = performance.now() / 1000;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.lineCap = "round";
      // seca no lugar (sem trocar os arrays: `current` continua sendo o
      // mesmo traço que recebe os pontos novos)
      for (const s of strokes) {
        let dry = 0;
        while (dry < s.length && now - s[dry].t >= LIFE) dry++;
        if (dry) s.splice(0, dry);
      }
      strokes = strokes.filter((s) => s.length > 0 || s === current);
      for (const s of strokes) {
        for (let i = 1; i < s.length; i++) {
          const a = s[i - 1];
          const b = s[i];
          // a tinta seca do começo pro fim: a cauda já está clara
          const age = (now - b.t) / LIFE;
          const alpha = Math.pow(1 - age, 1.6) * 0.85;
          if (alpha <= 0.01) continue;
          ctx!.strokeStyle = `rgba(${COLOR}, ${alpha.toFixed(3)})`;
          ctx!.lineWidth = b.w * (1 - age * 0.4);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          // curva pelo ponto médio: traço contínuo, sem quinas
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          ctx!.quadraticCurveTo(a.x, a.y, mx, my);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
      if (strokes.some((s) => s.length > 0)) raf = requestAnimationFrame(draw);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 70,
      }}
    />
  );
}
