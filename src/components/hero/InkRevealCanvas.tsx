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

// ruído hash/fbm genérico — sem ele o corte da revelação seria um
// círculo perfeito; com ele, cada pixel da borda decide "por conta
// própria" se fica dentro ou fora, dando aquela textura granulada
// (em vez de uma borda lisa e uniforme) que aparece em movimento.
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec2 uResolution;
  uniform vec2 uTexASize;
  uniform vec2 uTexBSize;
  uniform vec2 uFocal;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uReveal;
  uniform float uTime;

  varying vec2 vUv;

  // ShaderMaterial cru não recebe a codificação linear->sRGB automática
  // que o Three.js aplica nos materiais embutidos — sem isso a imagem
  // sai mais escura e puxada pro vermelho do que a textura original.
  vec3 linearToSRGB(vec3 color) {
    vec3 low = color * 12.92;
    vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(0.0031308, color));
  }

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

    vec2 pixel = vUv * uResolution;
    vec2 mousePx = uMouse * uResolution;
    float dist = distance(pixel, mousePx);

    float grain = fbm(vUv * 9.0 + uTime * 0.06);
    float edge = uRadius * uReveal + (grain - 0.5) * uRadius * 0.85;
    float mask = 1.0 - smoothstep(edge - 18.0, edge + 18.0, dist);

    // banda de respingos granulados só na borda da transição —
    // é o que dá a sensação de "poeira" se soltando, não só uma
    // linha de corte irregular
    float speckle = step(0.48, fbm(vUv * 26.0 - uTime * 0.15));
    float band = smoothstep(edge - 46.0, edge, dist) * (1.0 - smoothstep(edge, edge + 46.0, dist));
    mask *= mix(1.0, speckle, band);

    mask *= uReveal;

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
  radius = 200,
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

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTexA: { value: null as THREE.Texture | null },
      uTexB: { value: null as THREE.Texture | null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTexASize: { value: new THREE.Vector2(1, 1) },
      uTexBSize: { value: new THREE.Vector2(1, 1) },
      uFocal: { value: new THREE.Vector2(focal.x, focal.y) },
      uMouse: { value: new THREE.Vector2(-1, -1) },
      uRadius: { value: radius },
      uReveal: { value: 0 },
      uTime: { value: 0 },
    };

    const loader = new THREE.TextureLoader();
    const loadInto = (src: string, texUniform: { value: THREE.Texture | null }, sizeUniform: THREE.Vector2) =>
      loader.load(src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as HTMLImageElement | undefined;
        if (img?.width && img?.height) sizeUniform.set(img.width, img.height);
        texUniform.value = tex;
      });
    const texA = loadInto(baseSrc, uniforms.uTexA, uniforms.uTexASize.value);
    const texB = loadInto(revealSrc, uniforms.uTexB, uniforms.uTexBSize.value);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const mouseTarget = { x: 0.5, y: 0.22 };
    const followX = gsap.quickTo(mouseTarget, "x", { duration: 0.32, ease: "power3" });
    const followY = gsap.quickTo(mouseTarget, "y", { duration: 0.32, ease: "power3" });

    let revealed = false;

    function resize() {
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
    }

    function setPointer(clientX: number, clientY: number) {
      const rect = container!.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1 - (clientY - rect.top) / rect.height;
      followX(x);
      followY(y);
      if (!revealed) {
        revealed = true;
        gsap.to(uniforms.uReveal, { value: 1, duration: 0.6, ease: "back.out(1.5)" });
      }
    }

    function hidePointer() {
      revealed = false;
      gsap.to(uniforms.uReveal, { value: 0, duration: 0.5, ease: "power2.in" });
    }

    const onPointerMove = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setPointer(t.clientX, t.clientY);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", hidePointer);
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", hidePointer);
    container.addEventListener("touchcancel", hidePointer);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    function tick() {
      if (disposed) return;
      uniforms.uMouse.value.set(mouseTarget.x, mouseTarget.y);
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", hidePointer);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", hidePointer);
      container.removeEventListener("touchcancel", hidePointer);
      geometry.dispose();
      material.dispose();
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
