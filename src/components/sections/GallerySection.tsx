"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";

// TESTE com só 2 obras — a ideia é sentir o ritmo do scroll antes de
// gerar as outras 2. `bg` é a instalação de museu inteira já pronta
// (parede + quadro + pedestal, gerada por IA, sem 3D nenhum aqui
// dentro); `thumb` é o recorte só da obra, usado na grade estática do
// fallback reduced-motion. `anchor` é onde a placa de legenda ancora,
// em % da tela — calibrado a olho olhando pra cada imagem; ajusta
// depois que as reais estiverem prontas.
const GALLERY_WORKS = [
  {
    bg: "/assets/gallery-bg-salvator.jpg",
    thumb: "/assets/salvator-mundi.jpg",
    name: "Salvator Mundi",
    year: "c. 1500",
    artist: "Leonardo da Vinci (atribuído)",
    medium: "Óleo sobre painel de nogueira",
    desc: "Cristo Salvador do Mundo: a mão direita em bênção, a esquerda segura um orbe de cristal — o mundo refletido em miniatura.",
    anchor: { x: 17, y: 42 },
  },
  {
    bg: "/assets/gallery-bg-gioconda.jpg",
    thumb: "/assets/gioconda_only.jpeg",
    name: "La Gioconda",
    year: "1503 – 1519",
    artist: "Leonardo da Vinci",
    medium: "Óleo sobre álamo",
    desc: "O retrato mais estudado da história da arte. O sfumato dissolve os contornos e deixa o sorriso em aberto.",
    anchor: { x: 52, y: 36 },
  },
];

// quanto cada instalação "aproxima" (Ken Burns) enquanto está em cena —
// calmo (ZOOM_FROM) bem no auge, mais zoom quanto mais longe do auge
// (crossfade fica mais "vivo" que o repouso)
const ZOOM_FROM = 1.0;
const ZOOM_TO = 1.14;
// deslocamento lateral no mesmo ritmo do zoom, com sinal alternado por
// obra — é o zig-zag que substitui a curva em S de verdade
const PAN_VW = 3.2;
// fração de cada trecho (entre um pico e o próximo) que fica PARADA,
// nítida, antes/depois do crossfade — sem isso é troca contínua o
// tempo todo, sem nunca "chegar e ver" de verdade
const HOLD_FRAC = 0.32;
// metade da janela (em progresso 0-1) onde a legenda de cada obra fica
// acesa, centrada no auge dela
const CAPTION_HALF_WINDOW = 0.22;
// quanto scroll (em % de viewport) cada trecho entre duas obras consome
const VH_PER_SEGMENT = 160;

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

// avanço 0->1 dentro de um trecho entre dois picos, com um patamar
// parado nas pontas (HOLD_FRAC de cada lado) e crossfade suave só no meio
function segmentEase(u: number) {
  if (u <= HOLD_FRAC) return 0;
  if (u >= 1 - HOLD_FRAC) return 1;
  const span = 1 - 2 * HOLD_FRAC;
  return smoothstep((u - HOLD_FRAC) / span);
}

export default function GallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const section = sectionRef.current;
    const siteNav = document.getElementById("site-nav");
    const siteDeskNav = document.getElementById("site-desk-nav");
    if (!section) return;

    const N = GALLERY_WORKS.length;
    // picos igualmente espaçados 0..1, um por obra — o "auge" de cada
    // instalação, igual ao conceito de peaks da versão 3D, só que agora
    // driblando opacidade/escala em vez de câmera
    const peaks = N > 1 ? GALLERY_WORKS.map((_, i) => i / (N - 1)) : [0];
    const gap = N > 1 ? peaks[1] - peaks[0] : 1;
    const zoomRange = gap * 0.85;

    // presença (0-1) da obra i num progresso p: sobe do vizinho da
    // esquerda até o próprio pico, desce até o vizinho da direita — só
    // olha pro vizinho relevante, sem contar duas vezes o mesmo trecho
    function presenceOf(i: number, p: number) {
      if (p < peaks[i]) {
        if (i === 0) return 1;
        const u = (p - peaks[i - 1]) / (peaks[i] - peaks[i - 1]);
        return segmentEase(gsap.utils.clamp(0, 1, u));
      }
      if (i === N - 1) return 1;
      const u = (p - peaks[i]) / (peaks[i + 1] - peaks[i]);
      return 1 - segmentEase(gsap.utils.clamp(0, 1, u));
    }

    let navRevealed = false;
    const revealNav = () => {
      if (navRevealed) return;
      navRevealed = true;
      gsap.to([siteNav, siteDeskNav], { autoAlpha: 1, duration: 0.5, ease: "none" });
    };

    function updateFrame(progress: number) {
      const p = gsap.utils.clamp(0, 1, progress);

      slideRefs.current.forEach((el, i) => {
        if (!el) return;
        const dist = p - peaks[i];
        const t = gsap.utils.clamp(-1, 1, dist / zoomRange);
        const scale = ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * Math.abs(t);
        const side = i % 2 === 0 ? 1 : -1;
        const panVw = PAN_VW * t * side;
        el.style.opacity = String(presenceOf(i, p));
        el.style.transform = `scale(${scale}) translateX(${panVw}vw)`;
      });

      captionRefs.current.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(p - peaks[i]);
        const o = Math.max(0, 1 - dist / CAPTION_HALF_WINDOW);
        el.style.opacity = String(o);
      });

      // só reaparece perto do fim da caminhada — o menu por cima da
      // galeria tirava a imersão pedida
      if (p > 0.94) revealNav();
    }
    updateFrame(0);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: `+=${Math.max(1, N - 1) * VH_PER_SEGMENT}%`,
      scrub: true,
      pin: true,
      onUpdate: (self) => updateFrame(self.progress),
    });

    return () => {
      trigger.kill();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <section className={styles.galleryFallback} id="galeria">
        <span className={styles.fallbackEyebrow}>A coleção</span>
        <h2>As obras da jornada</h2>
        <div className={styles.fallbackGrid}>
          {GALLERY_WORKS.map((work) => (
            <figure key={work.bg} className={styles.fallbackItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={work.thumb} alt={work.name} />
              <figcaption>
                <strong>{work.name}</strong>
                <span>{work.year}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.galleryPin} id="galeria" ref={sectionRef}>
      <div className={styles.galleryStage}>
        {GALLERY_WORKS.map((work, i) => (
          <div
            key={work.bg}
            className={styles.slide}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={work.bg} alt={work.name} className={styles.slideImg} />
          </div>
        ))}
      </div>
      <div className={styles.galleryScrim} />
      {GALLERY_WORKS.map((work, i) => (
        <div
          key={work.bg}
          className={styles.caption}
          style={{ left: `${work.anchor.x}%`, top: `${work.anchor.y}%` }}
          ref={(el) => {
            captionRefs.current[i] = el;
          }}
        >
          <span className={styles.captionEyebrow}>{work.year}</span>
          <h2>{work.name}</h2>
          <div className={styles.captionMeta}>
            <span>{work.artist}</span>
            <span>{work.medium}</span>
          </div>
          <p className={styles.captionDesc}>{work.desc}</p>
        </div>
      ))}
    </section>
  );
}
