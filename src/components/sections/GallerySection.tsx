"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";

// o corredor inteiro é UM vídeo só, renderizado em Blender com uma
// câmera real percorrendo o espaço em ziguezague — cada obra fica numa
// parede de FUNDO, de frente pra câmera que chega (ver
// blender/full_gallery.py). O scroll só controla o `currentTime` desse
// vídeo, igual à técnica de scroll-scrub da referência (austinwerner.io).
// TESTE com só 2 obras de propósito — validar o ritmo do ziguezague
// antes de renderizar o corredor completo (ver conversa: já foi tentado
// com corredor reto + quadros na parede LATERAL, ficava tudo de esguelha).
const FLYTHROUGH_SRC = "/assets/gallery-flythrough.mp4";

// janelas de "parada" (em progresso 0-1) onde a câmera fica parada em
// frente a cada obra — espelham EXATAMENTE os frames de hold calculados
// no script do Blender (FPS=24, HOLD_F=43, TRANS_F=53, total=140 frames),
// convertidos pra fração: stop N ocupa [holdStart/140, holdEnd/140]
const GALLERY_WORKS = [
  {
    thumb: "/assets/salvator-mundi.jpg",
    name: "Salvator Mundi",
    year: "c. 1500",
    artist: "Leonardo da Vinci (atribuído)",
    medium: "Óleo sobre painel de nogueira",
    desc: "Cristo Salvador do Mundo: a mão direita em bênção, a esquerda segura um orbe de cristal — o mundo refletido em miniatura.",
    hold: [1 / 140, 44 / 140] as [number, number],
  },
  {
    thumb: "/assets/gioconda_only.jpeg",
    name: "La Gioconda",
    year: "1503 – 1519",
    artist: "Leonardo da Vinci",
    medium: "Óleo sobre álamo",
    desc: "O retrato mais estudado da história da arte. O sfumato dissolve os contornos e deixa o sorriso em aberto.",
    hold: [97 / 140, 140 / 140] as [number, number],
  },
];

const VH_PER_SEGMENT = 160;
// fade da legenda nas bordas da janela de hold, em fração de progresso
const CAPTION_FADE = 0.035;

function captionOpacity(hold: [number, number], p: number) {
  const [start, end] = hold;
  if (p < start - CAPTION_FADE || p > end + CAPTION_FADE) return 0;
  if (p < start) return (p - (start - CAPTION_FADE)) / CAPTION_FADE;
  if (p > end) return 1 - (p - end) / CAPTION_FADE;
  return 1;
}

export default function GallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const section = sectionRef.current;
    const video = videoRef.current;
    const siteNav = document.getElementById("site-nav");
    const siteDeskNav = document.getElementById("site-desk-nav");
    if (!section || !video) return;

    let duration = 0;
    let lastSetTime = -1;

    const onLoadedMetadata = () => {
      duration = video.duration || 0;
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    if (video.readyState >= 1) onLoadedMetadata();

    let navRevealed = false;
    const revealNav = () => {
      if (navRevealed) return;
      navRevealed = true;
      gsap.to([siteNav, siteDeskNav], { autoAlpha: 1, duration: 0.5, ease: "none" });
    };

    function updateFrame(progress: number) {
      const p = gsap.utils.clamp(0, 1, progress);

      if (duration > 0) {
        const target = p * duration;
        // seeks demais no mesmo instante travam o decode em alguns
        // browsers — só reposiciona se o alvo realmente mudou
        if (Math.abs(target - lastSetTime) > 1 / 60) {
          video!.currentTime = Math.min(target, duration - 0.001);
          lastSetTime = target;
        }
      }

      GALLERY_WORKS.forEach((work, i) => {
        const el = captionRefs.current[i];
        if (!el) return;
        el.style.opacity = String(captionOpacity(work.hold, p));
      });

      if (p > 0.96) revealNav();
    }
    updateFrame(0);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: `+=${(GALLERY_WORKS.length - 1) * VH_PER_SEGMENT}%`,
      scrub: true,
      pin: true,
      onUpdate: (self) => updateFrame(self.progress),
    });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
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
            <figure key={work.name} className={styles.fallbackItem}>
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
        <video
          ref={videoRef}
          className={styles.slideImg}
          src={FLYTHROUGH_SRC}
          muted
          playsInline
          preload="auto"
        />
      </div>
      <div className={styles.galleryScrim} />
      {GALLERY_WORKS.map((work, i) => (
        <div
          key={work.name}
          className={styles.caption}
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
