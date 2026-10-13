"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";
import { markSiteReady } from "@/lib/siteReady";
import styles from "./SiteLoader.module.css";

// O loading: espera só o essencial pro começo do site (as fontes, as três
// obras do hero, o frame do saguão em que o mergulho termina e um bom
// trecho do vídeo do intro). O resto — o voo da galeria, o modelo 3D —
// carrega por trás, depois, sem segurar ninguém aqui.
//
// O número é escrito espelhado, como os cadernos de Leonardo; ao chegar a
// 100 ele vira na página (o mesmo giro do "Leonardo" do rodapé) e a tela
// sobe, revelando o intro, que só começa a tocar nesse instante.
const IMAGES = [
  "/assets/davinci-cut.png",
  "/assets/salvator-cut.png",
  "/assets/gioconda-cut.png",
  "/assets/gallery-lobby.jpg",
];
// do vídeo do intro, quanto precisa estar baixado pra tocar sem engasgar
const VIDEO_ENOUGH = 0.55;
const VIDEO_WEIGHT = 4;
// nunca some num piscar (o número precisa ser lido), nunca prende demais
const MIN_TIME = 1.4;
const MAX_TIME = 15;

export default function SiteLoader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
    lenis?.stop();
  }, [lenis]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const start = performance.now() / 1000;
    let fontsDone = 0;
    let imagesDone = 0;
    let videoFrac = 0;

    document.fonts.ready.then(() => {
      fontsDone = 1;
    });
    const imgs = IMAGES.map((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        imagesDone++;
      };
      img.src = src;
      return img;
    });

    // o vídeo do intro já está na página, baixando (preload=auto, parado):
    // mede o que ele bufferizou em vez de baixar uma segunda vez
    const video = document.querySelector<HTMLVideoElement>("[data-intro-video]");
    // o navegador pode decidir parar de baixar um vídeo parado (suspend):
    // se já dá pra começar a tocar, isso conta como pronto
    let videoReady = false;
    const onVideoEnough = () => {
      if (video && video.readyState >= 3) videoReady = true;
    };
    video?.addEventListener("canplaythrough", onVideoEnough);
    video?.addEventListener("suspend", onVideoEnough);
    const readVideo = () => {
      if (!video || videoReady) return 1;
      if (video.readyState >= 4) return 1;
      const d = video.duration;
      if (!d || !isFinite(d) || video.buffered.length === 0) return 0;
      const end = video.buffered.end(video.buffered.length - 1);
      return Math.min(1, end / (d * VIDEO_ENOUGH));
    };

    const total = 1 + IMAGES.length + VIDEO_WEIGHT;
    let shown = 0;
    let finished = false;
    let raf = 0;

    function tick() {
      const now = performance.now() / 1000;
      videoFrac = Math.max(videoFrac, readVideo());
      let real = (fontsDone + imagesDone + videoFrac * VIDEO_WEIGHT) / total;
      if (now - start > MAX_TIME) real = 1;
      // o número persegue o progresso real, mas sem saltos e sem chegar
      // ao fim antes do tempo mínimo
      const cap = Math.min(1, (now - start) / MIN_TIME);
      const goal = Math.min(real, cap);
      shown += (goal - shown) * 0.08 + (goal > shown ? 0.002 : 0);
      shown = Math.min(shown, goal);
      const pct = Math.floor(shown * 100);
      if (numRef.current) numRef.current.textContent = String(pct).padStart(2, "0");
      if (lineRef.current) lineRef.current.style.transform = `scaleX(${shown})`;
      if (goal >= 1 && shown > 0.995) {
        if (numRef.current) numRef.current.textContent = "100";
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function finish() {
      if (finished) return;
      finished = true;
      const done = () => {
        setGone(true);
        // sem intro (movimento reduzido), o scroll é liberado aqui; com
        // intro, quem libera é ele, quando termina
        if (!document.querySelector("[data-intro-video]")) lenisRef.current?.start();
      };
      if (reduced) {
        markSiteReady();
        gsap.to(root, { autoAlpha: 0, duration: 0.5, onComplete: done });
        return;
      }
      gsap
        .timeline({ onComplete: done })
        // o número espelhado vira e passa a ler direito
        .to(flipRef.current, { rotateY: 0, duration: 1.1, ease: "expo.inOut" })
        .to(root!.querySelectorAll("[data-fade]"), { autoAlpha: 0, duration: 0.4 }, 0.2)
        // e a página sobe, com o intro já tocando por baixo
        .add(() => markSiteReady(), 1.25)
        .to(
          root,
          { clipPath: "inset(0% 0% 100% 0%)", duration: 1.1, ease: "expo.inOut" },
          1.25,
        );
    }

    return () => {
      cancelAnimationFrame(raf);
      video?.removeEventListener("canplaythrough", onVideoEnough);
      video?.removeEventListener("suspend", onVideoEnough);
      imgs.forEach((img) => {
        img.onload = img.onerror = null;
      });
    };
  }, []);

  if (gone) return null;

  return (
    <div className={styles.loader} ref={rootRef} role="status" aria-label="Carregando">
      <span className={styles.brand} data-fade="">
        Da Vinci Immersive
      </span>
      <div className={styles.numWrap}>
        <div className={styles.flip} ref={flipRef}>
          <span ref={numRef}>00</span>
        </div>
      </div>
      <div className={styles.foot} data-fade="">
        <span className={styles.line}>
          <span className={styles.lineFill} ref={lineRef} />
        </span>
        <span className={styles.caption}>Leonardo escrevia ao contrário</span>
      </div>
    </div>
  );
}
