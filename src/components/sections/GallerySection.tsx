"use client";

import { useRef } from "react";
import * as THREE from "three";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";

// as quatro obras da caminhada, na ordem em que aparecem corredor adentro.
// w/h são as dimensões reais do arquivo — usadas só pra calcular a
// proporção da moldura, não carregadas via TextureLoader.image (evita
// esperar o load pra montar a geometria, como o resto do projeto já faz
// no array ARTWORKS do Hero)
const GALLERY_WORKS = [
  { src: "/assets/salvator-mundi.jpg", w: 1024, h: 572, name: "Salvator Mundi", year: "c. 1500" },
  { src: "/assets/gioconda_only.jpeg", w: 1376, h: 768, name: "La Gioconda", year: "1503 – 1519" },
  { src: "/assets/last-supper.jpg", w: 2000, h: 762, name: "A Última Ceia", year: "1495 – 1498" },
  { src: "/assets/batismo-cristo.jpg", w: 1565, h: 1864, name: "Batismo de Cristo", year: "1472 – 1475" },
];

const CORRIDOR_HALF_WIDTH = 3.6;
const FLOOR_Y = -2.4;
const CEIL_Y = 2.8;
const SPACING_Z = 9;
const FIRST_Z = -9;
const START_CAMERA_Z = 1.5;
const MAX_FRAME_W = 4.4;
const FRAME_H = 2.6;

// posição (z) de cada obra e o ponto de saída do corredor — usados tanto
// pra plantar as molduras quanto pra mapear caption <-> progresso do scroll
const workZ = (i: number) => FIRST_Z - i * SPACING_Z;
const EXIT_Z = workZ(GALLERY_WORKS.length - 1) - 7;
const zToProgress = (z: number) => (START_CAMERA_Z - z) / (START_CAMERA_Z - EXIT_Z);

export default function GallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const section = sectionRef.current;
    const container = containerRef.current;
    const siteNav = document.getElementById("site-nav");
    const siteDeskNav = document.getElementById("site-desk-nav");
    if (!section || !container) return;

    let disposed = false;
    let rafId = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // mesmo tom de --ink do resto do site: sem isso a névoa distante do
    // corredor não se funde com o fundo real da página atrás/ao redor
    renderer.setClearColor(0x0b0a07, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0.3, START_CAMERA_Z);

    const scene = new THREE.Scene();
    // a névoa é o mecanismo real de "revelar andando": cada obra nasce
    // apagada na distância e ganha nitidez conforme a câmera se aproxima
    // — mais barato e mais orgânico que animar intensidade de luz a cada
    // frame com base na posição do scroll
    scene.fog = new THREE.Fog(0x0b0a07, 7, 30);

    // intensidades bem acima do que pareceria razoável "no papel": esta
    // versão do Three trata luzes puntuais em candela (unidades físicas
    // reais), não mais o multiplicador solto de versões antigas — os
    // valores de exemplo da documentação antiga (intensity ~1) ficam
    // praticamente pretos aqui. Cena estilizada, não fotorreal, então
    // não há problema em exagerar até ficar visualmente certo.
    scene.add(new THREE.AmbientLight(0x4a3f2c, 1.6));

    // arquitetura mínima e estilizada (não fotorreal): piso, teto, paredes
    // num tom escuro só pra dar profundidade à névoa, mais um filete
    // dourado nas quinas — ecoa a grade de prancheta técnica do hero
    const corridorLength = Math.abs(EXIT_Z) + 20;
    const corridorZ = -corridorLength / 2 + 6;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x14110c,
      roughness: 0.95,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CORRIDOR_HALF_WIDTH * 2, corridorLength), wallMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, corridorZ);
    scene.add(floor);

    const ceiling = floor.clone();
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CEIL_Y, corridorZ);
    scene.add(ceiling);

    const wallGeo = new THREE.PlaneGeometry(corridorLength, CEIL_Y - FLOOR_Y);
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-CORRIDOR_HALF_WIDTH, (CEIL_Y + FLOOR_Y) / 2, corridorZ);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(CORRIDOR_HALF_WIDTH, (CEIL_Y + FLOOR_Y) / 2, corridorZ);
    scene.add(rightWall);

    const trimMat = new THREE.MeshBasicMaterial({ color: 0xc9a24b });
    const trimGeo = new THREE.BoxGeometry(0.04, 0.04, corridorLength);
    for (const x of [-CORRIDOR_HALF_WIDTH + 0.02, CORRIDOR_HALF_WIDTH - 0.02]) {
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(x, FLOOR_Y + 0.02, corridorZ);
      scene.add(trim);
    }

    // uma brasa dourada bem no fundo do corredor — o "ainda tem mais luz
    // lá adiante" que convida a continuar rolando até o fim
    const exitGlow = new THREE.PointLight(0xd9bc7a, 60, 45, 1);
    exitGlow.position.set(0, 0.6, EXIT_Z - 4);
    scene.add(exitGlow);

    // sem isso o fim do corredor é um vão vazio: uma luz puntual não tem
    // NADA pra iluminar depois da última parede (o corredor não tem tampa
    // no fundo), então em vez de um brilho convidativo aparece um retângulo
    // preto — a cor de fundo/névoa sem nenhuma superfície refletindo a
    // brasa. Um arco emissivo (material.fog=false: sempre no brilho
    // máximo, a distância não apaga) tapa esse vão com luz de verdade.
    const archMat = new THREE.MeshBasicMaterial({ color: 0xf3d9a4 });
    archMat.fog = false;
    const arch = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR_HALF_WIDTH * 1.7, CEIL_Y - FLOOR_Y - 0.4),
      archMat,
    );
    arch.position.set(0, (CEIL_Y + FLOOR_Y) / 2, EXIT_Z - 6);
    scene.add(arch);

    const loader = new THREE.TextureLoader();
    const disposables: { dispose: () => void }[] = [];
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xb08d3f,
      roughness: 0.4,
      metalness: 0.55,
    });

    GALLERY_WORKS.forEach((work, i) => {
      const z = workZ(i);
      const onLeft = i % 2 === 0;
      const x = onLeft ? -CORRIDOR_HALF_WIDTH + 0.03 : CORRIDOR_HALF_WIDTH - 0.03;

      const aspect = work.w / work.h;
      let frameW = FRAME_H * aspect;
      let frameH = FRAME_H;
      if (frameW > MAX_FRAME_W) {
        frameW = MAX_FRAME_W;
        frameH = MAX_FRAME_W / aspect;
      }

      const group = new THREE.Group();
      group.position.set(x, 0.1, z);
      group.rotation.y = onLeft ? Math.PI / 2 : -Math.PI / 2;
      scene.add(group);

      const backing = new THREE.Mesh(
        new THREE.PlaneGeometry(frameW + 0.28, frameH + 0.28),
        frameMat,
      );
      backing.position.z = -0.04;
      group.add(backing);

      const texture = loader.load(work.src);
      texture.colorSpace = THREE.SRGBColorSpace;
      disposables.push(texture);
      const artMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
      disposables.push(artMat);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), artMat);
      group.add(art);

      // luz de museu: um ponto quente na frente de cada quadro — junto
      // com a névoa é o que faz o quadro "acender" quando a câmera chega
      const spot = new THREE.PointLight(0xffdca8, 24, 8.5, 1);
      spot.position.set(0, frameH / 2 + 0.5, 1.3);
      group.add(spot);
    });

    let width = 1;
    let height = 1;
    function resize() {
      width = container!.clientWidth;
      height = container!.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // nav volta a aparecer assim que a galeria assume — só uma vez,
    // guardado por flag, igual ao padrão já usado no killOrbGlow do Hero
    let navRevealed = false;
    const revealNav = () => {
      if (navRevealed) return;
      navRevealed = true;
      gsap.to([siteNav, siteDeskNav], { autoAlpha: 1, duration: 0.5, ease: "none" });
    };

    const captions = captionRefs.current;
    const peaks = GALLERY_WORKS.map((_, i) => zToProgress(workZ(i)));
    // meio-comprimento (em progresso 0-1) da janela onde a legenda fica
    // acesa — dá tempo de ler antes de apagar pra próxima
    const CAPTION_HALF_WINDOW = 0.09;

    function updateFrame(progress: number) {
      const z = gsap.utils.interpolate(START_CAMERA_Z, EXIT_Z, progress);
      // leve sway lateral + balanço vertical: não é um trilho rígido de
      // câmera, é uma caminhada — a frequência maior que o total de
      // obras garante que o sway não sincronize por acidente com elas
      const sway = Math.sin(progress * Math.PI * 7) * 0.12;
      const bob = Math.sin(progress * Math.PI * 14) * 0.03;
      camera.position.set(sway, 0.3 + bob, z);
      camera.lookAt(sway * 0.4, 0.25, z - 6);

      captions.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(progress - peaks[i]);
        const opacity = Math.max(0, 1 - dist / CAPTION_HALF_WINDOW);
        el.style.opacity = String(opacity);
        el.style.transform = `translateY(${(1 - opacity) * 14}px)`;
      });

      if (progress > 0.04) revealNav();
    }
    updateFrame(0);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=420%",
      scrub: true,
      pin: true,
      onUpdate: (self) => updateFrame(self.progress),
    });

    function tick() {
      if (disposed) return;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      trigger.kill();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      wallMat.dispose();
      wallGeo.dispose();
      trimGeo.dispose();
      trimMat.dispose();
      frameMat.dispose();
      archMat.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <section className={styles.galleryFallback} id="galeria">
        <span className={styles.fallbackEyebrow}>A coleção</span>
        <h2>As obras da jornada</h2>
        <div className={styles.fallbackGrid}>
          {GALLERY_WORKS.map((work) => (
            <figure key={work.src} className={styles.fallbackItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={work.src} alt={work.name} />
              <figcaption>
                <strong>{work.name}</strong>
                <span>{work.year}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.galleryPin} id="galeria" ref={sectionRef}>
      <div className={styles.galleryCanvas} ref={containerRef} />
      <div className={styles.galleryScrim} />
      {GALLERY_WORKS.map((work, i) => (
        <div
          key={work.src}
          className={styles.caption}
          ref={(el) => {
            captionRefs.current[i] = el;
          }}
        >
          <span className={styles.captionEyebrow}>{work.year}</span>
          <h2>{work.name}</h2>
        </div>
      ))}
    </section>
  );
}
