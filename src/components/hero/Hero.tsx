"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import ArtworkCanvas, { type ArtworkCanvasHandle } from "./ArtworkCanvas";
import GoldDust from "./GoldDust";
import HeroIntro from "./HeroIntro";
import styles from "./Hero.module.css";

// cada obra guarda uma porta — a passagem pro capítulo seguinte: o orbe
// no Salvator, o olho na Gioconda, a página do códice no retrato do
// mestre. Posição e raio são FRAÇÕES DA IMAGEM (não da tela): a
// conversão pra viewport acontece em getDoorOnScreen a cada uso, então a
// calibração sobrevive a resize e à troca de obra no meio da sessão.
const ARTWORKS = [
  {
    src: "/assets/davinci-cut.png",
    name: ["Il", "Maestro"],
    w: 1376,
    h: 768,
    door: { x: 0.708, y: 0.742, r: 0.086, zoom: 22 },
  },
  {
    src: "/assets/salvator-cut.png",
    name: ["Salvator", "Mundi"],
    w: 1024,
    h: 572,
    door: { x: 0.638, y: 0.857, r: 0.101, zoom: 18 },
  },
  {
    src: "/assets/gioconda-cut.png",
    name: ["La", "Gioconda"],
    w: 1376,
    h: 768,
    // o olho é uma porta minúscula — precisa de bem mais zoom pra janela
    // do portal cobrir a tela quando o mergulho termina
    door: { x: 0.451, y: 0.34, r: 0.024, zoom: 55 },
  },
];

type DoorOnScreen = {
  xPct: number;
  yPct: number;
  radiusVh: number;
  zoom: number;
};

// espelha em JS o "cover" centrado que o ArtworkCanvas faz no shader —
// os dois têm que concordar pixel a pixel pra porta ficar colada na obra
function getDoorOnScreen(artwork: (typeof ARTWORKS)[number]): DoorOnScreen {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / artwork.w, vh / artwork.h);
  const drawnW = artwork.w * scale;
  const drawnH = artwork.h * scale;
  const px = (vw - drawnW) / 2 + artwork.door.x * drawnW;
  const py = (vh - drawnH) / 2 + artwork.door.y * drawnH;
  return {
    xPct: (px / vw) * 100,
    yPct: (py / vh) * 100,
    radiusVh: ((artwork.door.r * drawnH) / vh) * 100,
    zoom: artwork.door.zoom,
  };
}

// a grade de estudo técnico do fundo — valores fixos (nada aleatório),
// pra render do servidor e do cliente baterem na hidratação
const GRID_V = [10, 26, 50, 74, 90];
const GRID_H = [14, 40, 66, 88];
const CROSSHAIRS: [number, number][] = [
  [26, 40],
  [74, 40],
  [50, 88],
];
const GRID_LABELS = [
  { text: "503, 3.215", left: "27%", top: "11%" },
  { text: "-183, 5.09", left: "75.5%", top: "11%" },
  { text: "520, 2.30", left: "75.5%", top: "62.5%" },
  { text: "-150, -1.30", left: "11%", top: "62.5%" },
];

export default function Hero() {
  const heroPinRef = useRef<HTMLElement>(null);
  const heroMediaRef = useRef<HTMLDivElement>(null);
  const goldDustRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const workTitleRef = useRef<HTMLDivElement>(null);
  const workDotsRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const portalFadeRef = useRef<HTMLDivElement>(null);
  const orbGlowRef = useRef<HTMLDivElement>(null);
  const portalRevealRef = useRef<HTMLDivElement>(null);
  const canvasHandleRef = useRef<ArtworkCanvasHandle>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const divingRef = useRef(false);

  // o halo da porta acompanha a obra ativa: posição e tamanho vêm da
  // mesma matemática de cover do mergulho
  const applyGlowPosition = useCallback((index: number) => {
    const glow = orbGlowRef.current;
    if (!glow) return;
    const door = getDoorOnScreen(ARTWORKS[index]);
    gsap.set(glow, {
      left: `${door.xPct}%`,
      top: `${door.yPct}%`,
      width: `${door.radiusVh * 3.2}vh`,
      height: `${door.radiusVh * 3.2}vh`,
    });
  }, []);

  const handleIndexChange = useCallback(
    (index: number) => {
      activeIndexRef.current = index;
      setActiveIndex(index);
      applyGlowPosition(index);
    },
    [applyGlowPosition],
  );

  // título grande da obra desliza a cada troca
  useEffect(() => {
    const title = workTitleRef.current;
    if (!title) return;
    const lines = title.querySelectorAll(`.${styles.workTitleLine}`);
    gsap.fromTo(
      lines,
      { yPercent: 60, autoAlpha: 0 },
      {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      },
    );
  }, [activeIndex]);

  useEffect(() => {
    applyGlowPosition(activeIndexRef.current);
    const onResize = () => applyGlowPosition(activeIndexRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyGlowPosition]);

  useIsomorphicLayoutEffect(() => {
    const heroPin = heroPinRef.current;
    const heroMedia = heroMediaRef.current;
    // pego via getElementById, não string de seletor: gsap.context() escopa
    // buscas por texto dentro de heroPinRef, e o nav é irmão dessa seção,
    // não descendente — como string ele nunca seria encontrado.
    const siteNav = document.getElementById("site-nav");
    const siteDeskNav = document.getElementById("site-desk-nav");
    if (!heroPin || !heroMedia) return;

    const ctx = gsap.context(() => {
      // o portal nasce invisível e desfocado: a janela (clip-path)
      // acompanha a porta desde o primeiro tick, mas a prévia da galeria
      // dentro dela só se MATERIALIZA no meio do mergulho
      gsap.set(portalRevealRef.current, {
        clipPath: "circle(0vh at 50% 50%)",
        opacity: 0,
        filter: "blur(14px)",
      });
      // p normalizado 0->1; o zoom real vem da porta ativa no onUpdate,
      // então cada obra mergulha até a profundidade da própria porta
      const progState = { p: 0 };

      gsap.set(orbGlowRef.current, {
        opacity: 0.5,
        scale: 0.92,
        transformOrigin: "50% 50%",
      });
      const orbGlowTween = gsap.to(orbGlowRef.current, {
        opacity: 1,
        scale: 1.08,
        duration: 1.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      // scrub timelines renderizam a posição 0 imediatamente ao montar —
      // mexer no glow ali dentro do próprio timeline apagava o pulso antes
      // do usuário sequer rolar. onUpdate só dispara com progresso real.
      let glowPulsePaused = false;
      const pauseGlowPulse = () => {
        if (glowPulsePaused) return;
        glowPulsePaused = true;
        orbGlowTween.pause();
      };
      const resumeGlowPulse = () => {
        if (!glowPulsePaused) return;
        glowPulsePaused = false;
        orbGlowTween.resume();
      };
      let glowKilled = false;
      const killOrbGlow = () => {
        if (glowKilled) return;
        glowKilled = true;
        orbGlowTween.kill();
        gsap.to(orbGlowRef.current, {
          opacity: 0,
          duration: 0.2,
          ease: "none",
        });
      };

      const mm = gsap.matchMedia();

      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          normal: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { reduced } = context.conditions as { reduced: boolean };

          if (reduced) {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: heroPin,
                  start: "top top",
                  end: "+=60%",
                  scrub: true,
                  pin: true,
                  onUpdate: (self) => {
                    if (self.progress > 0.001) killOrbGlow();
                  },
                },
              })
              .to(heroCopyRef.current, { autoAlpha: 0 }, 0)
              .to(workTitleRef.current, { autoAlpha: 0 }, 0)
              .to(workDotsRef.current, { autoAlpha: 0 }, 0)
              .to(hintRef.current, { autoAlpha: 0 }, 0)
              .to(scrollCueRef.current, { autoAlpha: 0 }, 0)
              .to(siteNav, { autoAlpha: 0 }, 0)
              .to(siteDeskNav, { autoAlpha: 0 }, 0)
              .to(portalFadeRef.current, { opacity: 1 }, 0.3);
            return;
          }

          gsap
            .timeline({
              scrollTrigger: {
                trigger: heroPin,
                start: "top top",
                end: "+=140%",
                scrub: true,
                pin: true,
                onUpdate: (self) => {
                  if (self.progress > 0.001) {
                    pauseGlowPulse();
                    divingRef.current = true;
                  } else {
                    resumeGlowPulse();
                    divingRef.current = false;
                  }
                },
              },
            })
            // ATO 1 (0 -> 0.3): a moldura esvazia antes do zoom violento
            .to(
              heroCopyRef.current,
              { autoAlpha: 0, y: -20, ease: "none", duration: 0.3 },
              0,
            )
            .to(
              workTitleRef.current,
              { autoAlpha: 0, y: -16, ease: "none", duration: 0.3 },
              0,
            )
            .to(
              workDotsRef.current,
              { autoAlpha: 0, ease: "none", duration: 0.3 },
              0,
            )
            .to(
              hintRef.current,
              { autoAlpha: 0, ease: "none", duration: 0.3 },
              0,
            )
            .to(
              scrollCueRef.current,
              { autoAlpha: 0, ease: "none", duration: 0.3 },
              0,
            )
            .to(siteNav, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            .to(siteDeskNav, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            .to(
              goldDustRef.current,
              { autoAlpha: 0, ease: "none", duration: 0.3 },
              0,
            )
            // o glow incandesce com o início do zoom (mora dentro de
            // heroMedia, cresce junto) e é engolido pelo mergulho
            .to(
              orbGlowRef.current,
              { opacity: 1, ease: "none", duration: 0.15 },
              0.15,
            )
            .to(
              orbGlowRef.current,
              { opacity: 0, ease: "none", duration: 0.2 },
              0.3,
            )
            // ATO 2 (0.15 -> 1): mergulho na porta da obra ATIVA — a
            // mesma porta dirige o scale, a origem e o raio da janela,
            // então a borda nunca desalinha do orbe/olho/códice
            .to(
              progState,
              {
                p: 1,
                ease: "power2.in",
                duration: 0.85,
                onUpdate: () => {
                  const door = getDoorOnScreen(
                    ARTWORKS[activeIndexRef.current],
                  );
                  const z = 1 + (door.zoom - 1) * progState.p;
                  gsap.set(heroMedia, {
                    scale: z,
                    transformOrigin: `${door.xPct}% ${door.yPct}%`,
                  });
                  const started = progState.p > 0.0001;
                  gsap.set(portalRevealRef.current, {
                    clipPath: started
                      ? `circle(${(door.radiusVh * z).toFixed(2)}vh at ${door.xPct.toFixed(2)}% ${door.yPct.toFixed(2)}%)`
                      : "circle(0vh at 50% 50%)",
                  });
                },
              },
              0.15,
            )
            // ATO 3 (0.35 -> 0.7): a galeria se materializa DENTRO da porta
            .to(
              portalRevealRef.current,
              { opacity: 1, filter: "blur(0px)", ease: "none", duration: 0.35 },
              0.35,
            )
            // ATO 4 (0.5 -> 1): a passagem pela cor do vidro — o véu
            // azul-acinzentado sobe no meio do mergulho e se dissolve
            // exatamente quando o pin solta, na entrada da galeria
            .to(
              portalFadeRef.current,
              { opacity: 0.55, ease: "none", duration: 0.2 },
              0.5,
            )
            .to(
              portalFadeRef.current,
              { opacity: 0, ease: "none", duration: 0.3 },
              0.7,
            );
        },
      );

      return () => mm.revert();
    }, heroPinRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.heroPin} id="hero" ref={heroPinRef}>
      <div className={styles.heroMedia} ref={heroMediaRef}>
        <div className={styles.heroBackdrop} />

        {/* grade de estudo técnico: linhas finas + miras + coordenadas,
            como numa prancheta de proporções do ateliê */}
        <svg
          className={styles.heroGrid}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {GRID_V.map((x) => (
            <line
              key={`v${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={100}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {GRID_H.map((y) => (
            <line
              key={`h${y}`}
              x1={0}
              y1={y}
              x2={100}
              y2={y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {CROSSHAIRS.map(([x, y]) => (
          <span
            key={`${x}-${y}`}
            className={styles.crosshair}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-hidden="true"
          />
        ))}
        {GRID_LABELS.map((label) => (
          <span
            key={label.text}
            className={styles.gridLabel}
            style={{ left: label.left, top: label.top }}
            aria-hidden="true"
          >
            {label.text}
          </span>
        ))}

        {/* estudos em traço branco nas margens, fundidos por screen
            (linhas brancas sobre preto — só o traço sobrevive) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.sketch} ${styles.sketchFlyer}`}
          src="/assets/sketch-flyer.jpg"
          alt=""
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.sketch} ${styles.sketchVitruvian}`}
          src="/assets/sketch-vitruvian.jpg"
          alt=""
        />

        <ArtworkCanvas
          ref={canvasHandleRef}
          sources={ARTWORKS.map((a) => a.src)}
          onIndexChange={handleIndexChange}
          disabledRef={divingRef}
        />
        <div className={styles.orbGlow} ref={orbGlowRef} role="presentation" />
      </div>

      {/* fora de heroMedia de propósito: vinheta pra legibilidade, não
          deve escalar junto no zoom do mergulho */}
      <div className={styles.heroScrim} />

      <div className={styles.goldDust} ref={goldDustRef} role="presentation">
        <GoldDust />
      </div>

      {/* janela do portal: clip-path circle crescendo sobre uma prévia
          estática da entrada do corredor da galeria — fica fora de
          heroMedia (não herda o scale) porque o próprio raio já é animado
          em sincronia. É só uma foto, não a cena 3D de verdade (essa vem
          depois que o pin solta): a GallerySection não precisa de uma
          animação de entrada escondida atrás do pin como a antiga
          BatismoSection precisava, porque sua própria câmera de repouso
          (progresso 0 do scroll) já É a vista de entrada do corredor —
          então não há costura pra esconder, só a troca foto -> WebGL */}
      <div
        className={styles.portalReveal}
        ref={portalRevealRef}
        role="presentation"
      >
        <div className={styles.portalRevealMedia}>
          <Image
            src="/assets/salvator-mundi.jpg"
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "50% 30%" }}
          />
        </div>
        <div className={styles.portalRevealCopy}>
          <span className={styles.portalRevealEyebrow}>A coleção</span>
          <h2>Entre na galeria das obras</h2>
        </div>
      </div>

      <div className={styles.portalFade} ref={portalFadeRef} />

      {/* a marca do site vira o título monumental do hero — mesma coluna
          esquerda onde a lista persistente do Nav (site-desk-nav) continua
          depois que este bloco some no mergulho de scroll */}
      <div className={styles.heroCopy} ref={heroCopyRef}>
        <span className={styles.eyebrow}>
          Uma experiência imersiva pela obra de Leonardo da Vinci
        </span>
        <h1>
          <span>Da Vinci</span>
          <span>Immersive</span>
        </h1>
      </div>

      <div className={styles.workTitle} ref={workTitleRef}>
        <span className={styles.workCount}>
          obra {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(ARTWORKS.length).padStart(2, "0")}
        </span>
        <h2>
          {ARTWORKS[activeIndex].name.map((line) => (
            <span key={line} className={styles.workTitleLine}>
              {line}
            </span>
          ))}
        </h2>
      </div>

      <div className={styles.workDots} ref={workDotsRef}>
        {ARTWORKS.map((artwork, i) => (
          <button
            key={artwork.src}
            type="button"
            aria-label={`Ver ${artwork.name.join(" ")}`}
            className={
              i === activeIndex ? styles.workDotActive : styles.workDot
            }
            onClick={() => canvasHandleRef.current?.goTo(i)}
          />
        ))}
      </div>

      <div className={styles.scrollCue} ref={scrollCueRef}>
        <span>role para explorar</span>
        <span className={styles.line} />
      </div>

      {/* por último no DOM (fica por cima de tudo no hero): o vídeo de
          abertura — pergaminho virando pintura — que desvanece pro hero
          interativo já montado por baixo */}
      <HeroIntro />
    </section>
  );
}
