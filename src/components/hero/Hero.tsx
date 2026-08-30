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
  const mainCircleRef = useRef<SVGCircleElement>(null);
  const dropletARef = useRef<SVGCircleElement>(null);
  const dropletBRef = useRef<SVGCircleElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useIsomorphicLayoutEffect(() => {
    const heroPin = heroPinRef.current;
    const heroMedia = heroMediaRef.current;
    const mainCircle = mainCircleRef.current;
    const dropletA = dropletARef.current;
    const dropletB = dropletBRef.current;
    if (!heroPin || !heroMedia || !mainCircle || !dropletA || !dropletB) return;

    const ctx = gsap.context(() => {
      // --- reveal de tinta que segue o cursor / toque ---
      // três manchas (uma principal + dois respingos) em vez de um único
      // círculo, cada uma seguindo o ponteiro com um atraso diferente —
      // é a defasagem entre elas que dá a sensação de tinta se espalhando
      // em vez de uma lupa grudada exatamente no cursor.
      const followMain = { x: gsap.quickTo(mainCircle, "x", { duration: 0.35, ease: "power3" }), y: gsap.quickTo(mainCircle, "y", { duration: 0.35, ease: "power3" }) };
      const followA = { x: gsap.quickTo(dropletA, "x", { duration: 0.6, ease: "power2" }), y: gsap.quickTo(dropletA, "y", { duration: 0.6, ease: "power2" }) };
      const followB = { x: gsap.quickTo(dropletB, "x", { duration: 0.85, ease: "power2" }), y: gsap.quickTo(dropletB, "y", { duration: 0.85, ease: "power2" }) };

      let revealed = false;

      function moveHole(clientX: number, clientY: number) {
        const r = heroPin!.getBoundingClientRect();
        const x = clientX - r.left;
        const y = clientY - r.top;
        followMain.x(x);
        followMain.y(y);
        followA.x(x + 22);
        followA.y(y - 14);
        followB.x(x - 26);
        followB.y(y + 18);

        if (!revealed) {
          revealed = true;
          gsap.to(mainCircle, { attr: { r: 150 }, duration: 0.55, ease: "back.out(1.7)" });
          gsap.to(dropletA, { attr: { r: 40 }, duration: 0.6, delay: 0.04, ease: "back.out(1.8)" });
          gsap.to(dropletB, { attr: { r: 28 }, duration: 0.65, delay: 0.09, ease: "back.out(1.8)" });
        }
      }

      function hideHole() {
        revealed = false;
        gsap.to([mainCircle, dropletA, dropletB], {
          attr: { r: 0 },
          duration: 0.5,
          ease: "power2.in",
          overwrite: "auto",
        });
      }

      const onPointerMove = (e: PointerEvent) => moveHole(e.clientX, e.clientY);
      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (t) moveHole(t.clientX, t.clientY);
      };

      heroPin.addEventListener("pointermove", onPointerMove);
      heroPin.addEventListener("pointerleave", hideHole);
      heroPin.addEventListener("touchmove", onTouchMove, { passive: true });
      heroPin.addEventListener("touchend", hideHole);
      heroPin.addEventListener("touchcancel", hideHole);

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
        heroPin.removeEventListener("touchend", hideHole);
        heroPin.removeEventListener("touchcancel", hideHole);
        mm.revert();
      };
    }, heroPinRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.heroPin} id="hero" ref={heroPinRef}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        {/* ruído grosso — dá o contorno irregular da mancha principal, tipo tinta pingada */}
        <filter id="inkFilter" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.011} numOctaves={4} seed={6} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={90} />
        </filter>
        {/* ruído mais fino, proporcional ao tamanho pequeno dos respingos */}
        <filter id="inkFilterSmall" x="-150%" y="-150%" width="400%" height="400%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.05} numOctaves={3} seed={12} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={26} />
        </filter>
        <mask id="inkMask" maskUnits="objectBoundingBox" maskContentUnits="userSpaceOnUse" x={0} y={0} width={1} height={1}>
          <rect x={-4000} y={-4000} width={8000} height={8000} fill="black" />
          <circle ref={mainCircleRef} cx={0} cy={0} r={0} fill="white" filter="url(#inkFilter)" />
          <circle ref={dropletARef} cx={0} cy={0} r={0} fill="white" filter="url(#inkFilterSmall)" />
          <circle ref={dropletBRef} cx={0} cy={0} r={0} fill="white" filter="url(#inkFilterSmall)" />
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
