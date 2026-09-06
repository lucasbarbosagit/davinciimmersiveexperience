"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./InfoSections.module.css";

export default function VisitarSection() {
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
    <section className={styles.infoSection} id="visitar" ref={sectionRef}>
      <span className={styles.eyebrow} data-reveal>
        Visitar
      </span>
      <h2 data-reveal>A luz espera por você</h2>
      <div className={styles.visitGrid}>
        <div className={styles.visitCol} data-reveal>
          <h3>Onde</h3>
          <p>
            Galleria dell&rsquo;Eterno
            <br />
            Via dei Maestri, 15
            <br />
            Firenze, Itália
          </p>
        </div>
        <div className={styles.visitCol} data-reveal>
          <h3>Quando</h3>
          <p>
            terça a domingo
            <br />
            10h — 20h
            <br />
            última entrada às 19h
          </p>
        </div>
        <div className={styles.visitCol} data-reveal>
          <h3>Bilhetes</h3>
          <p>
            a partir de €18
            <br />
            gratuito até 12 anos
            <br />
            percurso de ~45 minutos
          </p>
        </div>
      </div>
      <button type="button" className={styles.visitCta} data-reveal>
        Reservar visita
      </button>
    </section>
  );
}
