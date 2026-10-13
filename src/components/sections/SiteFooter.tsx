"use client";

import { useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./SiteFooter.module.css";

const LINKS = [
  { label: "Início", target: "#hero" },
  { label: "Obras", target: "#galeria" },
  { label: "Invenções", target: "#voo" },
  { label: "Leonardo", target: "#leonardo" },
  { label: "Visitar", target: "#visitar" },
];

// O fecho do site retoma a escrita espelhada de Leonardo: o nome dele
// começa invertido, como nos cadernos, e se desvira conforme a página
// chega ao fim — o último gesto da página é "ler" o nome dele.
export default function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();

  useIsomorphicLayoutEffect(() => {
    const footer = footerRef.current;
    const word = wordRef.current;
    if (!footer || !word) return;
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(word, { rotateY: 0 });
        return;
      }
      // rotateY(180°) = a palavra espelhada; o scroll a gira até 0°
      gsap.fromTo(
        word,
        { rotateY: 180 },
        {
          rotateY: 0,
          ease: "none",
          scrollTrigger: { trigger: footer, start: "top 85%", end: "bottom bottom", scrub: 1 },
        },
      );
      gsap.fromTo(
        footer.querySelectorAll("[data-fade]"),
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: footer, start: "top 70%", toggleActions: "play none none reverse" },
        },
      );
    }, footer);
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  const go = (target: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    lenis?.scrollTo(target, { duration: 1.8 });
  };

  return (
    <footer className={styles.footer} id="contato" ref={footerRef}>
      <div className={styles.columns}>
        <p className={styles.tagline} data-fade="">
          Uma experiência imersiva pelas obras de Leonardo da Vinci —{" "}
          <em>do traço ao gesto final.</em>
        </p>

        <nav className={styles.col} aria-label="Rodapé" data-fade="">
          <span className={styles.colLabel}>Navegar</span>
          {LINKS.map((l) => (
            <a key={l.target} href={l.target} onClick={go(l.target)}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className={styles.col} data-fade="">
          <span className={styles.colLabel}>Créditos</span>
          <p>
            Obras e desenhos de Leonardo: domínio público, via Wikimedia
            Commons.
          </p>
          <p>
            Modelo 3D &ldquo;Ornitottero&rdquo;: Woody&rsquo;s Games, CC BY
            4.0.
          </p>
        </div>

        <div className={styles.col} data-fade="">
          <span className={styles.colLabel}>Projeto</span>
          <p>Projeto de portfólio por Lucas Barbosa.</p>
          <a
            href="https://github.com/lucasbarbosagit/davinciimmersiveexperience"
            target="_blank"
            rel="noopener noreferrer"
          >
            Código no GitHub ↗
          </a>
        </div>
      </div>

      <div className={styles.wordmarkWrap} aria-label="Leonardo">
        <span className={styles.wordmark} ref={wordRef} aria-hidden="true">
          Leonardo
        </span>
      </div>

      <div className={styles.bottom}>
        <span>Leonardo da Vinci · 1452 — 1519</span>
        <a href="#hero" onClick={go("#hero")}>
          Voltar ao início ↑
        </a>
      </div>
    </footer>
  );
}
