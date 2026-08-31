"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// ruído hash/fbm genérico, compartilhado pelos dois shaders abaixo —
// dá a cada pixel da borda uma "opinião própria" sobre ficar dentro
// ou fora, em vez de um corte geométrico perfeito.
const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
`;

// PASSO 1 — carimba uma mancha de tinta na posição atual do ponteiro
// por cima do buffer do frame anterior (já desbotado), e guarda o
// resultado. É essa persistência entre frames que faz o rastro
// existir: se o mouse anda rápido, os carimbos de frames consecutivos
// ficam espalhados (risco fino); se anda devagar, eles se sobrepõem
// muito (mancha grossa) — o mesmo mecanismo produz os dois efeitos.
const STAMP_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrevTrail;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uDecayPerSecond;
  uniform float uDt;
  uniform float uActive;
  uniform float uTime;

  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    vec2 pixel = vUv * uResolution;
    vec2 mousePx = uMouse * uResolution;
    float dist = distance(pixel, mousePx);

    float grain = fbm(pixel * 0.07 + vec2(uTime * 34.0, uTime * 11.0));
    float edge = uRadius + (grain - 0.5) * uRadius * 0.22;
    float stamp = 1.0 - smoothstep(edge - 2.5, edge + 2.5, dist);

    float speckle = step(0.52, fbm(pixel * 0.14 - vec2(uTime * 70.0, uTime * 45.0)));
    float band = smoothstep(edge - 24.0, edge, dist) * (1.0 - smoothstep(edge, edge + 24.0, dist));
    stamp *= mix(1.0, speckle, band);
    stamp *= uActive;

    // decaimento por TEMPO decorrido, não por frame — um multiplicador
    // fixo por frame fica mais lento sempre que o FPS cai (GPU fraca,
    // tela de alta resolução, aba sem foco), o que fazia o rastro
    // parecer travado em vez de desbotar; pow() com uDt mantém a
    // mesma velocidade de desbotamento em segundos reais, a qualquer FPS
    float decayFactor = pow(uDecayPerSecond, uDt);
    float prev = texture2D(uPrevTrail, vUv).r * decayFactor;
    float trail = max(prev, stamp);

    gl_FragColor = vec4(trail, trail, trail, 1.0);
  }
`;

// PASSO 2 — usa o buffer acumulado (não a posição do ponteiro) como
// máscara de mistura entre a pintura finalizada e o estudo.
const COMPOSE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform sampler2D uTrail;
  uniform vec2 uResolution;
  uniform vec2 uTexASize;
  uniform vec2 uTexBSize;
  uniform vec2 uFocal;

  varying vec2 vUv;

  // ShaderMaterial cru não recebe a codificação linear->sRGB automática
  // que o Three.js aplica nos materiais embutidos — sem isso a imagem
  // sai mais escura e puxada pro vermelho do que a textura original.
  vec3 linearToSRGB(vec3 color) {
    vec3 low = color * 12.92;
    vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(0.0031308, color));
  }

  // mapeia vUv como um "background-size: cover" com foco em uFocal,
  // igual ao object-position que a imagem usava antes em CSS puro
  vec2 coverUv(vec2 uv, vec2 texSize, vec2 focal) {
    float screenRatio = uResolution.x / uResolution.y;
    float texRatio = texSize.x / texSize.y;
    vec2 newSize = screenRatio < texRatio
      ? vec2(texSize.x * (uResolution.y / texSize.y), uResolution.y)
      : vec2(uResolution.x, texSize.y * (uResolution.x / texSize.x));
    vec2 newOffset = (screenRatio < texRatio
      ? vec2((newSize.x - uResolution.x) * focal.x, 0.0)
      : vec2(0.0, (newSize.y - uResolution.y) * focal.y)) / newSize;
    return uv * (uResolution / newSize) + newOffset;
  }

  void main() {
    vec2 uvA = coverUv(vUv, uTexASize, uFocal);
    vec2 uvB = coverUv(vUv, uTexBSize, uFocal);
    vec4 colA = texture2D(uTexA, uvA);
    vec4 colB = texture2D(uTexB, uvB);
    float mask = texture2D(uTrail, vUv).r;

    vec3 finalColor = mix(colA.rgb, colB.rgb, clamp(mask, 0.0, 1.0));
    gl_FragColor = vec4(linearToSRGB(finalColor), 1.0);
  }
`;

type InkRevealCanvasProps = {
  baseSrc: string;
  revealSrc: string;
  focal?: { x: number; y: number };
  radius?: number;
};

export default function InkRevealCanvas({
  baseSrc,
  revealSrc,
  focal = { x: 0.5, y: 0.22 },
  radius = 130,
}: InkRevealCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let rafId = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    // HalfFloatType, não o UnsignedByteType padrão de 8 bits: um valor
    // baixo (ex. 15/255) decaindo por uma fração pequena a cada frame
    // arredonda de volta pro mesmo inteiro em 8 bits — o rastro trava
    // num platô visível em vez de chegar a zero de verdade.
    const rtOptions = { depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType };
    let rtA = new THREE.WebGLRenderTarget(1, 1, rtOptions);
    let rtB = new THREE.WebGLRenderTarget(1, 1, rtOptions);

    const stampUniforms = {
      uPrevTrail: { value: rtA.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(-1, -1) },
      uRadius: { value: radius },
      // fração do rastro que sobra depois de 1 segundo real — a
      // combinar com pow() no shader, então independe do FPS
      uDecayPerSecond: { value: 0.16 },
      uDt: { value: 0 },
      uActive: { value: 0 },
      uTime: { value: 0 },
    };
    const stampMaterial = new THREE.ShaderMaterial({
      uniforms: stampUniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: STAMP_FRAGMENT_SHADER,
    });
    const stampScene = new THREE.Scene();
    stampScene.add(new THREE.Mesh(geometry, stampMaterial));

    const composeUniforms = {
      uTexA: { value: null as THREE.Texture | null },
      uTexB: { value: null as THREE.Texture | null },
      uTrail: { value: rtB.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTexASize: { value: new THREE.Vector2(1, 1) },
      uTexBSize: { value: new THREE.Vector2(1, 1) },
      uFocal: { value: new THREE.Vector2(focal.x, focal.y) },
    };
    const composeMaterial = new THREE.ShaderMaterial({
      uniforms: composeUniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: COMPOSE_FRAGMENT_SHADER,
    });
    const composeScene = new THREE.Scene();
    composeScene.add(new THREE.Mesh(geometry, composeMaterial));

    const loader = new THREE.TextureLoader();
    const loadInto = (src: string, texUniform: { value: THREE.Texture | null }, sizeUniform: THREE.Vector2) =>
      loader.load(src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as HTMLImageElement | undefined;
        if (img?.width && img?.height) sizeUniform.set(img.width, img.height);
        texUniform.value = tex;
      });
    const texA = loadInto(baseSrc, composeUniforms.uTexA, composeUniforms.uTexASize.value);
    const texB = loadInto(revealSrc, composeUniforms.uTexB, composeUniforms.uTexBSize.value);

    // suavização leve só pra não perder carimbos entre eventos de
    // pointermove esparsos — o rastro em si vem da persistência do
    // buffer, não dessa perseguição
    const mouseTarget = { x: 0.5, y: 0.22 };
    const followX = gsap.quickTo(mouseTarget, "x", { duration: 0.1, ease: "power2" });
    const followY = gsap.quickTo(mouseTarget, "y", { duration: 0.1, ease: "power2" });

    let active = false;

    function resize() {
      if (!container) return;
      const dpr = renderer.getPixelRatio();
      const w = Math.max(1, Math.round(container.clientWidth * dpr));
      const h = Math.max(1, Math.round(container.clientHeight * dpr));
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      rtA.setSize(w, h);
      rtB.setSize(w, h);
      stampUniforms.uResolution.value.set(w, h);
      composeUniforms.uResolution.value.set(w, h);
    }

    function setPointer(clientX: number, clientY: number) {
      const rect = container!.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      followX(x);
      followY(y);
      active = true;
    }

    function clearPointer() {
      active = false;
    }

    const onPointerMove = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setPointer(t.clientX, t.clientY);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", clearPointer);
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", clearPointer);
    container.addEventListener("touchcancel", clearPointer);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const startTime = performance.now();
    let lastTime = startTime;
    function tick() {
      if (disposed) return;
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      // cap: se a aba ficou em segundo plano e o rAF pausou por um
      // tempo, um dt gigante faria pow(uDecayPerSecond, dt) zerar o
      // buffer de uma vez — mais previsível que ele só continue baixo
      const dt = Math.min((now - lastTime) / 1000, 0.25);
      lastTime = now;

      stampUniforms.uMouse.value.set(mouseTarget.x, mouseTarget.y);
      stampUniforms.uTime.value = elapsed;
      stampUniforms.uDt.value = dt;
      stampUniforms.uActive.value = active ? 1 : 0;
      stampUniforms.uPrevTrail.value = rtA.texture;

      renderer.setRenderTarget(rtB);
      renderer.render(stampScene, camera);
      renderer.setRenderTarget(null);

      composeUniforms.uTrail.value = rtB.texture;
      renderer.render(composeScene, camera);

      const swap = rtA;
      rtA = rtB;
      rtB = swap;

      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", clearPointer);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", clearPointer);
      container.removeEventListener("touchcancel", clearPointer);
      geometry.dispose();
      stampMaterial.dispose();
      composeMaterial.dispose();
      rtA.dispose();
      rtB.dispose();
      texA.dispose();
      texB.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [baseSrc, revealSrc, focal.x, focal.y, radius, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${baseSrc})`,
          backgroundSize: "cover",
          backgroundPosition: `center ${focal.y * 100}%`,
        }}
      />
    );
  }

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
