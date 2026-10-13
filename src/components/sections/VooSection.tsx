"use client";

import { useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import SplitChars from "@/components/ui/SplitChars";
import { createPacioli, VITRUVIAN_SQUARE } from "./pacioliSolid";
import styles from "./VooSection.module.css";

// Ato depois da galeria: a câmera da galeria acabou de afundar no escuro,
// e é desse escuro que a próxima coisa nasce. O ornitóptero aparece
// primeiro como TRAÇO (as arestas do próprio modelo, em linha dourada,
// se desenhando do centro pra fora como tinta) e depois ganha CORPO por
// trás das linhas, na mesma ordem — a tese do site inteiro (do estudo ao
// objeto) dita em 3D. O scroll gira a máquina e o usuário pode arrastá-la.
//
// Depois, na MESMA cena, o traço muda de forma: a máquina perde o corpo e
// volta a ser linha, as linhas se desfazem em partículas douradas (que
// nascem exatamente em cima delas, então não há corte) e cada partícula
// voa até um ponto da tinta do homem vitruviano — o desenho real, da
// mesma época. Quando todas pousaram, o desenho verdadeiro aparece nítido
// por baixo e elas se apagam. A máquina e o corpo eram o mesmo estudo.
//
// E o desenho ainda não acabou: o corpo e a escrita se apagam e ficam só
// o círculo e o quadrado, que se soltam do papel. O quadrado vira um
// cubo, o cubo se abre no rombicuboctaedro que Leonardo desenhou para o
// livro de Luca Pacioli, e o traço ganha corpo outra vez — agora como as
// molduras vazadas das pranchas (pacioliSolid.ts).
//
// Modelo: "Ornitottero" por Woody's Games, CC BY 4.0. Desenho: Homem
// vitruviano, c. 1490, Gallerie dell'Accademia, domínio público (foto Luc
// Viatour). Os créditos visíveis no rodapé são exigência/cortesia das
// fontes, não enfeite.
const MODEL_SRC = "/assets/ornitottero.opt.glb";
// o traço do desenho original extraído como alfa (tinta = opaco)
const FIGURE_SRC = "/assets/vitruvian-ink.webp";
const FIGURE_ASPECT = 1664 / 1200; // altura / largura da imagem
// umbigo = centro do círculo, em uv da imagem (medido na digitalização)
const FIGURE_NAVEL = [0.5, 0.567] as const;

// janelas do scroll de cada etapa, em unidades do primeiro ato (0-1 = a
// máquina até o homem vitruviano, 560vh). Os sólidos continuam depois
// do 1, e o pin inteiro cresce na mesma proporção
const ACT_SPAN = 1.75;
const PIN_VH = 560 * ACT_SPAN;
const INTRO = [0.015, 0.05, 0.16, 0.2] as const; // legenda central: entra..sai
// a seção sobe por cima da última tela da galeria (o trecho em que a
// câmera afunda no escuro) e o traço já começa nessa subida — o primeiro
// risco nasce do próprio escuro da galeria. ENTRY = quanto do DRAW
// acontece antes do pin, em unidades do ato
const ENTRY = 0.12;
const DRAW = [-ENTRY, 0.22] as const; // linhas se desenhando
const SOLID = [0.18, 0.33] as const; // corpo se materializando
const SPIN = [0.28, 0.52] as const; // giro guiado pelo scroll
const COPY_A = [0.28, 0.5] as const; // "Do traço ao voo"
const DEMAT = [0.5, 0.58] as const; // o corpo volta a ser traço
const MORPH = [0.57, 0.82] as const; // as linhas viram o homem vitruviano
// a composição alterna de lado: a máquina fica à direita (texto à
// esquerda), volta pro centro enquanto perde o corpo, e o homem se forma
// à ESQUERDA (texto à direita), e o círculo e o quadrado atravessam a
// tela de volta pra direita enquanto viram sólido (texto à esquerda): um
// vaivém que dá movimento à sequência
const COPY_B = [0.63, 0.82] as const; // "Da asa ao corpo"
const FIG_IN = [0.8, 0.89] as const; // o desenho real aparece sob as partículas
const COPY_C = [0.85, 0.97] as const; // "A medida do homem"
const TRACE = [0.93, 1.0] as const; // círculo e quadrado se redesenham em ouro
const FIG_OUT = [0.99, 1.07] as const; // o resto do desenho se apaga
const LIFT = [1.0, 1.16] as const; // os dois se soltam do papel e tombam
const EXTRUDE = [1.1, 1.24] as const; // o quadrado vira cubo
const EXPAND = [1.22, 1.38] as const; // o cubo se abre em 26 faces
const FAN = [1.24, 1.4] as const; // o círculo vira esfera armilar
const BODY = [1.37, 1.53] as const; // as molduras de madeira
const SOLID_SPIN = [1.0, 1.72] as const; // giro do sólido
const COPY_D = [1.13, 1.32] as const; // "Do corpo ao sólido"
const COPY_E = [1.42, 1.71] as const; // "Vinte e seis faces"
const EXIT = [1.715, ACT_SPAN] as const; // tudo se apaga no preto
// partículas: quantas, e o tamanho de cada uma (em unidades do mundo)
const PARTICLES_WIDE = 38000;
const PARTICLES_NARROW = 16000;
const PARTICLE_SIZE = 0.0105;

// ordem de revelação (0 no centro da máquina -> ~1 na ponta das asas),
// com um ruído baixo pra frente não ser uma esfera perfeita. Mesma
// função nas linhas e no sólido: o corpo segue exatamente o traço
const REVEAL_GLSL = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRadius;
  float revealOrder(vec3 p) {
    float d = length(p - uCenter) / uRadius;
    vec3 q = (p - uCenter) / uRadius;
    float n = sin(q.x * 9.1 + q.z * 5.3) * sin(q.y * 11.7 - q.x * 6.2);
    return d * 0.92 + n * 0.05;
  }
`;

const ramp = (a: number, b: number, x: number) =>
  Math.min(1, Math.max(0, (x - a) / (b - a)));
const smooth = (x: number) => x * x * (3 - 2 * x);

export default function VooSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const copyBRef = useRef<HTMLDivElement>(null);
  const copyCRef = useRef<HTMLDivElement>(null);
  const copyDRef = useRef<HTMLDivElement>(null);
  const copyERef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const wrap = canvasWrapRef.current;
    if (!section || !wrap) return;

    let disposed = false;
    const reduced = prefersReducedMotion;

    // ---------- renderer / cena ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.05;
    // exatamente --ink: a seção nasce do mesmo preto em que a galeria
    // terminou, sem degrau de cor na emenda
    renderer.setClearColor(0x0a0906, 1);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.28;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.1, 7.2);
    camera.lookAt(0, 0, 0);

    // luz de museu, a mesma família da galeria: chave quente de cima,
    // aro frio por trás (desenha a silhueta das varetas contra o preto)
    const key = new THREE.DirectionalLight(0xffd9a8, 2.4);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight(0x7fc4ff, 1.6);
    rim.position.set(3, 2, -5);
    const fill = new THREE.HemisphereLight(0x3a3026, 0x080706, 0.6);
    scene.add(key, rim, fill);

    // o pivô gira/sobe; o modelo fica centrado dentro dele
    const pivot = new THREE.Group();
    scene.add(pivot);

    const uniforms = {
      uCenter: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uDraw: { value: 0 },
      uSolid: { value: 0 },
      uLineOpacity: { value: 1 },
    };

    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: uniforms.uCenter,
        uRadius: uniforms.uRadius,
        uDraw: uniforms.uDraw,
        uOpacity: uniforms.uLineOpacity,
        uColor: { value: new THREE.Color(0xd9b46a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        ${REVEAL_GLSL}
        uniform float uDraw;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec3 vWorld;
        void main() {
          float o = revealOrder(vWorld);
          if (o > uDraw) discard;
          // a ponta da "pena": o trecho recém-desenhado brilha mais
          float tip = smoothstep(uDraw - 0.07, uDraw, o);
          gl_FragColor = vec4(uColor * (0.7 + tip * 1.8), uOpacity * (0.55 + tip * 0.45));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // o sólido usa o material PBR do próprio modelo, só com um descarte
    // injetado: o fragmento só existe depois que a frente uSolid passou
    function addSolidReveal(mat: THREE.Material) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCenter = uniforms.uCenter;
        shader.uniforms.uRadius = uniforms.uRadius;
        shader.uniforms.uSolid = uniforms.uSolid;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vRevealWorld;")
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvRevealWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>\nvarying vec3 vRevealWorld;\nuniform float uSolid;\n${REVEAL_GLSL}`,
          )
          .replace(
            "#include <clipping_planes_fragment>",
            "#include <clipping_planes_fragment>\nif (revealOrder(vRevealWorld) > uSolid) discard;",
          );
      };
      mat.needsUpdate = true;
    }

    const figureUniforms = {
      uTex: { value: null as THREE.Texture | null },
      uReveal: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(0xd9b46a) },
    };
    const figureMaterial = new THREE.ShaderMaterial({
      uniforms: figureUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uReveal;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          // corta o grão do papel que sobrou na extração da tinta
          float a = smoothstep(0.2, 0.75, texture2D(uTex, vUv).a);
          // revela do umbigo pra fora: corpo, depois círculo e quadrado,
          // por último a escrita em cima e embaixo
          vec2 q = (vUv - vec2(${FIGURE_NAVEL[0]}, ${FIGURE_NAVEL[1]})) * vec2(1.0, ${FIGURE_ASPECT.toFixed(4)});
          float n = sin(q.x * 37.0 + q.y * 23.0) * sin(q.y * 41.0 - q.x * 19.0);
          float o = length(q) + n * 0.012;
          if (o > uReveal || a < 0.01) discard;
          float tip = smoothstep(uReveal - 0.05, uReveal, o);
          gl_FragColor = vec4(uColor * (1.25 + tip * 1.6), a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const figure = new THREE.Mesh(new THREE.PlaneGeometry(1, FIGURE_ASPECT), figureMaterial);
    figure.renderOrder = 3;
    figure.visible = false;
    scene.add(figure);
    new THREE.TextureLoader().load(FIGURE_SRC, (t) => {
      if (disposed) {
        t.dispose();
        return;
      }
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      figureUniforms.uTex.value = t;
      disposables.push(t);
      figureImage = t.image as HTMLImageElement | ImageBitmap;
      tryBuildParticles();
    });

    // a figura fica sempre de pé, de frente pra câmera, à direita
    const uprightHelper = new THREE.Object3D();
    scene.add(uprightHelper);

    // ---------- os sólidos de Pacioli ----------
    const pacioli = createPacioli();
    scene.add(pacioli.group);

    // ---------- partículas: das linhas da máquina à tinta do desenho ----------
    // as duas pontas do caminho de cada partícula são sorteadas uma vez:
    // início num ponto das arestas da máquina (espaço do pivô), fim num
    // ponto de tinta do desenho (espaço do plano da figura). O shader
    // mistura as duas no mundo, então a máquina ainda pode estar girando
    // quando a transformação começa
    const edgeSources: { edges: THREE.BufferGeometry; mesh: THREE.Object3D }[] = [];
    let modelLoaded = false;
    let figureImage: HTMLImageElement | ImageBitmap | null = null;
    const particleUniforms = {
      uStartM: { value: new THREE.Matrix4() },
      uEndM: { value: new THREE.Matrix4() },
      uMorph: { value: 0 },
      uAlpha: { value: 0 },
      uSize: { value: PARTICLE_SIZE },
      uPix: { value: 1 },
      uColor: { value: new THREE.Color(0xd9b46a) },
    };
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: particleUniforms,
      vertexShader: /* glsl */ `
        attribute vec3 aStart;
        attribute vec3 aEnd;
        attribute vec3 aRand;
        uniform mat4 uStartM;
        uniform mat4 uEndM;
        uniform float uMorph;
        uniform float uSize;
        uniform float uPix;
        varying float vFlight;
        void main() {
          vec3 a = (uStartM * vec4(aStart, 1.0)).xyz;
          vec3 b = (uEndM * vec4(aEnd, 1.0)).xyz;
          // cada partícula sai num momento diferente (até 0.45 de atraso)
          // e todas chegam em uMorph = 1
          float t = clamp(uMorph * 1.45 - aRand.x * 0.45, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);
          // o arco: desvia pro lado no meio do voo — a forma se desfaz
          // numa nuvem antes de se refazer
          // (pequeno o bastante pra as duas formas coexistirem: a máquina
          // ainda se lê enquanto o homem já se forma — sem névoa morta)
          vec3 swirl = (aRand - 0.5) * vec3(1.0, 0.75, 0.6);
          vec3 p = mix(a, b, t) + swirl * sin(t * 3.14159);
          vFlight = sin(t * 3.14159);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, uSize * uPix / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        uniform vec3 uColor;
        varying float vFlight;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, r);
          // em voo brilham mais: a "poeira de tinta" acesa entre as formas
          gl_FragColor = vec4(uColor * (1.1 + vFlight * 0.9), soft * uAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    let particles: THREE.Points | null = null;

    function sampleEdgeStarts(count: number) {
      // segmentos de todas as arestas, no espaço do pivô, sorteados por
      // comprimento (asa comprida recebe mais partículas que cordame)
      pivot.updateMatrixWorld(true);
      const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
      const segs: number[] = [];
      const lens: number[] = [];
      let total = 0;
      const m = new THREE.Matrix4();
      const va = new THREE.Vector3();
      const vb = new THREE.Vector3();
      edgeSources.forEach(({ edges, mesh }) => {
        m.multiplyMatrices(toPivot, mesh.matrixWorld);
        const pos = edges.attributes.position;
        for (let i = 0; i < pos.count; i += 2) {
          va.fromBufferAttribute(pos, i).applyMatrix4(m);
          vb.fromBufferAttribute(pos, i + 1).applyMatrix4(m);
          const l = va.distanceTo(vb);
          if (l <= 0) continue;
          segs.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
          total += l;
          lens.push(total);
        }
      });
      const out = new Float32Array(count * 3);
      for (let k = 0; k < count; k++) {
        const r = Math.random() * total;
        let lo = 0;
        let hi = lens.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (lens[mid] < r) lo = mid + 1;
          else hi = mid;
        }
        const f = Math.random();
        const o = lo * 6;
        out[k * 3] = segs[o] + (segs[o + 3] - segs[o]) * f;
        out[k * 3 + 1] = segs[o + 1] + (segs[o + 4] - segs[o + 1]) * f;
        out[k * 3 + 2] = segs[o + 2] + (segs[o + 5] - segs[o + 2]) * f;
      }
      return out;
    }

    function sampleInkEnds(count: number) {
      // pontos de tinta do desenho, sorteados pelo alfa (traço forte
      // recebe mais partículas), no espaço do plano: largura 1, centrado
      const W = 480;
      const H = Math.round(W * FIGURE_ASPECT);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(figureImage as CanvasImageSource, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const cdf = new Float32Array(W * H);
      let total = 0;
      for (let i = 0; i < W * H; i++) {
        const a = data[i * 4 + 3] / 255;
        total += a > 0.25 ? a : 0;
        cdf[i] = total;
      }
      const out = new Float32Array(count * 3);
      for (let k = 0; k < count; k++) {
        const r = Math.random() * total;
        let lo = 0;
        let hi = cdf.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cdf[mid] < r) lo = mid + 1;
          else hi = mid;
        }
        const u = ((lo % W) + Math.random()) / W;
        const v = 1 - (Math.floor(lo / W) + Math.random()) / H;
        out[k * 3] = u - 0.5;
        out[k * 3 + 1] = (v - 0.5) * FIGURE_ASPECT;
        out[k * 3 + 2] = 0;
      }
      return out;
    }

    // pareia início e fim POR POSIÇÃO, não ao acaso: com pares aleatórios
    // o meio do voo vira uma bolha (a média de dois pontos sorteados).
    // Ordena as duas nuvens pelo ângulo em volta do próprio centro (meio
    // da máquina / umbigo) e, dentro de cada fatia, pela distância — as
    // asas viram os braços, o centro vira o tronco, e a forma se mantém
    // o tempo todo enquanto se transforma
    function pairByPosition(pts: Float32Array, cx: number, cy: number, count: number) {
      const idx = Array.from({ length: count }, (_, i) => i);
      const ang = new Float32Array(count);
      const rad = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const dx = pts[i * 3] - cx;
        const dy = pts[i * 3 + 1] - cy;
        ang[i] = Math.atan2(dy, dx);
        rad[i] = Math.hypot(dx, dy);
      }
      idx.sort((a, b) => ang[a] - ang[b]);
      const CHUNK = 160;
      for (let c = 0; c < count; c += CHUNK) {
        const part = idx.slice(c, c + CHUNK).sort((a, b) => rad[a] - rad[b]);
        for (let k = 0; k < part.length; k++) idx[c + k] = part[k];
      }
      const out = new Float32Array(count * 3);
      idx.forEach((src, dst) => {
        out[dst * 3] = pts[src * 3];
        out[dst * 3 + 1] = pts[src * 3 + 1];
        out[dst * 3 + 2] = pts[src * 3 + 2];
      });
      return out;
    }

    function tryBuildParticles() {
      if (particles || !modelLoaded || !figureImage || disposed) return;
      const count = window.innerWidth < 880 ? PARTICLES_NARROW : PARTICLES_WIDE;
      const geo = new THREE.BufferGeometry();
      // máquina: centro do pivô, vista de frente (x = envergadura, y = alto)
      const starts = pairByPosition(sampleEdgeStarts(count), 0, 0, count);
      // desenho: em volta do umbigo, no espaço do plano
      const ends = pairByPosition(
        sampleInkEnds(count),
        FIGURE_NAVEL[0] - 0.5,
        (FIGURE_NAVEL[1] - 0.5) * FIGURE_ASPECT,
        count,
      );
      geo.setAttribute("aStart", new THREE.BufferAttribute(starts, 3));
      geo.setAttribute("aEnd", new THREE.BufferAttribute(ends, 3));
      const rand = new Float32Array(count * 3);
      for (let i = 0; i < rand.length; i++) rand[i] = Math.random();
      geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 3));
      // o shader calcula a posição; "position" só existe pro three contar
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      particles = new THREE.Points(geo, particleMaterial);
      particles.frustumCulled = false;
      particles.renderOrder = 4;
      particles.visible = false;
      scene.add(particles);
      disposables.push(geo);
    }

    const disposables: { dispose: () => void }[] = [
      lineMaterial,
      envTex,
      pmrem,
      figureMaterial,
      figure.geometry,
      particleMaterial,
      pacioli,
    ];
    let modelRadius = 1;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(MODEL_SRC, (gltf) => {
      if (disposed) return;
      const model = gltf.scene;

      // centra e escala: envergadura ~4.4 unidades, cabe com folga
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = 4.4 / Math.max(size.x, size.z);
      model.scale.setScalar(s);
      model.position.copy(center).multiplyScalar(-s);
      pivot.add(model);
      modelRadius = (size.length() * s) / 2;
      model.updateMatrixWorld(true);

      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const name = mat.name.toLowerCase();
        if (name.includes("cloth")) {
          // tela de linho envelhecido, não o branco chapado do arquivo
          mat.color.set(0xe6d5b0);
          mat.roughness = 0.88;
          mat.metalness = 0;
        } else if (name.includes("wire")) {
          mat.color.set(0x2b2118);
          mat.roughness = 0.6;
        } else {
          mat.roughness = 0.55;
        }
        mat.side = THREE.DoubleSide;
        // o autor modelou UMA asa e espelhou a outra com escala negativa:
        // as normais dessa cópia apontam pro lado errado e a tela dela era
        // sombreada como verso (cinza-escuro). Inverte as normais só nela
        // (em cópia da geometria, que pode ser compartilhada com a original)
        if (mesh.matrixWorld.determinant() < 0) {
          mesh.geometry = mesh.geometry.clone();
          const n = mesh.geometry.attributes.normal;
          if (n) {
            for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
            n.needsUpdate = true;
          }
        }
        addSolidReveal(mat);
        disposables.push(mat, mesh.geometry);

        // o traço: arestas do próprio modelo, no mesmo espaço local
        const edges = new THREE.EdgesGeometry(mesh.geometry, 32);
        const lines = new THREE.LineSegments(edges, lineMaterial);
        lines.renderOrder = 2;
        mesh.add(lines);
        disposables.push(edges);
        edgeSources.push({ edges, mesh });
      });
      modelLoaded = true;
      tryBuildParticles();
      gltf.parser.json.textures?.forEach((_: unknown, i: number) => {
        gltf.parser.getDependency("texture", i).then((t: THREE.Texture) => disposables.push(t));
      });
      resize();
    });

    // ---------- tamanho ----------
    let isNarrow = false;
    let baseCamZ = 7.2;
    function resize() {
      const w = section!.clientWidth;
      const h = section!.clientHeight;
      isNarrow = w < 880;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // tela estreita: recua a câmera pra envergadura caber na largura
      baseCamZ = isNarrow ? 7.2 / Math.min(1, camera.aspect / 1.1) : 7.2;
      camera.position.z = baseCamZ;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- arrastar pra girar ----------
    // touch-action: pan-y no canvas — o arrasto vertical continua sendo
    // scroll, só o horizontal gira a máquina
    let dragYaw = 0;
    let dragPitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      wrap.setPointerCapture(e.pointerId);
      wrap.dataset.dragging = "true";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragYaw += (e.clientX - lastX) * 0.008;
      dragPitch = gsap.utils.clamp(-0.45, 0.45, dragPitch + (e.clientY - lastY) * 0.004);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (wrap.hasPointerCapture(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
      delete wrap.dataset.dragging;
    };
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    // ---------- texto: três blocos, cada um uma timeline tocada ----------
    const intro = introRef.current;
    function copyTimeline(el: HTMLElement | null) {
      const tl = gsap.timeline({ paused: true });
      if (!el) return tl;
      tl.fromTo(
        el.querySelectorAll("[data-char]"),
        { yPercent: 115 },
        { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.035 },
        0,
      ).fromTo(
        el.querySelectorAll("[data-fade]"),
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 },
        0.3,
      );
      return tl;
    }
    const copies = [
      { tl: copyTimeline(copyRef.current), range: COPY_A, on: false },
      { tl: copyTimeline(copyBRef.current), range: COPY_B, on: false },
      { tl: copyTimeline(copyCRef.current), range: COPY_C, on: false },
      { tl: copyTimeline(copyDRef.current), range: COPY_D, on: false },
      { tl: copyTimeline(copyERef.current), range: COPY_E, on: false },
    ];

    // ---------- estado guiado pelo scroll (alvos) + suavização ----------
    const target = {
      draw: 0,
      solid: 0,
      spin: 0,
      exit: 0,
      slide: 0,
      morph: 0,
      fig: 0,
      trace: 0,
      figOut: 0,
      lift: 0,
      extrude: 0,
      expand: 0,
      fan: 0,
      body: 0,
      solidSpin: 0,
    };
    const cur = { ...target };

    function applyProgress(p: number) {
      target.draw = ramp(DRAW[0], DRAW[1], p) * 1.12;
      // o corpo se materializa e depois volta a ser só traço
      target.solid = ramp(SOLID[0], SOLID[1], p) * 1.12 * (1 - ramp(DEMAT[0], DEMAT[1], p));
      target.spin = ramp(SPIN[0], SPIN[1], p);
      target.exit = ramp(EXIT[0], EXIT[1], p);
      // quando o primeiro texto entra, a máquina abre espaço à esquerda
      target.slide =
        ramp(COPY_A[0] - 0.04, COPY_A[0] + 0.04, p) * (1 - ramp(DEMAT[0], DEMAT[1] + 0.03, p));
      target.morph = ramp(MORPH[0], MORPH[1], p);
      target.fig = ramp(FIG_IN[0], FIG_IN[1], p);
      target.trace = ramp(TRACE[0], TRACE[1], p);
      target.figOut = ramp(FIG_OUT[0], FIG_OUT[1], p);
      target.lift = ramp(LIFT[0], LIFT[1], p);
      target.extrude = ramp(EXTRUDE[0], EXTRUDE[1], p);
      target.expand = ramp(EXPAND[0], EXPAND[1], p);
      target.fan = ramp(FAN[0], FAN[1], p);
      target.body = ramp(BODY[0], BODY[1], p);
      target.solidSpin = ramp(SOLID_SPIN[0], SOLID_SPIN[1], p);

      if (intro) {
        intro.style.opacity = String(
          ramp(INTRO[0], INTRO[1], p) * (1 - ramp(INTRO[2], INTRO[3], p)),
        );
      }
      copies.forEach((c) => {
        const on = p >= c.range[0] && p < c.range[1];
        if (on === c.on) return;
        c.on = on;
        if (on) {
          // scroll rápido: o bloco anterior ainda sairia por cima deste
          copies.forEach((o) => {
            if (o !== c && !o.on) o.tl.progress(0).pause();
          });
          c.tl.timeScale(1).play();
        } else c.tl.timeScale(1.8).reverse();
      });
    }

    let trigger: ScrollTrigger | null = null;
    let entryTrigger: ScrollTrigger | null = null;
    if (reduced) {
      // sem pin nem scrub: a máquina já pronta, o texto já no lugar, o
      // arrasto continua funcionando
      Object.assign(target, { draw: 1.12, solid: 1.12, spin: 0, exit: 0, slide: 1 });
      Object.assign(cur, target);
      copies[0].tl.progress(1);
      if (intro) intro.style.opacity = "0";
    } else {
      applyProgress(-ENTRY);
      // a subida por cima da galeria: a seção sobe, mas o canvas fica
      // parado na tela (desconta o quanto a seção ainda está abaixo do
      // topo) e aparece aos poucos por cima do escuro em que a galeria
      // terminou — o traço nasce no centro da tela desde o primeiro
      // instante, não no centro de uma seção ainda meio fora da tela
      const setEntry = (e: number) => {
        const offset = e * window.innerHeight;
        wrap.style.transform = offset > 0.5 ? `translate3d(0, ${-offset}px, 0)` : "";
        wrap.style.opacity = String(Math.min(1, (1 - e) / 0.3));
      };
      entryTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "top top",
        onUpdate: (self) => {
          setEntry(1 - self.progress);
          // só antes do pin: no fim (progress 1) quem manda é o pin
          if (self.progress < 1) applyProgress(-ENTRY * (1 - self.progress));
        },
        onLeave: () => setEntry(0),
        onEnterBack: (self) => setEntry(1 - self.progress),
        onLeaveBack: () => setEntry(1),
      });
      setEntry(1);
      trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${PIN_VH}%`,
        scrub: true,
        pin: true,
        onUpdate: (self) => applyProgress(self.progress * ACT_SPAN),
      });
    }

    // só renderiza com a seção na tela. IntersectionObserver e não um
    // ScrollTrigger no próprio section: o section é o elemento PINADO, e
    // um segundo trigger nele calculava o fim errado — o loop parava no
    // meio do pin e a cena congelava no último quadro (só as linhas)
    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "15% 0px" },
    );
    io.observe(section);

    const timer = new THREE.Timer();
    timer.connect(document);
    const worldCenter = new THREE.Vector3();
    const upPos = new THREE.Vector3();
    const liftFromPos = new THREE.Vector3();
    const liftToPos = new THREE.Vector3();
    const liftToQuat = new THREE.Quaternion();
    const liftEuler = new THREE.Euler();
    function tick() {
      if (disposed || !visible) return;
      timer.update();
      const t = timer.getElapsed();
      const k = 0.085; // suavização: o scroll puxa, a cena acompanha com peso
      (Object.keys(cur) as (keyof typeof cur)[]).forEach((key) => {
        cur[key] += (target[key] - cur[key]) * k;
      });

      uniforms.uDraw.value = cur.draw;
      uniforms.uSolid.value = cur.solid;
      // o traço não some: vira um fio fino por cima do corpo, como o
      // desenho que continua visível sob a tinta
      // e cede lugar às partículas, que nascem em cima dele
      const morphStarted = ramp(0, 0.06, cur.morph);
      uniforms.uLineOpacity.value =
        (1 - ramp(0.4, 1.1, cur.solid) * 0.82) * (1 - cur.exit) * (1 - morphStarted);

      const slideX = isNarrow ? 0 : cur.slide * 1.3;
      pivot.position.set(slideX, Math.sin(t * 0.8) * 0.06, 0);
      pivot.rotation.set(
        0.32 + dragPitch,
        -0.65 + cur.spin * Math.PI * 1.25 + dragYaw + Math.sin(t * 0.35) * 0.04,
        Math.sin(t * 0.6) * 0.025,
      );
      pivot.updateMatrixWorld();
      pivot.getWorldPosition(worldCenter);
      uniforms.uCenter.value.copy(worldCenter);
      uniforms.uRadius.value = modelRadius;

      // a figura: de pé à direita, de frente pra câmera, ~86% da altura
      camera.position.set(0, 1.1, baseCamZ);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      upPos.set(isNarrow ? 0 : -1.0, 0.05, 0.6);
      uprightHelper.position.copy(upPos);
      uprightHelper.lookAt(camera.position);
      const d = camera.position.distanceTo(upPos);
      const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const upWidth = Math.min((visH * 0.86) / FIGURE_ASPECT, visH * camera.aspect * 0.9);
      figure.position.copy(upPos);
      figure.quaternion.copy(uprightHelper.quaternion);
      figure.scale.setScalar(upWidth);
      figure.updateMatrixWorld();
      // o desenho real aparece rápido, do umbigo pra fora, por baixo das
      // partículas que já pousaram exatamente em cima da tinta
      const fig = smooth(cur.fig);
      figure.visible = fig > 0.001;
      figureUniforms.uReveal.value = fig * 0.95;
      // depois do homem, o desenho se apaga e deixa só o círculo e o
      // quadrado (redesenhados em ouro exatamente em cima dos originais)
      figureUniforms.uOpacity.value = (1 - cur.exit) * (1 - smooth(cur.figOut));
      if (cur.figOut > 0.999) figure.visible = false;
      // a máquina já virou partícula: não precisa mais desenhar o modelo
      pivot.visible = cur.morph < 0.995;

      const trace = cur.trace;
      pacioli.group.visible = trace > 0.001 && cur.exit < 0.999;
      if (pacioli.group.visible) {
        // de: em cima do quadrado do desenho, no plano do papel
        liftFromPos
          .set(VITRUVIAN_SQUARE.cx, VITRUVIAN_SQUARE.cy, 0)
          .applyMatrix4(figure.matrixWorld);
        const fromScale = upWidth * VITRUVIAN_SQUARE.half;
        // para: solto no espaço, tombado em três quartos, girando com o
        // scroll (e com o arrasto, que continua valendo)
        liftToPos.set(isNarrow ? 0 : 1.25, isNarrow ? 0.7 : 0.05, 0);
        liftEuler.set(
          0.42 + dragPitch,
          -0.62 + cur.solidSpin * Math.PI * 1.1 + dragYaw,
          0.04,
        );
        liftToQuat.setFromEuler(liftEuler);
        const toScale = isNarrow ? 0.6 : 0.46;
        const m = smooth(cur.lift);
        pacioli.group.position.lerpVectors(liftFromPos, liftToPos, m);
        // a travessia em arco, não em linha reta
        pacioli.group.position.y += Math.sin(m * Math.PI) * 0.35 + Math.sin(t * 0.8) * 0.05 * m;
        pacioli.group.quaternion.slerpQuaternions(figure.quaternion, liftToQuat, m);
        pacioli.group.scale.setScalar(fromScale + (toScale - fromScale) * m);
        pacioli.update({
          draw: trace,
          extrude: smooth(cur.extrude),
          expand: smooth(cur.expand),
          fan: smooth(cur.fan),
          body: cur.body,
          opacity: 1 - cur.exit,
          time: t,
        });
      }

      if (particles) {
        const morph = cur.morph;
        particles.visible = morph > 0.001 && fig < 0.999;
        particleUniforms.uStartM.value.copy(pivot.matrixWorld);
        particleUniforms.uEndM.value.copy(figure.matrixWorld);
        particleUniforms.uMorph.value = morph;
        particleUniforms.uAlpha.value = 0.55 * ramp(0, 0.06, morph) * (1 - fig);
        particleUniforms.uPix.value =
          (renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      }

            renderer.render(scene, camera);
    }
    gsap.ticker.add(tick);
    if (process.env.NODE_ENV === "development") {
      // só pra inspecionar a cena pelo console/automação em dev
      (window as unknown as Record<string, unknown>).__voo = { scene, uniforms, renderer, target, cur, pacioli };
    }

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      trigger?.kill();
      entryTrigger?.kill();
      wrap.style.transform = "";
      wrap.style.opacity = "";
      io.disconnect();
      timer.dispose();
      copies.forEach((c) => c.tl.kill());
      window.removeEventListener("resize", resize);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [prefersReducedMotion]);

  return (
    <section
      className={styles.vooSection}
      id="voo"
      ref={sectionRef}
      data-overlap={prefersReducedMotion ? undefined : ""}
    >
      <div className={styles.canvasWrap} ref={canvasWrapRef} />

      <div className={styles.intro} ref={introRef}>
        <span>Codice sul volo degli uccelli</span>
        <span className={styles.introYear}>c. 1505</span>
      </div>

      <div className={styles.copy} ref={copyRef}>
        <span className={styles.eyebrow} data-fade="">
          As máquinas de voar
        </span>
        <h2 className={styles.title} aria-label="Do traço ao voo">
          <SplitChars text="Do traço" />{" "}
          <em>
            <SplitChars text="ao voo" />
          </em>
        </h2>
        <p className={styles.lead} data-fade="">
          Leonardo passou décadas observando o voo das aves e encheu cadernos
          de máquinas para o homem voar: asas de madeira, tela e cordame,
          movidas pela força dos braços e das pernas. Não há registro de que
          alguma tenha saído do papel.
        </p>
        <span className={styles.hint} data-fade="">
          <span className={styles.hintLine} />
          Arraste para girar
        </span>
      </div>

      <div className={`${styles.copy} ${styles.copyRight}`} ref={copyBRef}>
        <span className={styles.eyebrow} data-fade="">
          O mesmo olhar
        </span>
        <h2 className={styles.title} aria-label="Da asa ao corpo">
          <SplitChars text="Da asa" />{" "}
          <em>
            <SplitChars text="ao corpo" />
          </em>
        </h2>
        <p className={styles.lead} data-fade="">
          Para Leonardo, a máquina e o corpo eram o mesmo problema: estrutura,
          proporção, movimento. Os cadernos que desenham asas desenham também
          ossos e músculos, medidos com o mesmo rigor.
        </p>
      </div>

      <div className={`${styles.copy} ${styles.copyRight}`} ref={copyCRef}>
        <span className={styles.eyebrow} data-fade="">
          Homem vitruviano · c. 1490
        </span>
        <h2 className={styles.title} aria-label="A medida do homem">
          <SplitChars text="A medida" />{" "}
          <em>
            <SplitChars text="do homem" />
          </em>
        </h2>
        <p className={styles.lead} data-fade="">
          Nos mesmos anos em Milão, Leonardo inscreveu o corpo num círculo e
          num quadrado, seguindo o arquiteto romano Vitrúvio: os braços
          abertos medem o mesmo que a altura, e o umbigo é o centro do
          círculo.
        </p>
      </div>

      <div className={styles.copy} ref={copyDRef}>
        <span className={styles.eyebrow} data-fade="">
          De divina proportione · c. 1498
        </span>
        <h2 className={styles.title} aria-label="Do corpo ao sólido">
          <SplitChars text="Do corpo" />{" "}
          <em>
            <SplitChars text="ao sólido" />
          </em>
        </h2>
        <p className={styles.lead} data-fade="">
          Em Milão, Leonardo conheceu o matemático Luca Pacioli e desenhou
          os sólidos do livro dele sobre a proporção divina — sessenta
          pranchas. O mesmo quadrado que mede o homem é a face de um cubo.
        </p>
      </div>

      <div className={styles.copy} ref={copyERef}>
        <span className={styles.eyebrow} data-fade="">
          Vigintisex basium vacuum
        </span>
        <h2 className={styles.title} aria-label="Vinte e seis faces">
          <SplitChars text="Vinte e seis" />{" "}
          <em>
            <SplitChars text="faces" />
          </em>
        </h2>
        <p className={styles.lead} data-fade="">
          Dezoito quadrados e oito triângulos. Leonardo desenhou cada sólido
          duas vezes: cheio e vazado, só a estrutura das faces, para que se
          veja através dele. Este mesmo aparece de vidro, pendurado, no
          retrato de Pacioli pintado em 1495.
        </p>
        <span className={styles.hint} data-fade="">
          <span className={styles.hintLine} />
          Arraste para girar
        </span>
      </div>

      <p className={styles.credit}>
        Modelo 3D:{" "}
        <a
          href="https://sketchfab.com/3d-models/ornitottero-4ff3b11a3e9e4742a6b1bd976c59e20e"
          target="_blank"
          rel="noopener noreferrer"
        >
          &ldquo;Ornitottero&rdquo;
        </a>{" "}
        por{" "}
        <a href="https://sketchfab.com/woodysgames" target="_blank" rel="noopener noreferrer">
          Woody&rsquo;s Games
        </a>
        ,{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY 4.0
        </a>{" "}
        · <em>Homem vitruviano</em>, Gallerie dell&rsquo;Accademia, Veneza, domínio
        público (foto: Luc Viatour)
      </p>
    </section>
  );
}
