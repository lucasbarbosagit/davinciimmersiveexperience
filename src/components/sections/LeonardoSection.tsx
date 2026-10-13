"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import SplitChars from "@/components/ui/SplitChars";
import styles from "./LeonardoSection.module.css";

// A vida em cinco cidades, numa linha do tempo horizontal: o scroll
// vertical vira avanço lateral (pin + translateX). Cada capítulo tem o ano
// em contorno dourado ao fundo (anda em outra velocidade — parallax), a
// obra real daquele período se revelando de baixo pra cima e o texto
// entrando letra a letra quando o capítulo chega ao centro.
//
// Todas as imagens são as obras verdadeiras, em domínio público
// (Wikimedia Commons) — numa linha do tempo histórica a legenda tem que
// corresponder ao que está na tela.
const CHAPTERS = [
  {
    year: "1452",
    place: "Vinci",
    span: "1452",
    title: "Nasce na Toscana",
    text: "Filho do notário ser Piero, nasce em 15 de abril de 1452 em Anchiano, perto de Vinci. Cresce entre as colinas que vai desenhar a vida inteira.",
    img: "/assets/tl-vinci-landscape.webp",
    w: 800,
    h: 553,
    caption: "Paisagem do vale do Arno, 1473 — seu desenho datado mais antigo. Uffizi, Florença.",
    shape: "wide",
  },
  {
    year: "1475",
    place: "Florença",
    span: "1466 – 1482",
    title: "A oficina de Verrocchio",
    text: "Aprendiz de Andrea del Verrocchio, aprende pintura, escultura e engenharia. No Batismo de Cristo do mestre, pinta o anjo da esquerda — e, conta Vasari, Verrocchio nunca mais pegou num pincel.",
    img: "/assets/tl-baptism.webp",
    w: 1091,
    h: 1300,
    caption: "Batismo de Cristo, c. 1475, Verrocchio e Leonardo. Uffizi, Florença.",
    shape: "tall",
  },
  {
    year: "1495",
    place: "Milão",
    span: "1482 – 1499",
    title: "A corte dos Sforza",
    text: "A serviço de Ludovico Sforza, é pintor, engenheiro e cenógrafo da corte. Desenha máquinas de voar, mede o corpo humano e pinta a Última Ceia na parede do refeitório de Santa Maria delle Grazie.",
    img: "/assets/tl-last-supper.webp",
    w: 1300,
    h: 650,
    caption: "A Última Ceia, 1495–1498. Santa Maria delle Grazie, Milão.",
    shape: "wide",
  },
  {
    year: "1503",
    place: "Florença",
    span: "1500 – 1508",
    title: "O retrato que nunca entregou",
    text: "De volta a Florença, começa o retrato de Lisa Gherardini, mulher de um mercador de seda. Leva-o consigo por anos, retocando — e nunca o entrega.",
    img: "/assets/tl-mona-lisa.webp",
    w: 872,
    h: 1300,
    caption: "Gioconda, 1503–1506, retocada por anos depois. Louvre, Paris.",
    shape: "tall",
  },
  {
    year: "1519",
    place: "Amboise",
    span: "1513 – 1519",
    title: "Os últimos anos",
    text: "Depois de Roma, aceita o convite de Francisco I e vai para a França, com a Gioconda na bagagem. Morre em Amboise em 2 de maio de 1519, aos 67 anos.",
    img: "/assets/tl-red-chalk.webp",
    w: 834,
    h: 1300,
    caption: "Retrato de homem em sanguínea, tradicionalmente tido como autorretrato. Biblioteca Reale, Turim.",
    shape: "tall",
  },
] as const;

export default function LeonardoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const railFillRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const distance = () => track.scrollWidth - window.innerWidth;

      // o avanço lateral: um tween linear arrastado pelo scroll. Os
      // capítulos usam ele como containerAnimation pros próprios gatilhos
      const scroller = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (railFillRef.current) railFillRef.current.style.transform = `scaleX(${self.progress})`;
          },
        },
      });

      // abertura: o título entra quando a seção chega
      const introTl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 70%", toggleActions: "play none none reverse" },
      });
      introTl
        .fromTo(
          section.querySelectorAll("[data-intro] [data-char]"),
          { yPercent: 115 },
          { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.03 },
        )
        .fromTo(
          section.querySelectorAll("[data-intro] [data-fade]"),
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 },
          0.3,
        );

      section.querySelectorAll<HTMLElement>("[data-chapter]").forEach((chapter) => {
        const media = chapter.querySelector("[data-media]");
        const img = chapter.querySelector("[data-media] img");
        const year = chapter.querySelector("[data-year]");

        // a obra sobe de trás de uma borda, enquanto a imagem dentro
        // desce um pouco (a moldura e o quadro em velocidades diferentes)
        gsap.fromTo(
          media,
          { clipPath: "inset(100% 0% 0% 0%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              containerAnimation: scroller,
              start: "left 90%",
              end: "left 40%",
              scrub: true,
            },
          },
        );
        gsap.fromTo(
          img,
          { scale: 1.25, yPercent: -6 },
          {
            scale: 1,
            yPercent: 0,
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              containerAnimation: scroller,
              start: "left right",
              end: "center center",
              scrub: true,
            },
          },
        );
        // o ano anda mais devagar que o resto: profundidade
        gsap.fromTo(
          year,
          { xPercent: 28 },
          {
            xPercent: -28,
            ease: "none",
            scrollTrigger: {
              trigger: chapter,
              containerAnimation: scroller,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        );
        // o texto: tocado (não arrastado) quando o capítulo chega
        const textTl = gsap.timeline({
          scrollTrigger: {
            trigger: chapter,
            containerAnimation: scroller,
            start: "left 55%",
            toggleActions: "play none none reverse",
          },
        });
        textTl
          .fromTo(
            chapter.querySelectorAll("[data-char]"),
            { yPercent: 115 },
            { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.02 },
          )
          .fromTo(
            chapter.querySelectorAll("[data-fade]"),
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 },
            0.2,
          );
      });
    }, section);

    // (as <img> declaram width/height: a largura do trilho já é a final
    // antes de elas carregarem, sem precisar de ScrollTrigger.refresh)
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <section
      className={styles.timelineSection}
      id="leonardo"
      ref={sectionRef}
      data-reduced={prefersReducedMotion ? "" : undefined}
    >
      <div className={styles.track} ref={trackRef}>
        <div className={styles.intro} data-intro="">
          <span className={styles.eyebrow} data-fade="">
            O mestre · 1452 — 1519
          </span>
          <h2 className={styles.introTitle} aria-label="Leonardo di ser Piero da Vinci">
            <SplitChars text="Leonardo" />{" "}
            <em>
              <SplitChars text="di ser Piero da Vinci" />
            </em>
          </h2>
          <p className={styles.lead} data-fade="">
            Pintor, anatomista, engenheiro, músico. Tratava a arte como ciência
            e a ciência como arte — e deixou mais cadernos do que pinturas.
          </p>
          <span className={styles.hint} data-fade="">
            Cinco cidades
            <span className={styles.hintLine} />
          </span>
        </div>

        {CHAPTERS.map((c, i) => (
          <article
            key={c.year + c.place}
            className={`${styles.chapter} ${c.shape === "wide" ? styles.chapterWide : styles.chapterTall}`}
            data-chapter=""
          >
            <span className={styles.year} data-year="" aria-hidden="true">
              {c.year}
            </span>
            <figure className={styles.media}>
              <div className={styles.mediaClip} data-media="">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.img}
                  alt={c.caption}
                  width={c.w}
                  height={c.h}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className={styles.caption} data-fade="">
                {c.caption}
              </figcaption>
            </figure>
            <div className={styles.text}>
              <span className={styles.eyebrow} data-fade="">
                {String(i + 1).padStart(2, "0")} · {c.place} · {c.span}
              </span>
              <h3 className={styles.chapterTitle} aria-label={c.title}>
                <SplitChars text={c.title} />
              </h3>
              <p className={styles.chapterText} data-fade="">
                {c.text}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.rail} aria-hidden="true">
        <div className={styles.railLine}>
          <div className={styles.railFill} ref={railFillRef} />
        </div>
        <ol className={styles.railStops}>
          {CHAPTERS.map((c) => (
            <li key={c.year + c.place}>
              <span>{c.place}</span>
              <span className={styles.railYear}>{c.span}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
