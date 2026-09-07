"use client";

import { useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./GallerySection.module.css";

// as quatro obras da caminhada, na ordem em que aparecem corredor adentro.
// w/h são as dimensões reais do arquivo — usadas só pra calcular a
// proporção da moldura, sem esperar o load da textura pra montar a
// geometria (mesmo truque do array ARTWORKS do Hero). artist/medium/desc
// alimentam a placa de museu que flutua ao lado de cada quadro.
const GALLERY_WORKS = [
  {
    src: "/assets/salvator-mundi.jpg",
    w: 1024,
    h: 572,
    name: "Salvator Mundi",
    year: "c. 1500",
    artist: "Leonardo da Vinci (atribuído)",
    medium: "Óleo sobre painel de nogueira",
    desc: "Cristo Salvador do Mundo: a mão direita em bênção, a esquerda segura um orbe de cristal — o mundo refletido em miniatura.",
    lightMul: 1,
  },
  {
    src: "/assets/gioconda_only.jpeg",
    w: 1376,
    h: 768,
    name: "La Gioconda",
    year: "1503 – 1519",
    artist: "Leonardo da Vinci",
    medium: "Óleo sobre álamo",
    desc: "O retrato mais estudado da história da arte. O sfumato dissolve os contornos e deixa o sorriso em aberto.",
    lightMul: 1,
  },
  {
    src: "/assets/last-supper.jpg",
    w: 2000,
    h: 762,
    name: "A Última Ceia",
    year: "1495 – 1498",
    artist: "Leonardo da Vinci",
    medium: "Têmpera e óleo sobre reboco",
    desc: "O instante exato da revelação — “um de vós me trairá”. Doze reações, um só gesto de Cristo ao centro.",
    // a paleta clara/desbotada do afresco (toalha e parede quase brancas)
    // estoura sob a mesma luz que as outras obras — spot mais fraco só
    // aqui compensa o albedo bem mais alto desta imagem específica
    lightMul: 0.4,
  },
  {
    src: "/assets/batismo-cristo.jpg",
    w: 1565,
    h: 1864,
    name: "Batismo de Cristo",
    year: "1472 – 1475",
    artist: "Verrocchio e Leonardo da Vinci",
    medium: "Óleo e têmpera sobre painel",
    desc: "O jovem Leonardo pinta o anjo à esquerda — reza a lenda que Verrocchio, ao ver, nunca mais voltou a pintar.",
    lightMul: 1,
  },
];

// arquitetura do corredor: um tubo de largura constante que segue uma
// curva (não mais uma linha reta) — a curva é que faz a caminhada virar
// um S entre as obras, alternando o lado que ela abraça a cada uma
const CORRIDOR_HALF_WIDTH = 5.4;
const FLOOR_Y = -2.4;
const CEIL_Y = 2.8;
const SPACING_Z = 9;
const FIRST_Z = -9;
const SWAY_AMP = 2.3;
const ENTRANCE_Z = 4.5;
const MAX_FRAME_W = 3.0;
const FRAME_H = 2.0;
const SAMPLES = 220;
const PANEL_PERIOD = 2.3;
const LINE_HALF_W = 0.045;
const LINE_HALO_HALF_W = 0.16;
const UPV = new THREE.Vector3(0, 1, 0);

const workZ = (i: number) => FIRST_Z - i * SPACING_Z;
const EXIT_Z = workZ(GALLERY_WORKS.length - 1) - 7;

// textura procedural das paredes: painel ranhurado (fluted panel) com um
// friso dourado em cada emenda — mais barato que modelar centenas de
// sulcos como geometria, e ilegível a essa distância a diferença não
// existe
function makeFlutedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#15110b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const flutes = 16;
  const fw = canvas.width / flutes;
  for (let i = 0; i < flutes; i++) {
    const grad = ctx.createLinearGradient(i * fw, 0, (i + 1) * fw, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.35)");
    grad.addColorStop(0.5, "rgba(255,244,220,0.07)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(i * fw, 0, fw, canvas.height);
  }

  ctx.strokeStyle = "rgba(201,162,75,0.32)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= flutes; i++) {
    ctx.beginPath();
    ctx.moveTo(i * fw, 0);
    ctx.lineTo(i * fw, canvas.height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(201,162,75,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.72);
  ctx.lineTo(canvas.width, canvas.height * 0.72);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
    renderer.setClearColor(0x0b0a07, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0a07, 7, 30);
    scene.add(new THREE.AmbientLight(0x4a3f2c, 3.2));
    // luz difusa geral do corredor (teto mais quente, chão mais escuro) —
    // sem ela só sobra o poço de luz de cada spot cercado de vazio: um
    // museu de verdade tem uma iluminação ambiente de fundo também
    scene.add(new THREE.HemisphereLight(0x6b5a3a, 0x0a0806, 2.4));

    // --- a espinha do corredor: uma curva em S passando por todas as
    // obras, não mais uma linha reta. Cada obra vira um ponto de controle
    // deslocado pro lado dela (side*SWAY_AMP); entre uma e outra a curva
    // volta pro centro (crossing) antes de se inclinar pra próxima —
    // é esse zigue-zague suave que desenha o S pedido
    const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, ENTRANCE_Z)];
    GALLERY_WORKS.forEach((_, i) => {
      const z = workZ(i);
      const onLeft = i % 2 === 0;
      const side = onLeft ? -1 : 1;
      points.push(new THREE.Vector3(0, 0, z + SPACING_Z / 2));
      points.push(new THREE.Vector3(side * SWAY_AMP, 0, z));
    });
    points.push(new THREE.Vector3(0, 0, EXIT_Z - 6.5));

    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    curve.arcLengthDivisions = 400;
    const totalLen = curve.getLength();
    const uAtWork = (i: number) => (2 * i + 2) / (points.length - 1);

    // amostra a curva uma vez pra construir toda a arquitetura (piso,
    // teto, paredes, filete) como faixas que seguem exatamente o mesmo
    // traçado que a câmera vai percorrer
    const samplePts: THREE.Vector3[] = [];
    const rights: THREE.Vector3[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const tt = i / SAMPLES;
      const p = curve.getPointAt(tt);
      const tan = curve.getTangentAt(tt).normalize();
      const r = new THREE.Vector3().crossVectors(tan, UPV).normalize();
      samplePts.push(p);
      rights.push(r);
    }
    const edgeAt = (i: number, xOffset: number, y: number) => {
      const base = samplePts[i];
      const r = rights[i];
      return new THREE.Vector3(base.x + r.x * xOffset, y, base.z + r.z * xOffset);
    };

    function buildRibbon(
      edgeA: (i: number) => THREE.Vector3,
      edgeB: (i: number) => THREE.Vector3,
      vRepeat: number,
      uPeriod: number,
    ) {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const a = edgeA(i);
        const b = edgeB(i);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const uCoord = (i / SAMPLES) * (totalLen / uPeriod);
        uvs.push(uCoord, 0, uCoord, vRepeat);
      }
      for (let i = 0; i < SAMPLES; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, c, b, b, c, d);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    }

    const floorGeo = buildRibbon(
      (i) => edgeAt(i, -CORRIDOR_HALF_WIDTH, FLOOR_Y),
      (i) => edgeAt(i, CORRIDOR_HALF_WIDTH, FLOOR_Y),
      1,
      PANEL_PERIOD,
    );
    const ceilGeo = buildRibbon(
      (i) => edgeAt(i, -CORRIDOR_HALF_WIDTH, CEIL_Y),
      (i) => edgeAt(i, CORRIDOR_HALF_WIDTH, CEIL_Y),
      1,
      PANEL_PERIOD,
    );
    const leftWallGeo = buildRibbon(
      (i) => edgeAt(i, -CORRIDOR_HALF_WIDTH, FLOOR_Y),
      (i) => edgeAt(i, -CORRIDOR_HALF_WIDTH, CEIL_Y),
      1,
      PANEL_PERIOD,
    );
    const rightWallGeo = buildRibbon(
      (i) => edgeAt(i, CORRIDOR_HALF_WIDTH, FLOOR_Y),
      (i) => edgeAt(i, CORRIDOR_HALF_WIDTH, CEIL_Y),
      1,
      PANEL_PERIOD,
    );
    const lineGeo = buildRibbon(
      (i) => edgeAt(i, -LINE_HALF_W, FLOOR_Y + 0.02),
      (i) => edgeAt(i, LINE_HALF_W, FLOOR_Y + 0.02),
      1,
      totalLen,
    );
    const lineHaloGeo = buildRibbon(
      (i) => edgeAt(i, -LINE_HALO_HALF_W, FLOOR_Y + 0.018),
      (i) => edgeAt(i, LINE_HALO_HALF_W, FLOOR_Y + 0.018),
      1,
      totalLen,
    );

    const flutedTex = makeFlutedTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: flutedTex,
      roughness: 0.85,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f0d09,
      roughness: 0.32,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x100d09,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9bc7a });
    lineMat.fog = false;
    const lineHaloMat = new THREE.MeshBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lineHaloMat.fog = false;

    scene.add(new THREE.Mesh(floorGeo, floorMat));
    scene.add(new THREE.Mesh(ceilGeo, ceilMat));
    scene.add(new THREE.Mesh(leftWallGeo, wallMat));
    scene.add(new THREE.Mesh(rightWallGeo, wallMat));
    scene.add(new THREE.Mesh(lineGeo, lineMat));
    scene.add(new THREE.Mesh(lineHaloGeo, lineHaloMat));

    // uma brasa dourada bem no fundo do corredor — o "ainda tem mais luz
    // lá adiante" que convida a continuar rolando até o fim
    const exitGlow = new THREE.PointLight(0xd9bc7a, 60, 45, 1);
    exitGlow.position.set(0, 0.6, EXIT_Z - 4);
    scene.add(exitGlow);

    // sem isso o fim do corredor é um vão vazio: uma luz puntual não tem
    // NADA pra iluminar depois da última parede, então em vez de um
    // brilho convidativo aparece um retângulo preto. Um arco emissivo
    // (fog=false: nunca apaga com a distância) tapa esse vão com luz
    // de verdade
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
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x241f18,
      roughness: 0.4,
      metalness: 0.6,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf3d9a4,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    beamMat.fog = false;

    // busca por amostragem o parâmetro de arco (0-1, o mesmo que o
    // progresso do scroll usa) mais próximo de um ponto 3D dado — usado
    // pra achar em que instante do scroll cada obra fica "no auge",
    // já que o ponto de controle da obra vive na parametrização crua
    // da curva, não na de comprimento de arco
    function findArcT(target: THREE.Vector3): number {
      let best = 0;
      let bestDist = Infinity;
      const N = 400;
      for (let k = 0; k <= N; k++) {
        const tt = k / N;
        const d = curve.getPointAt(tt).distanceToSquared(target);
        if (d < bestDist) {
          bestDist = d;
          best = tt;
        }
      }
      return best;
    }

    const peaks: number[] = [];
    const paintingLookTargets: THREE.Vector3[] = [];
    const placardAnchors: THREE.Vector3[] = [];

    GALLERY_WORKS.forEach((work, i) => {
      const onLeft = i % 2 === 0;
      const side = onLeft ? -1 : 1;
      const u = uAtWork(i);
      const centerPt = curve.getPoint(u);
      const tangent = curve.getTangent(u).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, UPV).normalize();
      const heading = Math.atan2(tangent.x, tangent.z);

      const wallPos = centerPt.clone().add(right.clone().multiplyScalar(side * (CORRIDOR_HALF_WIDTH - 0.05)));
      wallPos.y = 0.1;

      const aspect = work.w / work.h;
      let frameW = FRAME_H * aspect;
      let frameH = FRAME_H;
      if (frameW > MAX_FRAME_W) {
        frameW = MAX_FRAME_W;
        frameH = MAX_FRAME_W / aspect;
      }

      const group = new THREE.Group();
      group.position.copy(wallPos);
      group.rotation.y = heading + Math.PI + (onLeft ? Math.PI / 2 : -Math.PI / 2);
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

      // trilho de museu real: fixture + feixe cônico translúcido são só
      // cosméticos — quem ilumina de fato é o SpotLight, com cone e
      // penumbra de verdade em vez do PointLight difuso da versão anterior
      const fixtureY = frameH / 2 + 0.9;
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.22, 10), fixtureMat);
      fixture.position.set(0, fixtureY, 1.5);
      fixture.rotation.x = Math.PI;
      group.add(fixture);

      const beamHeight = fixtureY - (frameH / 2 - 0.1);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, beamHeight, 20, 1, true),
        beamMat,
      );
      beam.position.set(0, fixtureY - beamHeight / 2, 1.15);
      group.add(beam);
      disposables.push({
        dispose: () => {
          fixture.geometry.dispose();
          beam.geometry.dispose();
        },
      });

      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 0, 0.05);
      group.add(spotTarget);
      const spot = new THREE.SpotLight(
        0xffdca8,
        56 * work.lightMul,
        16,
        THREE.MathUtils.degToRad(40),
        0.7,
        1,
      );
      spot.position.set(0, fixtureY, 1.5);
      spot.target = spotTarget;
      group.add(spot);

      peaks[i] = findArcT(centerPt);
      paintingLookTargets[i] = group.position.clone();
      const anchorLocal = new THREE.Vector3(-(frameW / 2 + 1.0), 0, 0.15);
      placardAnchors[i] = anchorLocal
        .clone()
        .applyAxisAngle(UPV, group.rotation.y)
        .add(group.position);
    });

    let width = 1;
    let height = 1;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // bloom conservador: só os acentos dourados (filete, brasa, feixes de
    // luz) passam do limiar — a intenção é o brilho de um museu de
    // verdade, não estourar o branco das próprias telas
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.3, 0.95);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    function resize() {
      width = container!.clientWidth;
      height = container!.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      composer.setSize(width, height);
      composer.setPixelRatio(renderer.getPixelRatio());
      bloomPass.setSize(width, height);
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
    // meio-comprimento (em progresso 0-1) da janela onde a placa fica
    // acesa — dá tempo de ler artista/data/descrição antes de apagar
    const CAPTION_HALF_WINDOW = 0.1;
    const BLEND_WINDOW = 0.08;

    function updateFrame(progress: number) {
      const t = THREE.MathUtils.clamp(progress, 0, 1);
      const pos = curve.getPointAt(t);
      const aheadPos = curve.getPointAt(Math.min(t + 0.012, 1));
      // leve balanço vertical: não é um trilho rígido de câmera, é uma
      // caminhada — o S da própria curva já cuida do sway lateral
      const bob = Math.sin(progress * Math.PI * 14) * 0.03;
      camera.position.set(pos.x, 0.3 + bob, pos.z);

      // olha um pouco à frente no trajeto por padrão, mas quando a obra
      // mais próxima está no auge o olhar vira parcialmente pra ela —
      // o giro de cabeça de quem caminha e se detém a admirar o quadro
      const lookTarget = new THREE.Vector3(aheadPos.x, 0.25, aheadPos.z);
      let nearestIdx = -1;
      let nearestDist = Infinity;
      peaks.forEach((peak, i) => {
        const d = Math.abs(t - peak);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      });
      if (nearestIdx >= 0 && nearestDist < BLEND_WINDOW) {
        const w = (1 - nearestDist / BLEND_WINDOW) * 0.22;
        lookTarget.lerp(paintingLookTargets[nearestIdx], w);
      }
      camera.lookAt(lookTarget);

      captions.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(t - peaks[i]);
        const opacity = Math.max(0, 1 - dist / CAPTION_HALF_WINDOW);
        if (opacity <= 0.002) {
          el.style.opacity = "0";
          return;
        }
        const ndc = placardAnchors[i].clone().project(camera);
        if (ndc.z > 1 || ndc.z < -1) {
          el.style.opacity = "0";
          return;
        }
        const px = (ndc.x * 0.5 + 0.5) * width;
        const py = (1 - (ndc.y * 0.5 + 0.5)) * height;
        el.style.opacity = String(opacity);
        el.style.transform = `translate(${px}px, ${py}px) translate(-100%, -50%)`;
      });

      if (t > 0.03) revealNav();
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
      composer.render();
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
      floorMat.dispose();
      ceilMat.dispose();
      lineMat.dispose();
      lineHaloMat.dispose();
      flutedTex.dispose();
      frameMat.dispose();
      fixtureMat.dispose();
      beamMat.dispose();
      archMat.dispose();
      disposables.forEach((d) => d.dispose());
      bloomPass.dispose();
      composer.dispose();
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
          <div className={styles.captionMeta}>
            <span>{work.artist}</span>
            <span>{work.medium}</span>
          </div>
          <p className={styles.captionDesc}>{work.desc}</p>
        </div>
      ))}
    </section>
  );
}
