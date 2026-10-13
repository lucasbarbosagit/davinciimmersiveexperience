"use client";

import { useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// Precisa ser um descendente de <ReactLenis> — é o contexto dele que
// o hook useLenis lê, então não pode ficar no mesmo componente que o declara.
function LenisScrollTriggerBridge() {
  const lenis = useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    if (!lenis) return;
    const instance = lenis;

    function update(time: number) {
      instance.raf(time * 1000);
    }

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(update);
  }, [lenis]);

  return null;
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.1, duration: 1.2 }}>
      <LenisScrollTriggerBridge />
      {children}
    </ReactLenis>
  );
}
