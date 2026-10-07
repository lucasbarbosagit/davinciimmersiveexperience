"use client";

import { useRef } from "react";
import { useLenis } from "lenis/react";
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

// abertura da galeria: a imagem do saguão (a MESMA que o Hero dissolve no
// fim do mergulho, ver Hero.tsx) e o vídeo do corredor formam uma faixa
// vertical contínua — saguão em cima, corredor embaixo, com o pé do
// saguão (guarda-corpos canelados, chão escuro) emendando direto no topo
// do corredor (paredes canteladas). A abertura é só rolar essa faixa
// 100vh pra cima, 1:1 com o scroll, como rolagem normal de página.
const LOBBY_SRC = "/assets/gallery-corridor-frame1.jfif";
const INTRO_VH = 100;
// proporções das duas mídias: o vídeo é ampliado (fitScale, ver abaixo)
// pra ficar da mesma largura que o saguão na tela, senão os guarda-corpos
// de um não alinham com as paredes do outro na emenda
const LOBBY_ASPECT = 1441 / 720;
const VIDEO_ASPECT = 16 / 9;
// o ajuste de escala do vídeo relaxa pra 1 nesse trecho inicial do vídeo
const FIT_RELAX_P = 0.25;

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
  const stripRef = useRef<HTMLDivElement>(null);
  const videoInnerRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useIsomorphicLayoutEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // espelho do auto-snap do Hero (onLeave lá): entre o fim do pin do Hero
  // e o início do pin desta seção sobra um vão de scroll onde o saguão do
  // fim do mergulho sobe e este mesmo saguão entra por baixo. Na ida o
  // Hero pula o vão; na volta apareciam as duas imagens iguais
  // empilhadas. Rolando PRA CIMA dentro do vão, salta pro fim do pin do
  // Hero (mergulho completo = a mesma imagem em tela cheia, invisível).
  // Não dá pra usar onLeaveBack do trigger: o snap da ida pousa exatamente
  // no início do pin e isso também conta como "sair pra trás".
  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion || !lenis) return;
    const findPin = (id: string) =>
      ScrollTrigger.getAll().find(
        (st) =>
          st.vars.pin &&
          (st.vars.trigger as HTMLElement | undefined)?.id === id,
      );
    const onScroll = () => {
      if (lenis.direction !== -1) return;
      const gallery = findPin("galeria");
      const hero = findPin("hero");
      if (!gallery || !hero) return;
      const y = lenis.scroll;
      if (y < gallery.start - 2 && y > hero.end + 2) {
        lenis.scrollTo(hero.end, { immediate: true });
      }
    };
    return lenis.on("scroll", onScroll);
  }, [lenis, prefersReducedMotion]);

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

    const strip = stripRef.current;
    const videoInner = videoInnerRef.current;
    const scrim = scrimRef.current;
    const seam = seamRef.current;
    const videoVh = (GALLERY_WORKS.length - 1) * VH_PER_SEGMENT;
    const totalVh = INTRO_VH + videoVh;
    const introFrac = INTRO_VH / totalVh;

    let fitScale = 1;
    const measure = () => {
      const vw = section.clientWidth;
      const vh = section.clientHeight;
      fitScale =
        Math.max(vw, vh * LOBBY_ASPECT) / Math.max(vw, vh * VIDEO_ASPECT);
    };
    measure();

    function updateFrame(progress: number) {
      const overall = gsap.utils.clamp(0, 1, progress);
      // q: 0->1 durante a abertura (faixa rolando); p: 0->1 durante o
      // vídeo. Cada fase só anda na sua própria fatia do scroll
      const q = Math.min(1, overall / introFrac);
      const p = Math.max(0, (overall - introFrac) / (1 - introFrac));

      // a faixa tem 200% da altura da tela; -50% dela = exatamente 1 tela
      if (strip) strip.style.transform = `translate3d(0, ${-q * 50}%, 0)`;
      if (videoInner) {
        const relax = 1 - gsap.utils.clamp(0, 1, p / FIT_RELAX_P);
        videoInner.style.transform = `scale(${1 + (fitScale - 1) * relax})`;
      }
      // o degradê da emenda só existe enquanto a junção está na tela
      if (seam) seam.style.opacity = String(1 - gsap.utils.clamp(0, 1, (q - 0.8) / 0.2));
      // a vinheta só entra quando o corredor já cobre a tela: em q=0 a
      // tela tem que ser pixel a pixel a foto que o Hero deixou
      if (scrim) scrim.style.opacity = String(gsap.utils.clamp(0, 1, (q - 0.6) / 0.4));

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
        // só depois que o vídeo começa: durante a abertura a tela é do saguão
        const videoStarted = gsap.utils.clamp(0, 1, (overall - introFrac) / 0.03);
        el.style.opacity = String(captionOpacity(work.hold, p) * videoStarted);
      });

      if (overall > 0.96) revealNav();
    }
    updateFrame(0);

    const onResize = () => {
      measure();
      updateFrame(trigger.progress);
    };
    window.addEventListener("resize", onResize);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: `+=${totalVh}%`,
      scrub: true,
      pin: true,
      onUpdate: (self) => updateFrame(self.progress),
    });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      window.removeEventListener("resize", onResize);
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
        <div className={styles.strip} ref={stripRef}>
          <div className={styles.panel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.lobbyImg} src={LOBBY_SRC} alt="" />
          </div>
          <div className={styles.panel}>
            <div className={styles.videoInner} ref={videoInnerRef}>
              <video
                ref={videoRef}
                className={styles.slideImg}
                src={FLYTHROUGH_SRC}
                muted
                playsInline
                preload="auto"
              />
            </div>
            <div className={styles.seamFade} ref={seamRef} />
          </div>
        </div>
      </div>
      <div className={styles.galleryScrim} ref={scrimRef} />
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
