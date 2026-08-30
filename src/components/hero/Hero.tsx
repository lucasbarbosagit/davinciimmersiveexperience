"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import ObjectSlot from "./ObjectSlot";
import styles from "./Hero.module.css";

export default function Hero() {
  const heroPinRef = useRef<HTMLElement>(null);
  const heroMediaRef = useRef<HTMLDivElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const portalFadeRef = useRef<HTMLDivElement>(null);
  const revealCircleRef = useRef<SVGCircleElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useIsomorphicLayoutEffect(() => {
    const heroPin = heroPinRef.current;
    const heroMedia = heroMediaRef.current;
    const circle = revealCircleRef.current;
    if (!heroPin || !heroMedia || !circle) return;

    const ctx = gsap.context(() => {
      // --- máscara de tinta que segue o cursor / toque ---
      function moveHole(clientX: number, clientY: number) {
        const r = heroPin!.getBoundingClientRect();
        circle!.setAttribute("cx", String(clientX - r.left));
        circle!.setAttribute("cy", String(clientY - r.top));
      }
      function hideHole() {
        circle!.setAttribute("cx", "-9999");
        circle!.setAttribute("cy", "-9999");
      }

      const onPointerMove = (e: PointerEvent) => moveHole(e.clientX, e.clientY);
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (t) moveHole(t.clientX, t.clientY);
      };

      heroPin.addEventListener("pointermove", onPointerMove);
      heroPin.addEventListener("pointerleave", hideHole);
      heroPin.addEventListener("touchmove", onTouchMove, { passive: true });
      hideHole();

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
              .to("#site-nav", { autoAlpha: 0 }, 0)
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
            .to("#site-nav", { autoAlpha: 0, ease: "none" }, 0)
            .to(slotRefs.current.filter(Boolean), { autoAlpha: 0, ease: "none" }, 0)
            .to(heroMedia, { scale: 18, ease: "power2.in" }, 0.15)
            .to(portalFadeRef.current, { opacity: 1, ease: "none" }, 0.75);
        }
      );

      return () => {
        heroPin.removeEventListener("pointermove", onPointerMove);
        heroPin.removeEventListener("pointerleave", hideHole);
        heroPin.removeEventListener("touchmove", onTouchMove);
        mm.revert();
      };
    }, heroPinRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.heroPin} id="hero" ref={heroPinRef}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="inkFilter" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.014} numOctaves={3} seed={6} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={70} />
        </filter>
        <mask id="inkMask" maskUnits="objectBoundingBox" maskContentUnits="userSpaceOnUse" x={0} y={0} width={1} height={1}>
          <rect x={-4000} y={-4000} width={8000} height={8000} fill="black" />
          <circle ref={revealCircleRef} cx={-9999} cy={-9999} r={150} fill="white" filter="url(#inkFilter)" />
        </mask>
      </svg>

      <div className={styles.heroMedia} ref={heroMediaRef}>
        <div className={styles.layer}>
          <Image
            src="/assets/salvator-mundi.jpg"
            alt="Salvator Mundi, pintura finalizada de Leonardo da Vinci"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 22%" }}
          />
        </div>
        <div className={`${styles.layer} ${styles.layerStudy}`}>
          <Image
            src="/assets/estudo-salvator.jpg"
            alt="Estudo de proporções do Salvator Mundi"
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 22%" }}
          />
        </div>
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
