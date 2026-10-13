"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import SplitChars from "@/components/ui/SplitChars";
import styles from "./SfumatoSection.module.css";

// A pena vira pincel. Um painel escuro, com a forma da obra só pressentida
// por baixo; o visitante pinta passando o ponteiro, e cada pincelada é
// fumaça (vários toques macios e tremidos, nunca uma borda) — o próprio
// sfumato que Leonardo descrevia: luz e sombra fundidas "sem linhas nem
// contornos, à maneira da fumaça". Quando metade do quadro foi descoberta,
// o resto se resolve sozinho.
//
// Obra: La Scapigliata, c. 1506–1508, Galleria Nazionale, Parma. Domínio
// público (Wikimedia Commons).
const IMG_SRC = "/assets/sfumato-scapigliata.webp";
const IMG_W = 1000;
const IMG_H = 1500;
// fração do quadro descoberta a partir da qual ele se completa sozinho
const COMPLETE_AT = 0.4;

export default function SfumatoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const [done, setDone] = useState(false);

  // entrada do texto (tocada quando a seção chega)
  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 55%", toggleActions: "play none none reverse" },
      });
      tl.fromTo(
        section.querySelectorAll("[data-word] [data-char]"),
        { yPercent: 115 },
        { yPercent: 0, duration: 1.4, ease: "expo.out", stagger: 0.04 },
      )
        .fromTo(
          section.querySelectorAll("[data-copy] [data-char]"),
          { yPercent: 115 },
          { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.025 },
          0.2,
        )
        .fromTo(
          section.querySelectorAll("[data-fade]"),
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 },
          0.4,
        )
        .fromTo(
          frameRef.current,
          { clipPath: "inset(100% 0% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" },
          0,
        );
    }, section);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const brush = brushRef.current;
    if (!frame || !canvas || !brush) return;
    const ctx = canvas.getContext("2d");
    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d");
    const probe = document.createElement("canvas");
    probe.width = 40;
    probe.height = 60;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx || !mctx || !pctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const img = new Image();
    img.decoding = "async";
    img.src = IMG_SRC;
    let ready = false;

    let W = 0; // tamanho css
    let H = 0;
    let dpr = 1;
    let radius = 40;
    let reveal = 0; // 0..1: o resto do quadro se resolvendo no fim
    let complete = false;
    let dirty = true;
    let raf = 0;
    let painted = false;

    const resize = () => {
      const r = frame.getBoundingClientRect();
      W = r.width;
      H = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // guarda o que já foi pintado ao redimensionar
      const old = document.createElement("canvas");
      old.width = mask.width;
      old.height = mask.height;
      if (mask.width) old.getContext("2d")!.drawImage(mask, 0, 0);
      canvas.width = mask.width = Math.round(W * dpr);
      canvas.height = mask.height = Math.round(H * dpr);
      if (old.width) mctx.drawImage(old, 0, 0, mask.width, mask.height);
      radius = Math.max(26, W * 0.085);
      dirty = true;
      schedule();
    };

    // uma pincelada: alguns toques macios, deslocados e de tamanhos
    // diferentes — fumaça, não carimbo
    function dab(x: number, y: number, strength = 1) {
      const R = radius * dpr;
      for (let k = 0; k < 4; k++) {
        const ox = (Math.random() - 0.5) * R * 0.7;
        const oy = (Math.random() - 0.5) * R * 0.7;
        const rr = R * (0.55 + Math.random() * 0.6);
        const cx = x * dpr + ox;
        const cy = y * dpr + oy;
        const g = mctx!.createRadialGradient(cx, cy, 0, cx, cy, rr);
        const a = 0.11 * strength;
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        mctx!.fillStyle = g;
        mctx!.beginPath();
        mctx!.arc(cx, cy, rr, 0, Math.PI * 2);
        mctx!.fill();
      }
      dirty = true;
      schedule();
    }

    let last: { x: number; y: number } | null = null;
    function strokeTo(x: number, y: number, strength = 1) {
      if (!last) {
        dab(x, y, strength);
        last = { x, y };
        return;
      }
      const d = Math.hypot(x - last.x, y - last.y);
      const step = radius * 0.22;
      const n = Math.max(1, Math.floor(d / step));
      for (let i = 1; i <= n; i++) {
        dab(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n, strength);
      }
      last = { x, y };
    }

    function render() {
      raf = 0;
      if (!ready || !dirty) return;
      dirty = false;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalCompositeOperation = "source-over";
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      // a obra em "cover" dentro da moldura
      const s = Math.max(canvas!.width / IMG_W, canvas!.height / IMG_H);
      const dw = IMG_W * s;
      const dh = IMG_H * s;
      ctx!.drawImage(img, (canvas!.width - dw) / 2, (canvas!.height - dh) / 2, dw, dh);
      // só onde a fumaça passou (e, no fim, tudo)
      ctx!.globalCompositeOperation = "destination-in";
      if (reveal > 0) {
        ctx!.drawImage(mask, 0, 0);
        // o resto do quadro se resolve por trás do que já foi pintado
        ctx!.globalCompositeOperation = "destination-over";
        ctx!.globalAlpha = reveal;
        ctx!.drawImage(img, (canvas!.width - dw) / 2, (canvas!.height - dh) / 2, dw, dh);
        ctx!.globalAlpha = 1;
      } else {
        ctx!.drawImage(mask, 0, 0);
      }
      ctx!.globalCompositeOperation = "source-over";
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(render);
    }

    // quanto do quadro já foi descoberto
    let probeTimer = 0;
    function measure() {
      probeTimer = 0;
      if (complete || !mask.width) return;
      pctx!.clearRect(0, 0, 40, 60);
      pctx!.drawImage(mask, 0, 0, 40, 60);
      const data = pctx!.getImageData(0, 0, 40, 60).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) sum += Math.min(1, data[i] / 200);
      const frac = sum / (40 * 60);
      if (countRef.current) {
        countRef.current.textContent = String(Math.min(99, Math.round((frac / COMPLETE_AT) * 100))).padStart(2, "0");
      }
      if (frac >= COMPLETE_AT) finish();
    }
    function queueMeasure() {
      if (!probeTimer) probeTimer = window.setTimeout(measure, 220);
    }

    function finish() {
      if (complete) return;
      complete = true;
      if (countRef.current) countRef.current.textContent = "100";
      const st = { r: 0 };
      gsap.to(st, {
        r: 1,
        duration: 2.2,
        ease: "power2.inOut",
        onUpdate: () => {
          reveal = st.r;
          dirty = true;
          schedule();
        },
      });
      setDone(true);
    }

    resetRef.current = () => {
      mctx.clearRect(0, 0, mask.width, mask.height);
      complete = false;
      reveal = 0;
      painted = false;
      last = null;
      if (countRef.current) countRef.current.textContent = "00";
      setDone(false);
      dirty = true;
      schedule();
    };

    // ---------- o pincel do visitante ----------
    const local = (e: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      brush.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (complete) return;
      ghost?.kill();
      painted = true;
      strokeTo(p.x, p.y);
      queueMeasure();
    };
    const onEnter = (e: PointerEvent) => {
      last = null;
      const p = local(e);
      brush.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      frame.dataset.brush = "on";
    };
    const onLeave = () => {
      last = null;
      delete frame.dataset.brush;
    };
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerenter", onEnter);
    frame.addEventListener("pointerleave", onLeave);
    frame.addEventListener("pointercancel", onLeave);

    // ---------- o pincel fantasma: ensina o gesto ----------
    // na primeira vez que a seção aparece, se ninguém pintou ainda, um
    // pincel invisível passa uma pincelada curta sobre o rosto
    let ghost: gsap.core.Tween | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || painted || ghost || reduced) return;
        const path = { t: 0 };
        ghost = gsap.to(path, {
          t: 1,
          delay: 0.9,
          duration: 1.6,
          ease: "power1.inOut",
          onStart: () => {
            last = null;
          },
          onUpdate: () => {
            if (painted) return;
            // uma passada só, na diagonal, pela altura dos olhos
            const x = W * (0.22 + 0.5 * path.t);
            const y = H * (0.33 + 0.1 * path.t + Math.sin(path.t * Math.PI * 2) * 0.02);
            strokeTo(x, y, 1.2);
          },
          onComplete: () => {
            last = null;
            queueMeasure();
          },
        });
      },
      { threshold: 0.6 },
    );
    io.observe(frame);

    img.onload = () => {
      ready = true;
      dirty = true;
      if (reduced) finish();
      schedule();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(probeTimer);
      ghost?.kill();
      io.disconnect();
      ro.disconnect();
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerenter", onEnter);
      frame.removeEventListener("pointerleave", onLeave);
      frame.removeEventListener("pointercancel", onLeave);
    };
  }, []);

  return (
    <section className={styles.sfumato} id="sfumato" ref={sectionRef}>
      <div className={styles.stage}>
        <span className={styles.word} data-word="" aria-hidden="true">
          <SplitChars text="Sfumato" />
        </span>

        <div className={styles.frame} ref={frameRef} data-ink-cursor="off">
          {/* a obra pressentida por baixo: escura e desfocada, como a
              primeira camada de tinta no painel */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.under} src={IMG_SRC} alt="" aria-hidden="true" />
          <canvas
            className={styles.canvas}
            ref={canvasRef}
            role="img"
            aria-label="La Scapigliata, de Leonardo da Vinci, revelada pelas pinceladas do visitante"
          />
          <div className={styles.brush} ref={brushRef} aria-hidden="true" />
        </div>

        <div className={styles.copy} data-copy="">
          <span className={styles.eyebrow} data-fade="">
            Sfumato · c. 1506 – 1508
          </span>
          <h2 className={styles.title} aria-label="Sem linhas nem contornos">
            <SplitChars text="Sem linhas" />{" "}
            <em>
              <SplitChars text="nem contornos" />
            </em>
          </h2>
          <p className={styles.lead} data-fade="">
            Leonardo pedia que luz e sombra se fundissem &ldquo;sem linhas nem
            contornos, à maneira da fumaça&rdquo;. Passe o pincel pelo painel
            e descubra a cabeça de mulher que ele deixou inacabada.
          </p>
        </div>

        <div className={styles.side} data-fade="">
          {done ? (
            <>
              <p className={styles.caption}>
                <em>La Scapigliata</em>, c. 1506–1508. Terra de sombra e
                branco de chumbo sobre madeira. Galleria Nazionale, Parma.
              </p>
              <button type="button" className={styles.again} onClick={() => resetRef.current()}>
                Pintar de novo
              </button>
            </>
          ) : (
            <>
              <span className={styles.count}>
                <span ref={countRef}>00</span>
                <small>%</small>
              </span>
              <span className={styles.hint}>
                <span className={styles.hintLine} />
                <span className={styles.hintDesk}>Passe o mouse para pintar</span>
                <span className={styles.hintTouch}>Arraste para pintar</span>
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
