"use client";

import { useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
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
// "andar e parar": a caminhada não avança em velocidade constante — perto
// de cada obra o tempo (progresso de scroll) rende bem menos distância
// percorrida na curva, como alguém que chega, para e observa, antes de
// seguir depressa até a próxima. DWELL_SIGMA é a largura (em t de arco,
// 0-1) da janela de desaceleração ao redor de cada obra; DWELL_STRENGTH
// é o quanto mais devagar o tempo passa bem no auge dela
const DWELL_SIGMA = 0.032;
const DWELL_STRENGTH = 3.4;
const WARP_SAMPLES = 800;
const UPV = new THREE.Vector3(0, 1, 0);

const workZ = (i: number) => FIRST_Z - i * SPACING_Z;
const EXIT_Z = workZ(GALLERY_WORKS.length - 1) - 7;

// textura procedural das paredes: painel ranhurado (fluted panel), cor
// E relevo (normal map) derivados do mesmo perfil analítico de sulco —
// é o relevo de verdade (reagindo à luz de cada spot) que faz a parede
// ler como arquitetura, não como uma textura pintada por cima de um
// plano chapado. Mais barato que modelar os sulcos como geometria, e a
// essa distância a diferença de silhueta não existe.
function makeFlutedMaps(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const W = 512;
  const H = 8;
  const flutes = 18;
  const fw = W / flutes;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cctx = colorCanvas.getContext("2d")!;

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = W;
  normalCanvas.height = H;
  const nctx = normalCanvas.getContext("2d")!;

  for (let x = 0; x < W; x++) {
    const local = (x % fw) / fw;
    // perfil côncavo do sulco: pico (0/1) nas emendas, vale no meio —
    // a derivada desse mesmo cosseno vira a inclinação usada no normal map
    const slope = -Math.sin(local * Math.PI * 2);
    const shade = Math.cos(local * Math.PI * 2); // +1 na emenda, -1 no fundo do vale

    // cor: cinza-chumbo neutro e frio (não mais sépia quente) — só o
    // relevo dá variação, a cor em si é quase plana
    const base = 22 + shade * 7;
    cctx.fillStyle = `rgb(${base}, ${base + 1}, ${base + 3})`;
    cctx.fillRect(x, 0, 1, H);

    // normal map: inclinação só no eixo X (sulcos verticais), Z sempre
    // dominante — força do relevo moderada pra não parecer plástico
    const nStrength = 0.55;
    const nx = slope * nStrength;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    const r = Math.round((nx * 0.5 + 0.5) * 255);
    const g = 128;
    const b = Math.round(nz * 255);
    nctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    nctx.fillRect(x, 0, 1, H);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, normalMap };
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
    renderer.setClearColor(0x0a0a0c, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // sombra de verdade (mapa, não só SSAO de contato): é o que faz o
    // pedestal "pesar" no chão e o quadro se destacar da parede em vez de
    // flutuar sob luz plana — soft shadow map porque a referência tem
    // penumbra suave, não uma sombra dura de recorte
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0c, 7, 30);
    // paleta neutra e fria (a referência é cinza-chumbo, não sépia) — o
    // dourado fica reservado aos acentos (filete, spots, moldura)
    scene.add(new THREE.AmbientLight(0x3a3c42, 3.2));
    // luz difusa geral do corredor (teto mais claro, chão mais escuro) —
    // sem ela só sobra o poço de luz de cada spot cercado de vazio: um
    // museu de verdade tem uma iluminação ambiente de fundo também
    scene.add(new THREE.HemisphereLight(0x50525a, 0x08080a, 2.4));

    // ambiente PMREM simples (um gradiente, não uma foto real): dá às
    // superfícies metalizadas/polidas (piso, parede) um brilho de reflexo
    // sutil sem precisar de um espelho de verdade — o que a referência
    // resolve com path-tracing, aqui é só um sheen barato e plausível
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envCanvas = document.createElement("canvas");
    envCanvas.width = 8;
    envCanvas.height = 128;
    const envCtx = envCanvas.getContext("2d")!;
    const envGrad = envCtx.createLinearGradient(0, 0, 0, envCanvas.height);
    envGrad.addColorStop(0, "#3a3d44");
    envGrad.addColorStop(0.45, "#141519");
    envGrad.addColorStop(1, "#020203");
    envCtx.fillStyle = envGrad;
    envCtx.fillRect(0, 0, envCanvas.width, envCanvas.height);
    const envSourceTex = new THREE.CanvasTexture(envCanvas);
    envSourceTex.mapping = THREE.EquirectangularReflectionMapping;
    envSourceTex.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmrem.fromEquirectangular(envSourceTex);
    scene.environment = envRT.texture;
    envSourceTex.dispose();

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
    // trilho contínuo de luz no teto (canaleta escura embutida) — a
    // referência não ilumina cada quadro com uma luminária isolada
    // flutuando no meio da sala, e sim um trilho corrido de museu
    const trackGeo = buildRibbon(
      (i) => edgeAt(i, -0.16, CEIL_Y - 0.06),
      (i) => edgeAt(i, 0.16, CEIL_Y - 0.06),
      1,
      totalLen,
    );

    const { map: flutedTex, normalMap: flutedNormal } = makeFlutedMaps();
    const wallMat = new THREE.MeshStandardMaterial({
      map: flutedTex,
      normalMap: flutedNormal,
      normalScale: new THREE.Vector2(1, 1),
      roughness: 0.72,
      metalness: 0.12,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121317,
      roughness: 0.22,
      metalness: 0.35,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x121317,
      roughness: 0.9,
      envMapIntensity: 0.4,
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
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.3,
      metalness: 0.8,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.receiveShadow = true;
    scene.add(ceilMesh);
    const leftWallMesh = new THREE.Mesh(leftWallGeo, wallMat);
    leftWallMesh.receiveShadow = true;
    scene.add(leftWallMesh);
    const rightWallMesh = new THREE.Mesh(rightWallGeo, wallMat);
    rightWallMesh.receiveShadow = true;
    scene.add(rightWallMesh);
    scene.add(new THREE.Mesh(trackGeo, trackMat));
    scene.add(new THREE.Mesh(lineGeo, lineMat));

    // fileira de pequenos downlights embutidos no trilho, regularmente
    // espaçados — o que faz o teto ler como uma instalação de museu de
    // verdade em vez de um ponto de luz isolado por quadro
    const downlightGeo = new THREE.CircleGeometry(0.09, 16);
    const downlightMat = new THREE.MeshBasicMaterial({ color: 0xfbe8bd });
    downlightMat.fog = false;
    const DOWNLIGHT_STEP = 14;
    for (let i = 0; i <= SAMPLES; i += DOWNLIGHT_STEP) {
      const p = samplePts[i];
      const dl = new THREE.Mesh(downlightGeo, downlightMat);
      dl.position.set(p.x, CEIL_Y - 0.061, p.z);
      dl.rotation.x = Math.PI / 2;
      scene.add(dl);
    }
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
    // o pedestal: mesma pedra fosca do chão, só um pouco mais clara pra
    // não sumir contra ele — é o que ancora a obra no espaço em vez de
    // deixá-la flutuando isolada na parede, igual à referência
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d22,
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.3,
    });
    // sem luz, cor chapada — igual a TODO outro acento dourado da cena
    // (filete do chão, halo, arco de saída). Um metal de verdade tão
    // perto do spot vira hotspot especular que o bloom espalha numa
    // coluna vertical de luz no ar — o exato "raio" que já tinha sido
    // removido antes; unlit evita reintroduzir o mesmo bug por outra via
    const pedestalTrimMat = new THREE.MeshBasicMaterial({ color: 0xc9a24b });
    pedestalTrimMat.fog = false;

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
      // NÃO cast shadow: a moldura fica quase coplanar com a própria
      // parede atrás dela (a mesma faixa que ela recebe sombra) — deixar
      // as duas trocarem sombra a essa distância quase nula é receita
      // pra shadow acne, que virou uma coluna de luz vazando através do
      // bloom. Só o pedestal (bem separado da parede) precisa projetar
      // sombra de verdade
      backing.receiveShadow = true;
      group.add(backing);

      const texture = loader.load(work.src);
      texture.colorSpace = THREE.SRGBColorSpace;
      disposables.push(texture);
      const artMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
      disposables.push(artMat);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), artMat);
      group.add(art);

      // pedestal de museu: uma base baixa e sólida encostada na parede,
      // logo abaixo do quadro, com um filete de latão na borda de cima —
      // sem ele o quadro fica "colado" na parede vazia; com ele a obra
      // ganha um chão de exposição de verdade, e uma sombra de contato
      // real (não só o SSAO) pra grudar no piso
      const pedW = frameW * 0.62;
      const pedH = 1.0;
      const pedD = 0.55;
      const pedFrontZ = pedD / 2 + 0.12;
      const localFloorY = FLOOR_Y - group.position.y;
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(pedW, pedH, pedD), pedestalMat);
      pedestal.position.set(0, localFloorY + pedH / 2, pedFrontZ);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      group.add(pedestal);

      const trimH = 0.035;
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(pedW + 0.04, trimH, pedD + 0.04),
        pedestalTrimMat,
      );
      trim.position.set(0, localFloorY + pedH + trimH / 2, pedFrontZ);
      trim.castShadow = true;
      group.add(trim);

      // luminária discreta embutida perto do teto — sem feixe cônico
      // visível: a referência não tem um "raio de luz" no ar, só a
      // fixture e o poço de luz que ela projeta na parede/quadro
      const fixtureY = Math.min(CEIL_Y - 0.15, frameH / 2 + 0.85);
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 12), fixtureMat);
      fixture.position.set(0, fixtureY, 0.9);
      fixture.rotation.x = Math.PI;
      group.add(fixture);
      disposables.push({
        dispose: () => {
          fixture.geometry.dispose();
        },
      });

      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 0, 0.05);
      group.add(spotTarget);
      const spot = new THREE.SpotLight(
        0xffdca8,
        42 * work.lightMul,
        // alcance mais curto e cone mais fechado que antes: o spot foi
        // recalibrado numa cena sem pedestal, e um cone largo de longo
        // alcance (16, 42°) vazava luz demais bem no topo do pedestal —
        // que fica quase no eixo do feixe — estourando com o bloom numa
        // coluna. Focado na obra em vez de continuar até o chão
        7.5,
        THREE.MathUtils.degToRad(36),
        0.75,
        1,
      );
      spot.position.set(0, fixtureY, 0.9);
      spot.target = spotTarget;
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      spot.shadow.bias = -0.0018;
      spot.shadow.radius = 3;
      spot.shadow.camera.near = 0.3;
      spot.shadow.camera.far = 8;
      group.add(spot);

      peaks[i] = findArcT(centerPt);
      paintingLookTargets[i] = group.position.clone();
      // âncora da placa: o próprio centro do quadro, não um ponto
      // deslocado ao lado dele. Deslocar em espaço de mundo (por tangent/
      // right, ou girando um vetor local pela rotation.y do grupo) virou
      // uma sucessão de casos-de-borda diferentes por obra — cada uma
      // tem seu próprio heading local, e um deslocamento que funciona
      // numa vira a câmera pelas costas na outra. O quadro em si SEMPRE
      // está na frente da câmera (é o que a cena renderiza), então usar
      // o centro dele é a âncora robusta; o afastamento visual da placa
      // em relação ao quadro é feito depois, em pixels de tela, não em
      // metros de mundo
      placardAnchors[i] = group.position.clone();
    });

    // mapa de "andar e parar": distribui o progresso do scroll ao longo
    // da curva de forma NÃO linear — devagar (mais scroll por metro
    // andado) perto de cada pico, rápido no vão entre um quadro e outro.
    // warpP[k]/warpU[k] são pares (progresso acumulado, posição na curva)
    // amostrados uniformemente em u; dado um progresso de scroll cru,
    // busca-se por interpolação onde ele cai nessa tabela pra achar o t
    // real de arco a usar na câmera
    const warpU = new Float32Array(WARP_SAMPLES + 1);
    const warpP = new Float32Array(WARP_SAMPLES + 1);
    let cumulative = 0;
    for (let k = 0; k <= WARP_SAMPLES; k++) {
      const u = k / WARP_SAMPLES;
      let weight = 1;
      for (const peak of peaks) {
        const d = (u - peak) / DWELL_SIGMA;
        weight += DWELL_STRENGTH * Math.exp(-d * d);
      }
      if (k > 0) cumulative += weight / WARP_SAMPLES;
      warpU[k] = u;
      warpP[k] = cumulative;
    }
    const warpTotal = warpP[WARP_SAMPLES] || 1;
    for (let k = 0; k <= WARP_SAMPLES; k++) warpP[k] /= warpTotal;

    function warpProgressToU(p: number): number {
      let lo = 0;
      let hi = WARP_SAMPLES;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (warpP[mid] < p) lo = mid + 1;
        else hi = mid;
      }
      if (lo === 0) return warpU[0];
      const p0 = warpP[lo - 1];
      const p1 = warpP[lo];
      const u0 = warpU[lo - 1];
      const u1 = warpU[lo];
      const f = p1 > p0 ? (p - p0) / (p1 - p0) : 0;
      return u0 + (u1 - u0) * f;
    }

    let width = 1;
    let height = 1;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // sombra de contato (SSAO): é o que faz o chão/parede grudar no
    // objeto em vez de flutuar sob luz plana — sem isso nenhuma
    // quantidade de spot deixa a cena "presa ao chão" como a referência
    const ssaoPass = new SSAOPass(scene, camera, 1, 1, 12);
    ssaoPass.kernelRadius = 0.4;
    ssaoPass.minDistance = 0.001;
    ssaoPass.maxDistance = 0.08;
    composer.addPass(ssaoPass);
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
      // SSAO em resolução cheia é caro demais pro ganho visual — meia
      // resolução (borrada em seguida pelo próprio pass) já basta
      ssaoPass.setSize(Math.round(width / 2), Math.round(height / 2));
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
    const BLEND_WINDOW = 0.09;

    function updateFrame(progress: number) {
      const rawT = THREE.MathUtils.clamp(progress, 0, 1);
      // progresso de scroll -> posição real na curva, já passando pelo
      // mapa de "andar e parar" (devagar nos picos, rápido nos vãos)
      const t = warpProgressToU(rawT);
      const pos = curve.getPointAt(t);
      const aheadPos = curve.getPointAt(Math.min(t + 0.012, 1));
      // leve balanço vertical de passo — atado a t (posição real andada),
      // não ao progresso de scroll cru: parado no auge de uma obra o
      // corpo quase não balança, e acelera de novo assim que retoma a
      // caminhada até a próxima
      const bob = Math.sin(t * Math.PI * 14) * 0.03;
      camera.position.set(pos.x, 0.3 + bob, pos.z);

      // olha um pouco à frente no trajeto por padrão, mas quando a obra
      // mais próxima está no auge o olhar vira quase inteiramente pra
      // ela — o giro de cabeça de quem chega, para e realmente encara o
      // quadro, não só de relance a caminho da próxima
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
        const w = (1 - nearestDist / BLEND_WINDOW) * 0.62;
        lookTarget.lerp(paintingLookTargets[nearestIdx], w);
      }
      camera.lookAt(lookTarget);
      // sem isso, matrixWorld/matrixWorldInverse só são recalculados
      // dentro do PRÓXIMO renderer.render() — .project(camera) logo
      // abaixo usaria a câmera de UM FRAME ATRÁS (posição/rotação já
      // novas, matriz ainda velha), projetando a âncora como se a
      // câmera ainda estivesse na pose anterior. É esse descompasso,
      // não a geometria em si, que fazia a placa parecer "atrás" da
      // câmera bem nos instantes em que ela girava mais rápido
      camera.updateMatrixWorld();

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
        // ancorado no centro do quadro em 3D, mas separado dele em
        // PIXELS de tela (não em metros de mundo) — o afastamento visual
        // não depende então de quão perto/zoom a câmera está do quadro
        const px = (ndc.x * 0.5 + 0.5) * width - 90;
        const py = (1 - (ndc.y * 0.5 + 0.5)) * height;
        el.style.opacity = String(opacity);
        el.style.transform = `translate(${px}px, ${py}px) translate(-100%, -50%)`;
      });

      // só reaparece perto do fim da caminhada, não logo na entrada — o
      // menu por cima do corredor tirava a imersão pedida
      if (t > 0.94) revealNav();
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
      flutedNormal.dispose();
      frameMat.dispose();
      fixtureMat.dispose();
      pedestalMat.dispose();
      pedestalTrimMat.dispose();
      trackMat.dispose();
      downlightMat.dispose();
      archMat.dispose();
      envRT.dispose();
      pmrem.dispose();
      disposables.forEach((d) => d.dispose());
      ssaoPass.dispose();
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
