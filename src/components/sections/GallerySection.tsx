"use client";

import { useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";
import timing from "./gallery-timing.json";
import SplitChars from "@/components/ui/SplitChars";
import { onSiteReady } from "@/lib/siteReady";

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
// a saída (da entrada no trecho escuro até o último frame) ocupa
// exatamente uma tela de scroll: é nesse trecho que a seção do voador
// sobe por cima (ela tem margin-top: -100vh), já se desenhando no escuro
// — sem uma tela preta "vazia" entre as duas
const TAIL_VH = 100;
// folga (em frames) em volta da janela de parada: a legenda começa a
// entrar um pouco antes da câmera parar, como quem já vê a obra chegando
const CAPTION_LEAD_F = 3;

// quanto a câmera "entra" no saguão durante a chegada (zoom no vídeo)
const PUSH_SCALE = 0.09;

// 0 -> 1 linear entre a e b, preso nas pontas
const ramp = (a: number, b: number, x: number) =>
  Math.min(1, Math.max(0, (x - a) / (b - a)));
const smoothstep = (x: number) => x * x * (3 - 2 * x);

export default function GallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const coverBoxRef = useRef<HTMLDivElement>(null);
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
    // os 15MB do voo só começam a baixar depois do loading: até lá a banda
    // é do intro. O poster cobre a tela enquanto isso
    const offReady = onSiteReady(() => {
      video.preload = "auto";
      video.load();
    });

    let navRevealed = false;
    const revealNav = () => {
      if (navRevealed) return;
      navRevealed = true;
      gsap.to([siteNav, siteDeskNav], { autoAlpha: 1, duration: 0.5, ease: "none" });
    };

    const title = titleRef.current;
    const titleChars = title ? Array.from(title.querySelectorAll<HTMLElement>("[data-char]")) : [];
    const titleSub = title?.querySelector<HTMLElement>("p") ?? null;
    const ink = inkRef.current;
    const coverBox = coverBoxRef.current;

    // legendas: cada uma é uma timeline própria, TOCADA (não arrastada
    // pelo scroll) quando a câmera chega na obra e revertida quando sai —
    // a entrada tem tempo de respirar mesmo com scroll rápido, que é o
    // que dá o acabamento dos sites de referência
    const captionTls = captionRefs.current.map((el) => {
      if (!el) return null;
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(
        el.querySelectorAll("[data-char]"),
        { yPercent: 115 },
        { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.028 },
        0,
      )
        .fromTo(
          el.querySelector("[data-rule]"),
          { scaleX: 0 },
          { scaleX: 1, duration: 1, ease: "expo.out" },
          0.1,
        )
        .fromTo(
          el.querySelectorAll("[data-fade]"),
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.09 },
          0.3,
        );
      return tl;
    });
    const captionOn = GALLERY_WORKS.map(() => false);
    const scrim = scrimRef.current;
    const mainVh = (EXIT_FRAME - 1) * VH_PER_FRAME;
    const tailPerFrame = TAIL_VH / (TOTAL_FRAMES - EXIT_FRAME);
    const totalVh = DWELL_VH + mainVh + TAIL_VH;
    // scroll (em vh desde o início do pin) -> frame contínuo 1..TOTAL
    const frameAt = (vh: number) => {
      const w = vh - DWELL_VH;
      if (w <= 0) return 1;
      if (w <= mainVh) return 1 + w / VH_PER_FRAME;
      return Math.min(TOTAL_FRAMES, EXIT_FRAME + (w - mainVh) / tailPerFrame);
    };

    function updateFrame(progress: number) {
      const vh = gsap.utils.clamp(0, 1, progress) * totalVh;
      const dwell = Math.min(1, vh / DWELL_VH);
      // frame contínuo (1..TOTAL_FRAMES) — a unidade de tudo aqui embaixo,
      // a mesma do Blender, pra nada precisar de conversão de cabeça
      const f = frameAt(vh);

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

      // a chegada não é parada: enquanto o título entra, a câmera já vai
      // entrando no saguão (zoom lento, até ~9%), e devolve o enquadramento
      // do render aos poucos depois que o vídeo começa a andar. Começa em
      // 1 exato: o frame 1 tem que bater com o fim do mergulho do Hero
      const push =
        smoothstep(ramp(0, DWELL_VH + (LOBBY_HOLD_END - 1) * VH_PER_FRAME, vh)) *
        (1 - smoothstep(ramp(LOBBY_HOLD_END, LOBBY_HOLD_END + 70, f)));
      const s = 1 + push * PUSH_SCALE;
      video!.style.transform = push > 0.0005 ? `scale(${s})` : "";
      if (coverBox) coverBox.style.transform = `translate(-50%, -50%) scale(${s})`;

      if (title) {
        // entra no respiro (a "chegada"), sai quando a câmera começa a
        // andar: cresce e sobe junto com a parede, que se aproxima e sobe
        // no quadro porque a câmera desce a passarela
        const out = ramp(LOBBY_HOLD_END, LOBBY_HOLD_END + 40, f);
        title.style.opacity = String(1 - out);
        title.style.transform = `translate3d(-50%, ${-50 - out * 45}%, 0) scale(${1 + out * 0.3})`;
        // a chegada: as letras sobem uma a uma conforme o respiro anda
        // (arrastado pelo scroll, aqui sim — é o próprio gesto de chegar)
        const n = titleChars.length;
        const arrive = ramp(0.02, 0.8, dwell);
        titleChars.forEach((ch, i) => {
          const start = (i / n) * 0.55;
          ch.style.transform = `translate3d(0, ${(1 - ramp(start, start + 0.45, arrive)) * 115}%, 0)`;
        });
        if (titleSub) titleSub.style.opacity = String(ramp(0.55, 0.95, dwell));
      }

      // a vinheta só entra quando a câmera anda: no frame 1 a tela tem que
      // ser pixel a pixel a imagem em que o mergulho do Hero terminou
      if (scrim) scrim.style.opacity = String(ramp(LOBBY_HOLD_END, LOBBY_HOLD_END + 30, f));

      GALLERY_WORKS.forEach((work, i) => {
        const tl = captionTls[i];
        if (!tl) return;
        const on = f >= work.hold[0] - CAPTION_LEAD_F && f <= work.hold[1] + CAPTION_LEAD_F;
        if (on === captionOn[i]) return;
        captionOn[i] = on;
        // saída mais rápida que a entrada: a câmera já está indo embora
        if (on) {
          // scroll rápido entre duas obras: a legenda anterior ainda
          // estaria saindo e as duas se sobreporiam — termina a saída dela
          // na hora
          captionTls.forEach((other, j) => {
            if (j !== i && other && !captionOn[j]) other.progress(0).pause();
          });
          tl.timeScale(1).play();
        } else tl.timeScale(1.8).reverse();
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

    // o mergulho do Hero esconde o nav com um tween arrastado pelo scroll,
    // e todo refresh do ScrollTrigger (resize, layout mudando) re-renderiza
    // esse tween — escondendo o nav de novo mesmo com o scroll já depois
    // da galeria, e o revealNav acima só roda uma vez. Depois de cada
    // refresh, se o scroll já passou da saída, o nav volta
    const onRefresh = () => {
      const exitProgress = (DWELL_VH + mainVh) / totalVh;
      if (trigger.progress >= exitProgress) {
        gsap.set([siteNav, siteDeskNav], { autoAlpha: 1 });
        navRevealed = true;
      }
    };
    ScrollTrigger.addEventListener("refresh", onRefresh);

    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      offReady();
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      trigger.kill();
      captionTls.forEach((tl) => tl?.kill());
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
          preload="metadata"
        />
      </div>
      <div className={styles.galleryScrim} ref={scrimRef} />
      {/* mesma caixa do vídeo em object-fit: cover — o título fica preso
          no vão de parede entre os painéis e a porta do saguão em
          qualquer proporção de tela, não num % da viewport */}
      <div className={styles.coverBox} ref={coverBoxRef}>
        <div className={styles.lobbyTitle} ref={titleRef}>
          <h2 aria-label="Tudo começa num traço">
            <SplitChars text="Tudo começa" />{" "}
            <em>
              <SplitChars text="num traço" />
            </em>
          </h2>
          <p>Bem-vindo à Galleria dell&rsquo;Eterno</p>
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
          <div className={styles.captionIndex} data-fade="">
            <span>
              {String(i + 1).padStart(2, "0")}
              <span className={styles.captionTotal}>
                {" "}/ {String(GALLERY_WORKS.length).padStart(2, "0")}
              </span>
            </span>
            <span className={styles.captionRule} data-rule="" />
            <span>{work.year}</span>
          </div>
          <h2 className={styles.captionTitle} aria-label={work.name}>
            <SplitChars text={work.name} />
          </h2>
          <p className={styles.captionMeta} data-fade="">
            {work.artist} · {work.medium}
          </p>
          <p className={styles.captionDesc} data-fade="">
            {work.desc}
          </p>
        </div>
      ))}
      <div className={styles.inkFade} ref={inkRef} />
    </section>
  );
}
