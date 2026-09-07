"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
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

// transição líquida entre recortes (técnica do hover-effect do robin-dela,
// shader próprio): um campo de ruído fbm vira vetor de deslocamento que
// entorta a obra que sai numa direção e a que entra na direção oposta,
// com o crossfade no meio — parece vidro líquido passando pela figura.
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec2 uTexASize;
  uniform vec2 uTexBSize;
  uniform vec2 uResolution;
  uniform float uProgress;
  uniform float uIntensity;

  varying vec2 vUv;

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

  // ShaderMaterial cru não recebe a codificação linear->sRGB automática
  vec3 linearToSRGB(vec3 color) {
    vec3 low = color * 12.92;
    vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(0.0031308, color));
  }

  // "background-size: cover" centrado, igual ao usado no reveal antigo
  vec2 coverUv(vec2 uv, vec2 texSize) {
    float screenRatio = uResolution.x / uResolution.y;
    float texRatio = texSize.x / texSize.y;
    vec2 newSize = screenRatio < texRatio
      ? vec2(texSize.x * (uResolution.y / texSize.y), uResolution.y)
      : vec2(uResolution.x, texSize.y * (uResolution.x / texSize.x));
    vec2 newOffset = (screenRatio < texRatio
      ? vec2((newSize.x - uResolution.x) * 0.5, 0.0)
      : vec2(0.0, (newSize.y - uResolution.y) * 0.5)) / newSize;
    return uv * (uResolution / newSize) + newOffset;
  }

  // amostra com alpha zerado fora de [0,1] — o deslocamento pode empurrar
  // o uv pra fora da textura, e sem isso a borda repetiria pixels
  vec4 sampleArt(sampler2D tex, vec2 uv) {
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    return texture2D(tex, clamp(uv, 0.0, 1.0)) * inside;
  }

  void main() {
    vec2 dispV = vec2(fbm(vUv * 3.0), fbm(vUv * 3.0 + 7.31)) - 0.5;

    vec2 uvA = coverUv(vUv + dispV * uProgress * uIntensity, uTexASize);
    vec2 uvB = coverUv(vUv - dispV * (1.0 - uProgress) * uIntensity, uTexBSize);

    vec4 colA = sampleArt(uTexA, uvA);
    vec4 colB = sampleArt(uTexB, uvB);
    vec4 mixed = mix(colA, colB, uProgress);

    gl_FragColor = vec4(linearToSRGB(mixed.rgb), mixed.a);
  }
`;

export type ArtworkCanvasHandle = {
  goTo: (index: number) => void;
};

type ArtworkCanvasProps = {
  sources: string[];
  onIndexChange?: (index: number) => void;
  // travado durante o mergulho de scroll — trocar de obra no meio do
  // zoom desalinharia a porta calibrada
  disabledRef?: React.RefObject<boolean>;
};

const ArtworkCanvas = forwardRef<ArtworkCanvasHandle, ArtworkCanvasProps>(
  function ArtworkCanvas({ sources, onIndexChange, disabledRef }, handleRef) {
    const containerRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = usePrefersReducedMotion();
    const goToRef = useRef<(i: number) => void>(() => {});

    useImperativeHandle(handleRef, () => ({
      goTo: (i: number) => goToRef.current(i),
    }));

    const sourcesKey = sources.join("|");

    useEffect(() => {
      if (prefersReducedMotion) return;
      const container = containerRef.current;
      if (!container) return;

      let disposed = false;
      let rafId = 0;

      // premultipliedAlpha:false — as texturas têm alpha "reto", e assim o
      // navegador compõe o canvas por cima do fundo/grade sem franja escura
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        uTexA: { value: null as THREE.Texture | null },
        uTexB: { value: null as THREE.Texture | null },
        uTexASize: { value: new THREE.Vector2(1, 1) },
        uTexBSize: { value: new THREE.Vector2(1, 1) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 0 },
        uIntensity: { value: 0.32 },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
      });
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geometry, material));

      const loader = new THREE.TextureLoader();
      const textures: (THREE.Texture | null)[] = sources.map(() => null);
      const sizes = sources.map(() => new THREE.Vector2(1, 1));
      sources.forEach((src, i) => {
        loader.load(src, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const img = tex.image as HTMLImageElement | undefined;
          if (img?.width && img?.height) sizes[i].set(img.width, img.height);
          textures[i] = tex;
          if (i === 0 && !uniforms.uTexA.value) {
            uniforms.uTexA.value = tex;
            uniforms.uTexASize.value.copy(sizes[0]);
          }
        });
      });

      let current = 0;
      let animating = false;

      const startTransition = (target: number) => {
        if (animating || disposed) return;
        if (disabledRef?.current) return;
        if (target === current || !textures[target] || !textures[current]) return;
        animating = true;
        uniforms.uTexB.value = textures[target];
        uniforms.uTexBSize.value.copy(sizes[target]);
        gsap.fromTo(
          uniforms.uProgress,
          { value: 0 },
          {
            value: 1,
            duration: 1.15,
            ease: "power2.inOut",
            onComplete: () => {
              uniforms.uTexA.value = textures[target];
              uniforms.uTexASize.value.copy(sizes[target]);
              uniforms.uProgress.value = 0;
              current = target;
              animating = false;
            },
          },
        );
        // avisa já no início: título/porta acompanham a transição
        onIndexChange?.(target);
      };

      goToRef.current = (i: number) => startTransition(i % sources.length);
      const advance = () => startTransition((current + 1) % sources.length);

      // avanço por MOVIMENTO de entrada, não por pointerenter: o enter
      // dispara sozinho quando um overlay acima some (o vídeo de abertura,
      // por exemplo) com o cursor parado — trocava de obra sem o usuário
      // ter feito nada. pointermove só existe com gesto real.
      let inside = false;
      const onMove = () => {
        if (!inside) {
          inside = true;
          advance();
        }
      };
      const onLeave = () => {
        inside = false;
      };
      container.addEventListener("pointermove", onMove);
      container.addEventListener("pointerleave", onLeave);

      const resizeObserver = new ResizeObserver(() => {
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        const dpr = renderer.getPixelRatio();
        uniforms.uResolution.value.set(
          container.clientWidth * dpr,
          container.clientHeight * dpr,
        );
      });
      resizeObserver.observe(container);

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
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerleave", onLeave);
        geometry.dispose();
        material.dispose();
        textures.forEach((t) => t?.dispose());
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourcesKey, prefersReducedMotion]);

    if (prefersReducedMotion) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${sources[0]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      );
    }

    return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
  },
);

export default ArtworkCanvas;
