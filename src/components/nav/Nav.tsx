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
  { label: "A experiência", target: "#experiencia", index: "02" },
  { label: "Leonardo", target: "#leonardo", index: "03" },
  { label: "Visitar", target: "#visitar", index: "04" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const metaRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const lenis = useLenis();

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
        { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: "power3.out" },
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
          propósito, pra não herdar nem o fade nem o blend difference */}
      <nav
        id="site-nav"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[5vw] py-7 mix-blend-difference"
      >
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-[family-name:var(--font-serif)] text-[19px] tracking-[2px] text-[var(--cream)]"
          onClick={() => goTo("#hero")}
        >
          Il Rinascimento
        </button>
        <div className="flex items-center gap-7">
          <button
            type="button"
            className="hidden cursor-pointer rounded-full border border-[var(--gold)] px-[22px] py-[10px] text-[12px] tracking-[0.5px] text-[var(--gold-soft)] sm:inline-block"
            onClick={() => goTo("#visitar")}
          >
            Reservar visita
          </button>
          <button
            type="button"
            className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

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
          <button
            type="button"
            className={styles.menuCta}
            onClick={() => goTo("#visitar")}
            tabIndex={open ? 0 : -1}
          >
            Reservar visita
          </button>
        </div>
      </div>
    </>
  );
}
