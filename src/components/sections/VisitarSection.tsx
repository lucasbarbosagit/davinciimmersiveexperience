"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import SplitChars from "@/components/ui/SplitChars";
import styles from "./VisitarSection.module.css";

// Ainda não existe sistema de reservas: o botão aponta pra cá até ter um
// link de verdade (bilheteria, formulário, e-mail)
const BOOKING_URL = "#visitar";

const INFO = [
  {
    label: "Onde",
    lines: ["Galleria dell’Eterno", "Via dei Maestri, 15", "Firenze, Itália"],
  },
  {
    label: "Quando",
    lines: ["Terça a domingo, 10h — 20h", "Última entrada às 19h"],
  },
  {
    label: "Ingressos",
    lines: ["A partir de R$ 50", "Gratuito até 12 anos", "Percurso de ~45 minutos"],
  },
];

export default function VisitarSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const ticket = ticketRef.current;
    if (!section || !ticket) return;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 65%", toggleActions: "play none none reverse" },
      });
      tl.fromTo(
        section.querySelectorAll("[data-char]"),
        { yPercent: 115 },
        { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.03 },
      )
        .fromTo(
          section.querySelectorAll("[data-rule]"),
          { scaleX: 0 },
          { scaleX: 1, duration: 1, ease: "expo.out", stagger: 0.08 },
          0.2,
        )
        .fromTo(
          section.querySelectorAll("[data-fade]"),
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.07 },
          0.3,
        )
        // o ingresso desliza pra mesa e assenta torto, como papel solto
        .fromTo(
          ticket,
          { autoAlpha: 0, y: 120, rotate: -14 },
          { autoAlpha: 1, y: 0, rotate: -4, duration: 1.4, ease: "expo.out" },
          0.25,
        );
    }, section);

    // inclinação 3D seguindo o ponteiro + brilho do papel acompanhando
    const card = ticket.querySelector<HTMLElement>("[data-card]");
    const onMove = (e: PointerEvent) => {
      if (!card || prefersReducedMotion) return;
      const b = ticket.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5;
      const y = (e.clientY - b.top) / b.height - 0.5;
      gsap.to(card, { rotateY: x * 16, rotateX: -y * 12, duration: 0.6, ease: "power3.out" });
      card.style.setProperty("--sheen-x", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--sheen-y", `${(y + 0.5) * 100}%`);
    };
    const onLeave = () => {
      if (!card) return;
      gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.9, ease: "power3.out" });
    };
    ticket.addEventListener("pointermove", onMove);
    ticket.addEventListener("pointerleave", onLeave);

    return () => {
      ticket.removeEventListener("pointermove", onMove);
      ticket.removeEventListener("pointerleave", onLeave);
      ctx.revert();
    };
  }, [prefersReducedMotion]);

  return (
    <section className={styles.visitSection} id="visitar" ref={sectionRef}>
      <div className={styles.info}>
        <span className={styles.eyebrow} data-fade="">
          Visitar
        </span>
        <h2 className={styles.title} aria-label="A luz espera por você">
          <SplitChars text="A luz" />{" "}
          <em>
            <SplitChars text="espera por você" />
          </em>
        </h2>
        <dl className={styles.rows}>
          {INFO.map((row) => (
            <div key={row.label} className={styles.row}>
              <span className={styles.rule} data-rule="" />
              <dt data-fade="">{row.label}</dt>
              <dd data-fade="">
                {row.lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <a className={styles.cta} href={BOOKING_URL} data-fade="">
          <span>Reservar visita</span>
          <span className={styles.ctaArrow} aria-hidden="true">
            →
          </span>
        </a>
      </div>

      <div className={styles.ticketWrap} ref={ticketRef}>
        <div className={styles.ticket} data-card="">
          <div className={styles.ticketMain}>
            <div className={styles.ticketTop}>
              <span>Galleria dell&rsquo;Eterno</span>
              <span>Firenze</span>
            </div>
            <p className={styles.ticketKicker}>Uma experiência imersiva</p>
            <p className={styles.ticketName}>
              Leonardo
              <em>da Vinci</em>
            </p>
            <div className={styles.ticketMeta}>
              <div>
                <span>Entrada</span>
                <strong>Inteira</strong>
              </div>
              <div>
                <span>Salas</span>
                <strong>I — VI</strong>
              </div>
              <div>
                <span>Percurso</span>
                <strong>45 min</strong>
              </div>
            </div>
          </div>
          <div className={styles.ticketStub}>
            <span className={styles.stubLabel}>Ammissione</span>
            <span className={styles.stubNumber}>Nº 001452</span>
            <span className={styles.stubPrice}>R$ 50</span>
          </div>
        </div>
      </div>
    </section>
  );
}
