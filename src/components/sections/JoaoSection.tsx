"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./JoaoSection.module.css";

export default function JoaoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    // getElementById, não string de seletor: gsap.context() escopa buscas
    // por texto dentro de sectionRef, e o nav é irmão, não descendente.
    const siteNav = document.getElementById("site-nav");
    if (!section || !media) return;

    const ctx = gsap.context(() => {
      gsap.set(media, { scale: 1.35 });

      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "top top",
          scrub: true,
        },
      })
        .to(media, { scale: 1, filter: "brightness(1)", ease: "none" }, 0)
        .to(siteNav, { autoAlpha: 1, ease: "none" }, 0.3);
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.joaoSection} id="joao" ref={sectionRef}>
      <div className={styles.joaoMedia} ref={mediaRef}>
        <Image
          src="/assets/sao-joao-batista.jpg"
          alt="São João Batista, de Leonardo da Vinci"
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 25%" }}
        />
      </div>
      <div className={styles.joaoScrim} />
      <div className={styles.joaoCopy}>
        <span className={styles.eyebrow}>São João Batista</span>
        <h2>O gesto que aponta além</h2>
      </div>
    </section>
  );
}
