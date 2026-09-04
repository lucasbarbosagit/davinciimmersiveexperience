"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import ObjectSlot from "./ObjectSlot";
import InkRevealCanvas from "./InkRevealCanvas";
import styles from "./Hero.module.css";

export default function Hero() {
  const heroPinRef = useRef<HTMLElement>(null);
  const heroMediaRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const portalFadeRef = useRef<HTMLDivElement>(null);
  const orbGlowRef = useRef<HTMLDivElement>(null);
  const portalRevealRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      gsap.set(portalRevealRef.current, {
        clipPath: `circle(0vh at ${ORB_CENTER})`,
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
      // matar o glow ali dentro do próprio timeline apagava o pulso antes
      // do usuário sequer rolar. onUpdate só dispara com progresso real.
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

      // flutuação suave dos objetos ao lado
      gsap.to(slotRefs.current.filter(Boolean), {
        y: "+=14",
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.4,
      });

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
              .to(slotRefs.current.filter(Boolean), { autoAlpha: 0 }, 0)
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
                  if (self.progress > 0.001) killOrbGlow();
                },
              },
            })
            .to(heroCopyRef.current, { autoAlpha: 0, y: -20, ease: "none" }, 0)
            .to(hintRef.current, { autoAlpha: 0, ease: "none" }, 0)
            .to(scrollCueRef.current, { autoAlpha: 0, ease: "none" }, 0)
            .to(siteNav, { autoAlpha: 0, ease: "none" }, 0)
            .to(
              slotRefs.current.filter(Boolean),
              { autoAlpha: 0, ease: "none" },
              0,
            )
            // um único valor de zoom dirige tanto o mergulho na pintura
            // quanto o raio da janela do portal — mesma curva de easing
            // pros dois, então a borda da janela nunca desalinha da bola
            // de vidro que está sendo desenhada por baixo
            .to(
              zoomState,
              {
                z: 18,
                ease: "power2.in",
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

      <ObjectSlot
        src="/assets/object-gear.png"
        alt="Engrenagem de cristal, objeto decorativo"
        label="engrenagem de cristal"
        style={{ top: "14%", left: "7%" }}
        slotRef={(el) => {
          slotRefs.current[0] = el;
        }}
      />
      <ObjectSlot
        src="/assets/object-vitruvio.png"
        alt="Cartão do Homem Vitruviano, objeto decorativo"
        label="cartão do Vitruviano"
        style={{ top: "18%", right: "6%" }}
        slotRef={(el) => {
          slotRefs.current[1] = el;
        }}
      />

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
    </section>
  );
}
