"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import InkRevealCanvas from "./InkRevealCanvas";
import GoldDust from "./GoldDust";
import HeroIntro from "./HeroIntro";
import styles from "./Hero.module.css";

export default function Hero() {
  const heroPinRef = useRef<HTMLElement>(null);
  const heroMediaRef = useRef<HTMLDivElement>(null);
  const goldDustRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const portalFadeRef = useRef<HTMLDivElement>(null);
  const orbGlowRef = useRef<HTMLDivElement>(null);
  const portalRevealRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const heroPin = heroPinRef.current;
    const heroMedia = heroMediaRef.current;
    // pego via getElementById, não string de seletor: gsap.context() escopa
    // buscas por texto dentro de heroPinRef, e o nav é irmão dessa seção,
    // não descendente — como string ele nunca seria encontrado.
    const siteNav = document.getElementById("site-nav");
    if (!heroPin || !heroMedia) return;

    const ctx = gsap.context(() => {
      // zoom da câmera até o orb — mesmo centro medido em px que calibrou
      // o portal (925,800 de 1440x900 → 64.24%/88.89%), raio real 95px
      // (10.555vh a 900px de altura, ou seja 21.11vh de diâmetro)
      gsap.set(heroMedia, { transformOrigin: "64.24% 88.89%" });

      // o portal não finge uma imagem própria: ele é uma janela (clip-path
      // circle) que cresce sobre o quadro JÁ RESOLVIDO da BatismoSection —
      // mesmo arquivo, mesmo recorte de repouso (object-position 50%/15%,
      // sem zoom nem tint). A animação de entrada da própria BatismoSection
      // roda enquanto ela ainda está escondida atrás do pin do Hero (start
      // "top bottom" a end "top top" — termina exatamente quando o pin
      // solta), então o que o usuário vê ao "entrar na bola" É esse estado
      // final: o quadro inteiro, completo, tela cheia.
      // o raio acompanha o zoom o tempo todo, crescendo junto com a bola
      // desde o primeiro instante de scroll — é isso que dá a sensação de
      // "entrando na bola de verdade". Em repouso (raio 0) fica invisível;
      // no instante em que o scroll começa, salta direto pro raio real da
      // bola (raio = base * z, e z já é 1 nesse ponto) e continua
      // crescendo a partir daí — sem esse salto inicial ele nasceria
      // visível mesmo parado, porque scrub timelines renderizam a posição
      // 0 imediatamente ao montar (z=1) mesmo sem o usuário ter rolado
      const ORB_CENTER = "64.24% 88.89%";
      const ORB_BASE_RADIUS_VH = 10.555;
      // além do raio 0, o portal nasce invisível e desfocado: a janela
      // (clip-path) acompanha a bola desde o primeiro tick, mas o quadro
      // dentro dela só se MATERIALIZA no meio do mergulho (opacity/blur
      // animados no timeline) — sem isso o Batismo aparecia inteiro,
      // nítido, no primeiro pixel de scroll
      gsap.set(portalRevealRef.current, {
        clipPath: `circle(0vh at ${ORB_CENTER})`,
        opacity: 0,
        filter: "blur(14px)",
      });
      const zoomState = { z: 1 };

      // chamativo: halo dourado pulsando na bola antes do usuário rolar,
      // convidando o olhar pra ela — morto e desvanecido assim que o
      // scroll começa (ver "orbGlowTween.kill()" abaixo)
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
      // No caminho normal o pulso é só PAUSADO (o timeline de scroll assume
      // o glow: incandesce junto com o começo do mergulho e some engolido
      // por ele); voltar ao topo retoma o pulso de onde parou.
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
      // no caminho reduced não há mergulho pra assumir o glow — lá ele
      // simplesmente morre com fade no primeiro scroll, como antes
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

      // respeita quem pede menos movimento: troca o mergulho de câmera
      // por um crossfade simples, sem o zoom de 18x nem o pin longo
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
              .to(hintRef.current, { autoAlpha: 0 }, 0)
              .to(scrollCueRef.current, { autoAlpha: 0 }, 0)
              .to(siteNav, { autoAlpha: 0 }, 0)
              .to(portalFadeRef.current, { opacity: 1 }, 0.3);
            return;
          }

          // parallax de mouse: contra-movimento sutil do quadro —
          // desligado assim que o mergulho começa, porque deslocar
          // heroMedia em px tiraria a bola de baixo da janela do portal
          // calibrada em %
          const mediaX = gsap.quickTo(heroMedia, "x", { duration: 1, ease: "power3" });
          const mediaY = gsap.quickTo(heroMedia, "y", { duration: 1, ease: "power3" });
          let parallaxOn = true;
          const onHeroPointerMove = (e: PointerEvent) => {
            if (!parallaxOn) return;
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            mediaX(nx * -7);
            mediaY(ny * -5);
          };
          heroPin.addEventListener("pointermove", onHeroPointerMove);

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
                    if (parallaxOn) {
                      parallaxOn = false;
                      mediaX(0);
                      mediaY(0);
                    }
                  } else {
                    resumeGlowPulse();
                    parallaxOn = true;
                  }
                },
              },
            })
            // ATO 1 (0 → 0.3): a moldura esvazia — texto, dicas, nav,
            // objetos e poeira saem antes da parte violenta do zoom
            .to(heroCopyRef.current, { autoAlpha: 0, y: -20, ease: "none", duration: 0.3 }, 0)
            .to(hintRef.current, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            .to(scrollCueRef.current, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            .to(siteNav, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            .to(goldDustRef.current, { autoAlpha: 0, ease: "none", duration: 0.3 }, 0)
            // o glow incandesce com o início do zoom (ele mora dentro de
            // heroMedia, então cresce junto com o scale) e é engolido
            // pelo mergulho logo depois
            .to(orbGlowRef.current, { opacity: 1, ease: "none", duration: 0.15 }, 0.15)
            .to(orbGlowRef.current, { opacity: 0, ease: "none", duration: 0.2 }, 0.3)
            // ATO 2 (0.15 → 1): um único valor de zoom dirige tanto o
            // mergulho na pintura quanto o raio da janela do portal —
            // mesma curva de easing pros dois, então a borda da janela
            // nunca desalinha da bola de vidro desenhada por baixo
            .to(
              zoomState,
              {
                z: 18,
                ease: "power2.in",
                duration: 0.85,
                onUpdate: () => {
                  gsap.set(heroMedia, { scale: zoomState.z });
                  const started = zoomState.z > 1.0005;
                  gsap.set(portalRevealRef.current, {
                    clipPath: started
                      ? `circle(${(ORB_BASE_RADIUS_VH * zoomState.z).toFixed(2)}vh at ${ORB_CENTER})`
                      : `circle(0vh at ${ORB_CENTER})`,
                  });
                },
              },
              0.15,
            )
            // ATO 3 (0.35 → 0.7): o Batismo se materializa DENTRO do
            // cristal — de invisível e desfocado a nítido, em vez de já
            // estar colado na janela desde o primeiro tick
            .to(
              portalRevealRef.current,
              { opacity: 1, filter: "blur(0px)", ease: "none", duration: 0.35 },
              0.35,
            )
            // ATO 4 (0.5 → 1): a passagem pela cor do vidro — o véu
            // azul-acinzentado (#34383c, amostrado da esfera) sobe no meio
            // do mergulho e se dissolve exatamente quando o pin solta,
            // resolvendo no céu do Batismo, que está na mesma paleta
            .to(portalFadeRef.current, { opacity: 0.55, ease: "none", duration: 0.2 }, 0.5)
            .to(portalFadeRef.current, { opacity: 0, ease: "none", duration: 0.3 }, 0.7);

          return () => {
            heroPin.removeEventListener("pointermove", onHeroPointerMove);
          };
        },
      );

      return () => mm.revert();
    }, heroPinRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.heroPin} id="hero" ref={heroPinRef}>
      <div className={styles.heroMedia} ref={heroMediaRef}>
        <InkRevealCanvas
          baseSrc="/assets/salvator-mundi.jpg"
          revealSrc="/assets/estudo-salvator.jpg"
        />
        <div className={styles.orbGlow} ref={orbGlowRef} role="presentation" />
      </div>
      {/* fora de heroMedia de propósito: é uma vinheta pra legibilidade do
          texto sobre o quadro parado, não deve escalar junto no zoom de 18x
          (senão a banda mais escura do gradiente, perto de 100%, some o
          zoom inteiro em preto — foi exatamente o que aconteceu quando
          morava dentro de heroMedia) */}
      <div className={styles.heroScrim} />

      {/* poeira dourada suspensa na luz — o wrapper existe pro timeline
          de scroll ter um alvo estável pra esconder (o canvas em si some
          sozinho sob prefers-reduced-motion) */}
      <div className={styles.goldDust} ref={goldDustRef} role="presentation">
        <GoldDust />
      </div>

      {/* janela do portal: clip-path circle crescendo sobre o quadro em
          repouso da BatismoSection (mesmo arquivo, mesmo recorte, mesmo
          texto) — fica fora de heroMedia (não herda o scale de 18x) porque
          o próprio raio já é animado em sincronia com o zoom via clip-path,
          não por transform */}
      <div
        className={styles.portalReveal}
        ref={portalRevealRef}
        role="presentation"
      >
        <div className={styles.portalRevealMedia}>
          <Image
            src="/assets/batismo-cristo.jpg"
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "50% 15%" }}
          />
        </div>
        <div className={styles.portalRevealCopy}>
          <span className={styles.portalRevealEyebrow}>Batismo de Cristo</span>
          <h2>A luz desce sobre as águas</h2>
        </div>
      </div>

      <div className={styles.portalFade} ref={portalFadeRef} />

      <p className={styles.hint} ref={hintRef}>
        toque e arraste — ou passe o mouse — pra revelar o estudo de proporções
      </p>

      <div className={styles.heroCopy} ref={heroCopyRef}>
        <span className={styles.eyebrow}>Uma experiência imersiva</span>
        <h1>Onde a luz encontra a eternidade</h1>
        <p>
          As obras-primas de Leonardo da Vinci, reveladas camada por camada — da
          geometria ao gesto final.
        </p>
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
