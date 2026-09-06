"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./InfoSections.module.css";

export default function ExperienciaSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-reveal]", {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.09,
        scrollTrigger: { trigger: section, start: "top 72%", once: true },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.infoSection} id="experiencia" ref={sectionRef}>
      <span className={styles.eyebrow} data-reveal>
        A experiência
      </span>
      <h2 data-reveal>Entre na obra, não apenas diante dela</h2>
      <p className={styles.lead} data-reveal>
        Cada pintura de Leonardo se abre em camadas — do pergaminho ao traço,
        do estudo de proporções ao gesto final em óleo. Aqui, o scroll é a
        câmera: você atravessa o orbe de cristal, mergulha na luz e sai dentro
        da cena seguinte.
      </p>
      <div className={styles.factRow}>
        <div className={styles.fact} data-reveal>
          <strong>Camada por camada</strong>
          <span>
            toque e arraste sobre as obras pra revelar os estudos escondidos
            por baixo da tinta
          </span>
        </div>
        <div className={styles.fact} data-reveal>
          <strong>Portais na pintura</strong>
          <span>
            cada obra guarda uma porta — atravessá-la é a transição pro
            capítulo seguinte
          </span>
        </div>
        <div className={styles.fact} data-reveal>
          <strong>No seu ritmo</strong>
          <span>
            a jornada é guiada pelo seu scroll, e respeita quem prefere menos
            movimento
          </span>
        </div>
      </div>
    </section>
  );
}
