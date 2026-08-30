"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./Hero.module.css";

type ObjectSlotProps = {
  src: string;
  alt: string;
  label: string;
  style: CSSProperties;
  slotRef: (el: HTMLDivElement | null) => void;
};

// Não depende de onError: com SSR o navegador pode resolver (ou falhar) o
// fetch da imagem antes da hidratação terminar, e o listener de erro do
// React nunca chega a ser anexado a tempo. Em vez disso a imagem começa
// escondida e só aparece quando temos certeza de que carregou de verdade.
export default function ObjectSlot({ src, alt, label, style, slotRef }: ObjectSlotProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    // cobre o caso em que o carregamento (sucesso ou 404) já resolveu
    // antes deste efeito rodar — o onLoad sozinho perderia essa corrida
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className={styles.floatingSlot} style={style} ref={slotRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{ display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && <span className={styles.slotLabel}>{label}</span>}
    </div>
  );
}
