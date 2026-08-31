"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./BatismoSection.module.css";

export default function BatismoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    const tint = tintRef.current;
    // getElementById, não string de seletor: gsap.context() escopa buscas
    // por texto dentro de sectionRef, e o nav é irmão, não descendente.
    const siteNav = document.getElementById("site-nav");
    if (!section || !media || !tint) return;

    const ctx = gsap.context(() => {
      // começa com um recorte bem fechado num trecho limpo do céu — calibrado
      // por amostragem de pixel pra cair num vão sem raios/pomba/pássaro.
      // a cor continua a do portalFade via mix-blend-mode:color (não
      // hue-rotate no filter, que vira verde nos raios dourados) e vai
      // sumindo conforme a pintura se abre e recupera a cor natural
      gsap.set(media, {
        scale: 6.2,
        transformOrigin: "68% 10%",
        filter: "brightness(0.7) saturate(0.9)",
      });
      gsap.set(tint, { opacity: 0.85 });

      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "top top",
          scrub: true,
        },
      })
        .to(media, { scale: 1, filter: "brightness(1) saturate(1)", ease: "none" }, 0)
        .to(tint, { opacity: 0, ease: "none" }, 0)
        .to(siteNav, { autoAlpha: 1, ease: "none" }, 0.3);
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.batismoSection} id="batismo" ref={sectionRef}>
      <div className={styles.batismoMedia} ref={mediaRef}>
        <Image
          src="/assets/batismo-cristo.png"
          alt="Batismo de Cristo, de Andrea del Verrocchio e Leonardo da Vinci"
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "50% 15%" }}
        />
        <div className={styles.batismoTint} ref={tintRef} />
      </div>
      <div className={styles.batismoScrim} />
      <div className={styles.batismoCopy}>
        <span className={styles.eyebrow}>Batismo de Cristo</span>
        <h2>A luz desce sobre as águas</h2>
      </div>
    </section>
  );
}
