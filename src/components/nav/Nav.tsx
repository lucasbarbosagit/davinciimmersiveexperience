"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import styles from "./Nav.module.css";

// arquitetura do site (um mestre só — da Vinci — então nada de "mestres"):
// a jornada pelas obras abre o site, e o menu leva aos capítulos de
// informação que vêm depois dela
const MENU_ITEMS = [
  { label: "Início", target: "#hero", index: "01" },
  { label: "Obras", target: "#galeria", index: "02" },
  { label: "A experiência", target: "#experiencia", index: "03" },
  { label: "Leonardo", target: "#leonardo", index: "04" },
  { label: "Visitar", target: "#visitar", index: "05" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#hero");
  const overlayRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const metaRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const lenis = useLenis();

  // menu overlay em tela cheia — só existe pra viewports estreitos, onde
  // a lista persistente da esquerda não cabe (ver .deskNav / .mobileOnly
  // em Nav.module.css)
  useIsomorphicLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const items = itemRefs.current.filter(Boolean);

    const tl = gsap
      .timeline({ paused: true })
      .set(overlay, { pointerEvents: "auto" }, 0)
      .to(overlay, { autoAlpha: 1, duration: 0.45, ease: "power2.out" }, 0)
      .fromTo(
        items,
        { y: 46, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.55,
          stagger: 0.07,
          ease: "power3.out",
        },
        0.12,
      )
      .fromTo(
        metaRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.4, ease: "none" },
        0.4,
      );
    tlRef.current = tl;

    return () => {
      tl.kill();
      tlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (open) {
      tlRef.current?.play();
      lenis?.stop();
    } else {
      tlRef.current?.reverse();
      lenis?.start();
    }
  }, [open, lenis]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // destaca o capítulo atual na lista persistente: observa uma faixa
  // fina no meio da tela, não o topo/fundo inteiro, pra trocar exatamente
  // quando o capítulo domina a vista, não no instante em que aparece
  useEffect(() => {
    const targets = MENU_ITEMS.map((item) =>
      document.querySelector(item.target),
    ).filter((el): el is Element => Boolean(el));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        setActive(`#${topMost.target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goTo = (target: string) => {
    setOpen(false);
    // start() ANTES do scrollTo: o efeito de [open] só retoma o lenis
    // depois do re-render, e um scrollTo com o lenis parado é engolido
    lenis?.start();
    lenis?.scrollTo(target, { duration: 1.8 });
  };

  return (
    <>
      {/* o id site-nav é alvo dos timelines de Hero/Batismo (fade da
          barra durante o mergulho) — o overlay fica fora dele de
          propósito, pra não herdar nem o fade nem o blend difference.
          Em telas largas só o CTA sobrevive aqui: marca e links moram
          na lista persistente (.deskNav) e no burger some (.mobileOnly) */}
      <nav
        id="site-nav"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-end px-[5vw] py-7 mix-blend-difference"
      >
        {/* sem wordmark aqui: em telas largas a marca mora na lista
            persistente (site-desk-nav); em telas estreitas mora no
            próprio título gigante do hero, e "Início" no overlay do
            hambúrguer já cobre o "voltar ao topo" — duplicar o nome
            pequeno aqui só brigava com o título grande por espaço */}
        <div className="flex items-center gap-7">
          <button
            type="button"
            className={`${styles.mobileOnly} ${styles.burger} ${open ? styles.burgerOpen : ""}`}
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* lista persistente à esquerda — visível em telas largas, no lugar
          do hambúrguer; mesmo id alvo dos fades de Hero/Batismo durante
          o mergulho de scroll (some junto com o resto do chrome) */}
      <div id="site-desk-nav" className={styles.deskNav}>
        <ul className={styles.deskList}>
          {MENU_ITEMS.map((item) => (
            <li key={item.target}>
              <button
                type="button"
                className={`${styles.deskLink} ${active === item.target ? styles.deskLinkActive : ""}`}
                onClick={() => goTo(item.target)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.overlay} ref={overlayRef} aria-hidden={!open}>
        <ul className={styles.menuList}>
          {MENU_ITEMS.map((item, i) => (
            <li
              key={item.target}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
            >
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => goTo(item.target)}
                tabIndex={open ? 0 : -1}
              >
                <span className={styles.menuIndex}>{item.index}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.menuMeta} ref={metaRef}>
          <span>Uma jornada imersiva pela obra de Leonardo da Vinci</span>
        </div>
      </div>
    </>
  );
}
