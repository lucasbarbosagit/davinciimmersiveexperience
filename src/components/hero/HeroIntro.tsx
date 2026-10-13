"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { onSiteReady } from "@/lib/siteReady";
import styles from "./Hero.module.css";

// abertura do site: o vídeo do pergaminho virando pintura a óleo cobre o
// hero, e ao terminar (ou ao pular) desvanece revelando o hero interativo
// por baixo — que já estava montado o tempo todo, só coberto. O scroll
// fica travado (lenis.stop) enquanto o vídeo estiver na frente. Ele só
// começa a tocar quando o loading sai da frente (siteReady) — antes disso
// ele já está baixando (o loading mede esse download), mas parado.
export default function HeroIntro() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [done, setDone] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishingRef = useRef(false);
  const lenis = useLenis();

  const active = !done && !prefersReducedMotion;

  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    gsap.to(overlayRef.current, {
      autoAlpha: 0,
      duration: 0.9,
      ease: "power2.inOut",
      onComplete: () => setDone(true),
    });
  }, []);

  useEffect(() => {
    if (!active || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [active, lenis]);

  // toca quando o loading sai. Rede de segurança: o play pode falhar
  // (economia de bateria, política do navegador) — se o vídeo não começar
  // em 3s depois disso, a abertura se dispensa
  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    let started = false;
    let timer = 0;
    const onPlaying = () => {
      started = true;
    };
    video.addEventListener("playing", onPlaying);
    const off = onSiteReady(() => {
      video.play().catch(() => finish());
      timer = window.setTimeout(() => {
        if (!started) finish();
      }, 3000);
    });
    return () => {
      off();
      clearTimeout(timer);
      video.removeEventListener("playing", onPlaying);
    };
  }, [active, finish]);

  if (!active) return null;

  return (
    <div className={styles.introOverlay} ref={overlayRef}>
      <video
        ref={videoRef}
        className={styles.introVideo}
        src="/assets/hero-intro.mp4"
        data-intro-video=""
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
      <button type="button" className={styles.introSkip} onClick={finish}>
        pular introdução
      </button>
    </div>
  );
}
