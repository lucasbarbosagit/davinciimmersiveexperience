"use client";

import { useRef } from "react";
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
      // zoom da câmera até o orb — coordenadas calibradas na imagem real (62% / 82%)
      gsap.set(heroMedia, { transformOrigin: "62% 82%" });

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
            gsap.timeline({
              scrollTrigger: {
                trigger: heroPin,
                start: "top top",
                end: "+=60%",
                scrub: true,
                pin: true,
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

          gsap.timeline({
            scrollTrigger: {
              trigger: heroPin,
              start: "top top",
              end: "+=140%",
              scrub: true,
              pin: true,
            },
          })
            .to(heroCopyRef.current, { autoAlpha: 0, y: -20, ease: "none" }, 0)
            .to(hintRef.current, { autoAlpha: 0, ease: "none" }, 0)
            .to(scrollCueRef.current, { autoAlpha: 0, ease: "none" }, 0)
            .to(siteNav, { autoAlpha: 0, ease: "none" }, 0)
            .to(slotRefs.current.filter(Boolean), { autoAlpha: 0, ease: "none" }, 0)
            .to(heroMedia, { scale: 18, ease: "power2.in" }, 0.15)
            .to(portalFadeRef.current, { opacity: 1, ease: "none" }, 0.75);
        }
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
          focal={{ x: 0.5, y: 0.22 }}
          radius={130}
        />
        <div className={styles.heroScrim} />
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
        <p>As obras-primas de Leonardo da Vinci, reveladas camada por camada — da geometria ao gesto final.</p>
      </div>

      <div className={styles.scrollCue} ref={scrollCueRef}>
        <span>role para explorar</span>
        <span className={styles.line} />
      </div>
    </section>
  );
}
