"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./InfoSections.module.css";

const TIMELINE = [
  { year: "1452", fact: "nasce em Anchiano, perto de Vinci, na Toscana" },
  { year: "1495–1498", fact: "pinta A Última Ceia no refeitório de Santa Maria delle Grazie" },
  { year: "c. 1500", fact: "Salvator Mundi — o orbe de cristal que abre esta jornada" },
  { year: "1503", fact: "começa a Gioconda, que nunca considerou terminada" },
  { year: "1519", fact: "morre em Amboise, na França, aos 67 anos" },
];

export default function LeonardoSection() {
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
    <section className={styles.infoSection} id="leonardo" ref={sectionRef}>
      <div className={styles.leonardoGrid}>
        <div>
          <span className={styles.eyebrow} data-reveal>
            O mestre
          </span>
          <h2 data-reveal>Leonardo di ser Piero da Vinci</h2>
          <p className={styles.lead} data-reveal>
            Pintor, anatomista, engenheiro, músico — Leonardo tratava a arte
            como ciência e a ciência como arte. Seus cadernos, escritos de trás
            pra frente em escrita espelhada, guardam os estudos que esta
            experiência revela por baixo de cada pintura.
          </p>
        </div>
        <div data-reveal>
          <div className={styles.portraitWrap}>
            <Image
              src="/assets/davinci_hero.jpeg"
              alt="Retrato imaginado de Leonardo da Vinci com um pincel e um códice aberto"
              fill
              sizes="(max-width: 860px) 90vw, 45vw"
              style={{ objectFit: "cover", objectPosition: "50% 28%" }}
            />
          </div>
          <p className={styles.portraitCaption}>
            retrato imaginado — o mestre entre o pincel e o códice
          </p>
        </div>
      </div>
      <ul className={styles.timeline}>
        {TIMELINE.map((item) => (
          <li key={item.year} data-reveal>
            <span>{item.year}</span>
            <span>{item.fact}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
