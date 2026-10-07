"use client";

import { useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";
import timing from "./gallery-timing.json";

// a galeria inteira é UM vídeo só, renderizado em Blender com uma câmera
// real (ver blender/full_gallery.py): abre parada no saguão — o MESMO
// frame em que o Hero dissolve no fim do mergulho —, desce a passarela,
// atravessa a porta pro corredor, para diante de cada obra e sai por um
// último trecho sem luz, afundando no escuro. O scroll só controla o
// `currentTime`, igual à técnica de scroll-scrub da referência
// (austinwerner.io). Não existe emenda entre saguão e corredor pra
// esconder: é o mesmo espaço 3D, a mesma câmera.
const FLYTHROUGH_SRC = "/assets/gallery-flythrough.mp4";
// frame 1 do render, exportado: é o poster do vídeo (tela nunca fica
// vazia enquanto ele carrega) e a imagem final do mergulho do Hero
const LOBBY_POSTER = "/assets/gallery-lobby.jpg";

// as janelas de parada de cada obra e os marcos da câmera (fim do
// respiro no saguão, entrada na saída) saem do próprio script do
// Blender, que grava esse JSON junto do render
const {
  fps: FPS,
  frames: TOTAL_FRAMES,
  lobbyHoldEnd: LOBBY_HOLD_END,
  exitFrame: EXIT_FRAME,
} = timing;
const STOPS = timing.stops.map(([start, end]) => [start, end] as [number, number]);

const GALLERY_WORKS = [
  {
    thumb: "/assets/salvator-mundi.jpg",
    name: "Salvator Mundi",
    year: "c. 1500",
    artist: "Leonardo da Vinci (atribuído)",
    medium: "Óleo sobre painel de nogueira",
    desc: "Cristo Salvador do Mundo: a mão direita em bênção, a esquerda segura um orbe de cristal — o mundo refletido em miniatura.",
    hold: STOPS[0],
  },
  {
    thumb: "/assets/gioconda_only.jpeg",
    name: "La Gioconda",
    year: "1503 – 1519",
    artist: "Leonardo da Vinci",
    medium: "Óleo sobre álamo",
    desc: "O retrato mais estudado da história da arte. O sfumato dissolve os contornos e deixa o sorriso em aberto.",
    hold: STOPS[1],
  },
];

// ritmo do scrub: quanto de scroll (em % da altura da tela) cada frame
// do vídeo consome — o mesmo passo da v1 do corredor, que já estava bom
const VH_PER_FRAME = 1.15;
// respiro no frame 1 antes do vídeo andar: é aqui que o título entra.
// O Hero solta o pin exatamente neste frame, então a primeira coisa que
// o scroll faz na galeria é "chegar" (título), não "andar"
const DWELL_VH = 45;
// fade da legenda nas bordas da janela de hold, em frames
const CAPTION_FADE_F = 5;

function captionOpacity(hold: [number, number], f: number) {
  const [start, end] = hold;
  if (f < start - CAPTION_FADE_F || f > end + CAPTION_FADE_F) return 0;
  if (f < start) return (f - (start - CAPTION_FADE_F)) / CAPTION_FADE_F;
  if (f > end) return 1 - (f - end) / CAPTION_FADE_F;
  return 1;
}

// 0 -> 1 linear entre a e b, preso nas pontas
const ramp = (a: number, b: number, x: number) =>
  Math.min(1, Math.max(0, (x - a) / (b - a)));

export default function GallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
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
  // fim do mergulho sobe e o frame 1 deste vídeo (a mesma imagem) entra
  // por baixo. Na ida o
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

    const title = titleRef.current;
    const ink = inkRef.current;
    const scrim = scrimRef.current;
    const framesVh = (TOTAL_FRAMES - 1) * VH_PER_FRAME;
    const totalVh = DWELL_VH + framesVh;
    const dwellFrac = DWELL_VH / totalVh;

    function updateFrame(progress: number) {
      const overall = gsap.utils.clamp(0, 1, progress);
      const dwell = Math.min(1, overall / dwellFrac);
      // frame contínuo (1..TOTAL_FRAMES) — a unidade de tudo aqui embaixo,
      // a mesma do Blender, pra nada precisar de conversão de cabeça
      const f =
        1 +
        Math.max(0, (overall - dwellFrac) / (1 - dwellFrac)) *
          (TOTAL_FRAMES - 1);

      if (duration > 0) {
        // meio-frame de folga: cair exatamente na borda entre dois frames
        // faz alguns decoders alternarem entre eles no scrub lento
        const target = Math.min((f - 0.5) / FPS, duration - 0.001);
        // seeks demais no mesmo instante travam o decode em alguns
        // browsers — só reposiciona se o alvo realmente mudou
        if (Math.abs(target - lastSetTime) > 1 / 60) {
          video!.currentTime = target;
          lastSetTime = target;
        }
      }

      if (title) {
        // entra no respiro (a "chegada"), sai quando a câmera começa a
        // andar: cresce e sobe junto com a parede, que se aproxima e sobe
        // no quadro porque a câmera desce a passarela
        const out = ramp(LOBBY_HOLD_END, LOBBY_HOLD_END + 40, f);
        title.style.opacity = String(ramp(0.05, 0.75, dwell) * (1 - out));
        title.style.transform = `translate3d(-50%, ${-50 - out * 45}%, 0) scale(${1 + out * 0.3})`;
        title.style.letterSpacing = `${(1 - ramp(0.05, 0.9, dwell)) * 0.08}em`;
      }

      // a vinheta só entra quando a câmera anda: no frame 1 a tela tem que
      // ser pixel a pixel a imagem em que o mergulho do Hero terminou
      if (scrim) scrim.style.opacity = String(ramp(LOBBY_HOLD_END, LOBBY_HOLD_END + 30, f));

      GALLERY_WORKS.forEach((work, i) => {
        const el = captionRefs.current[i];
        if (el) el.style.opacity = String(captionOpacity(work.hold, f));
      });

      // o render termina quase preto, mas não no tom exato do fundo da
      // seção seguinte — completa até --ink, e o pin solta numa tela que
      // já é a cor da página: a próxima seção sobe de dentro do escuro
      if (ink) ink.style.opacity = String(ramp(EXIT_FRAME + 10, TOTAL_FRAMES - 4, f));

      if (f > EXIT_FRAME) revealNav();
    }
    updateFrame(0);

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
          poster={LOBBY_POSTER}
          muted
          playsInline
          preload="auto"
        />
      </div>
      <div className={styles.galleryScrim} ref={scrimRef} />
      {/* mesma caixa do vídeo em object-fit: cover — o título fica preso
          no vão de parede entre os painéis e a porta do saguão em
          qualquer proporção de tela, não num % da viewport */}
      <div className={styles.coverBox}>
        <div className={styles.lobbyTitle} ref={titleRef}>
          <h2>Inside the mind of the master</h2>
          <p>Welcome to the Da Vinci&rsquo;s gallery</p>
        </div>
      </div>
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
      <div className={styles.inkFade} ref={inkRef} />
    </section>
  );
}
