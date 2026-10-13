import * as THREE from "three";

// O sólido das pranchas de Leonardo para o "De divina proportione" de Luca
// Pacioli: o rombicuboctaedro ("Vigintisex basium", 18 quadrados e 8
// triângulos). Ele nasce do QUADRADO do homem vitruviano: o quadrado é a
// face da frente de um cubo achatado no plano do papel; o cubo ganha
// profundidade (extrude) e depois as seis faces se afastam do centro,
// abrindo entre elas os outros 12 quadrados e os 8 triângulos (expand —
// a mesma topologia o tempo todo, só as posições mudam). O CÍRCULO do
// desenho vira o anel de uma esfera armilar em volta dele.
//
// Por fim o traço ganha corpo como nas pranchas "vacuum": cada face vira
// uma moldura de madeira vazada, pra que se veja através do sólido.
//
// Unidades locais: meio lado do cubo = 1 (o quadrado do desenho).

const SQ2 = Math.SQRT2;
// centro e raio do círculo do desenho, em meios-lados do quadrado
// (medidos na digitalização: o raio dá √1.5 — 1.2247 — do meio lado)
export const VITRUVIAN_CIRCLE = { cy: 0.2151, r: 1.2247 };
// centro e meio lado do quadrado no plano da figura (largura 1)
export const VITRUVIAN_SQUARE = { cx: -0.0008, cy: 0.0455, half: 0.3765 };

const RING_SEGMENTS = 160;
const FRAME_WIDTH = 0.24; // largura da moldura (aresta = 2)
const FRAME_DEPTH = 0.1; // espessura, como fração da distância ao centro

type Vtx = { k: number; s: number; a: number; b: number };

// os 24 vértices: eixo da coordenada "grande" (k), seu sinal (s) e os
// sinais das outras duas. Com expand = 0 cada trio cai num canto do cubo
const VERTS: Vtx[] = [];
for (let k = 0; k < 3; k++)
  for (const s of [1, -1])
    for (const a of [1, -1])
      for (const b of [1, -1]) VERTS.push({ k, s, a, b });

function vertexPos(v: Vtx, expand: number, extrude: number, out: THREE.Vector3) {
  const c = [0, 0, 0];
  const o1 = (v.k + 1) % 3;
  const o2 = (v.k + 2) % 3;
  c[v.k] = v.s * (1 + expand * SQ2);
  c[o1] = v.a;
  c[o2] = v.b;
  // achatado no plano do papel (z = 0) até ganhar profundidade
  c[2] *= extrude;
  return out.set(c[0], c[1], c[2]);
}

const cornerOf = (v: Vtx) => {
  const c = [0, 0, 0];
  c[v.k] = v.s;
  c[(v.k + 1) % 3] = v.a;
  c[(v.k + 2) % 3] = v.b;
  return c;
};
const sameCorner = (p: Vtx, q: Vtx) => cornerOf(p).every((x, i) => x === cornerOf(q)[i]);

// arestas: [i, j, tipo]. 0 = face da frente (o quadrado do desenho),
// 1 = resto do cubo (aparece com o extrude), 2 = ligações que só existem
// quando as faces se afastam (aparecem com o expand)
const EDGES: [number, number, number][] = [];
VERTS.forEach((v, i) => {
  VERTS.forEach((w, j) => {
    if (j <= i) return;
    if (v.k === w.k && v.s === w.s) {
      // mesma face do cubo: vizinhos diferem em exatamente um sinal
      if ((v.a !== w.a) !== (v.b !== w.b)) {
        const front = v.k === 2 && v.s === 1;
        EDGES.push([i, j, front ? 0 : 1]);
      }
    } else if (v.k !== w.k && sameCorner(v, w)) {
      EDGES.push([i, j, 2]);
    }
  });
});

// faces do sólido final, cada uma como lista de índices em ordem
function buildFaces() {
  const faces: number[][] = [];
  const P = VERTS.map((v) => vertexPos(v, 1, 1, new THREE.Vector3()));
  // 6 quadrados dos eixos
  for (let k = 0; k < 3; k++)
    for (const s of [1, -1])
      faces.push(VERTS.map((v, i) => (v.k === k && v.s === s ? i : -1)).filter((i) => i >= 0));
  // 8 triângulos, um por canto do cubo
  for (const x of [1, -1])
    for (const y of [1, -1])
      for (const z of [1, -1])
        faces.push(
          VERTS.map((v, i) => {
            const c = cornerOf(v);
            return c[0] === x && c[1] === y && c[2] === z ? i : -1;
          }).filter((i) => i >= 0),
        );
  // 12 quadrados, um por aresta do cubo: os 4 vértices mais próximos do
  // meio dessa aresta
  for (let j = 0; j < 3; j++)
    for (const su of [1, -1])
      for (const sv of [1, -1]) {
        const mid = [0, 0, 0];
        mid[(j + 1) % 3] = su;
        mid[(j + 2) % 3] = sv;
        const m = new THREE.Vector3(mid[0], mid[1], mid[2]);
        const idx = P.map((p, i) => [p.distanceTo(m), i])
          .sort((a, b) => a[0] - b[0])
          .slice(0, 4)
          .map((e) => e[1]);
        faces.push(idx);
      }
  // ordena cada face em volta do próprio centro
  return faces.map((f) => {
    const c = new THREE.Vector3();
    f.forEach((i) => c.add(P[i]));
    c.divideScalar(f.length);
    const n = c.clone().normalize();
    const u = P[f[0]].clone().sub(c).normalize();
    const w = n.clone().cross(u);
    return f
      .map((i) => {
        const d = P[i].clone().sub(c);
        return [Math.atan2(d.dot(w), d.dot(u)), i];
      })
      .sort((a, b) => a[0] - b[0])
      .map((e) => e[1]);
  });
}

// o corpo "vacuum": cada face vira uma moldura com um furo no meio. A
// parte de baixo é a de cima escalada em direção ao centro do sólido, o
// que faz as molduras vizinhas se encontrarem em meia-esquadria exata
function buildFrames() {
  const P = VERTS.map((v) => vertexPos(v, 1, 1, new THREE.Vector3()));
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, want: THREE.Vector3) => {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.dot(want) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const quad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    want: THREE.Vector3,
  ) => {
    tri(a, b, c, want);
    tri(a, c, d, want);
  };
  buildFaces().forEach((f) => {
    const outer = f.map((i) => P[i]);
    const c = new THREE.Vector3();
    outer.forEach((p) => c.add(p));
    c.divideScalar(outer.length);
    const n = c.clone().normalize();
    const inr = outer[0].clone().add(outer[1]).multiplyScalar(0.5).distanceTo(c);
    const inner = outer.map((p) => c.clone().add(p.clone().sub(c).multiplyScalar(1 - FRAME_WIDTH / inr)));
    const outerB = outer.map((p) => p.clone().multiplyScalar(1 - FRAME_DEPTH));
    const innerB = inner.map((p) => p.clone().multiplyScalar(1 - FRAME_DEPTH));
    const nIn = n.clone().negate();
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      quad(outer[i], outer[j], inner[j], inner[i], n);
      quad(outerB[i], outerB[j], innerB[j], innerB[i], nIn);
      // a parede de dentro do furo, virada pro eixo da face
      const mid = inner[i].clone().add(inner[j]).multiplyScalar(0.5);
      quad(inner[i], inner[j], innerB[j], innerB[i], c.clone().sub(mid));
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export type PacioliState = {
  draw: number; // o quadrado e o círculo se desenhando por cima do papel
  extrude: number; // o quadrado ganha profundidade: cubo
  expand: number; // o cubo se abre no rombicuboctaedro
  fan: number; // os outros anéis da esfera armilar se abrindo
  body: number; // as molduras de madeira se materializando
  opacity: number;
  time: number;
};

export function createPacioli() {
  const group = new THREE.Group();
  group.visible = false;

  const lineUniforms = {
    uDraw: { value: 0 },
    uOpacity: { value: 1 },
    uKindAlpha: { value: new THREE.Vector4(1, 0, 0, 0) },
    uRingAlpha: { value: 1 },
    uColor: { value: new THREE.Color(0xd9b46a) },
  };
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: lineUniforms,
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aT;
      varying float vKind;
      varying float vT;
      void main() {
        vKind = aKind;
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDraw;
      uniform float uOpacity;
      uniform vec4 uKindAlpha;
      uniform float uRingAlpha;
      uniform vec3 uColor;
      varying float vKind;
      varying float vT;
      void main() {
        if (vT > uDraw) discard;
        // 0-3: frente, cubo, ligações, anéis novos; 4: o círculo do desenho
        float a = vKind < 0.5 ? uKindAlpha.x
          : vKind < 1.5 ? uKindAlpha.y
          : vKind < 2.5 ? uKindAlpha.z
          : vKind < 3.5 ? uKindAlpha.w * uRingAlpha
          : uRingAlpha;
        // a ponta da pena brilha, como no traço do ornitóptero
        float tip = smoothstep(uDraw - 0.08, uDraw, vT) * step(uDraw, 0.999);
        gl_FragColor = vec4(uColor * (0.8 + tip * 1.8), uOpacity * a * (0.6 + tip * 0.4));
      }
    `,
    transparent: true,
    depthWrite: false,
    // com teste de profundidade: as arestas e os anéis de trás não podem
    // aparecer por cima da madeira da frente
    blending: THREE.AdditiveBlending,
  });

  // ---------- arestas do sólido (posições recalculadas a cada quadro) ----------
  const edgePos = new Float32Array(EDGES.length * 6);
  const edgeKind = new Float32Array(EDGES.length * 2);
  const edgeT = new Float32Array(EDGES.length * 2);
  EDGES.forEach(([, , kind], e) => {
    edgeKind[e * 2] = edgeKind[e * 2 + 1] = kind;
  });
  // o quadrado se desenha em volta, as quatro arestas ao mesmo tempo,
  // cada uma de um canto ao seguinte (sentido anti-horário)
  const ccw = (v: Vtx) => [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].findIndex(([a, b]) => a === v.a && b === v.b);
  EDGES.forEach(([i, j, kind], e) => {
    if (kind !== 0) return;
    const startIsI = (ccw(VERTS[i]) + 1) % 4 === ccw(VERTS[j]);
    edgeT[e * 2] = startIsI ? 0 : 1;
    edgeT[e * 2 + 1] = startIsI ? 1 : 0;
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute("aKind", new THREE.BufferAttribute(edgeKind, 1));
  edgeGeo.setAttribute("aT", new THREE.BufferAttribute(edgeT, 1));
  const edgeLines = new THREE.LineSegments(edgeGeo, lineMaterial);
  edgeLines.frustumCulled = false;
  edgeLines.renderOrder = 6;
  group.add(edgeLines);

  // ---------- anéis: o círculo do desenho + dois que se abrem dele ----------
  const ringVerts = 3 * RING_SEGMENTS * 2;
  const ringPos = new Float32Array(ringVerts * 3);
  const ringKind = new Float32Array(ringVerts);
  const ringT = new Float32Array(ringVerts);
  for (let r = 0; r < 3; r++)
    for (let s = 0; s < RING_SEGMENTS; s++)
      for (let e = 0; e < 2; e++) {
        const vi = (r * RING_SEGMENTS + s) * 2 + e;
        ringKind[vi] = r === 0 ? 4 : 3;
        // o círculo se desenha a partir de baixo — onde ele toca o
        // quadrado no desenho — pelos dois lados ao mesmo tempo
        // (th = 0 embaixo: T vai de 0 ali a 1 no topo)
        const th = ((s + e) / RING_SEGMENTS) * Math.PI * 2;
        ringT[vi] = r === 0 ? Math.min(th, Math.PI * 2 - th) / Math.PI : 0;
      }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
  ringGeo.setAttribute("aKind", new THREE.BufferAttribute(ringKind, 1));
  ringGeo.setAttribute("aT", new THREE.BufferAttribute(ringT, 1));
  const ringLines = new THREE.LineSegments(ringGeo, lineMaterial);
  ringLines.frustumCulled = false;
  ringLines.renderOrder = 6;
  group.add(ringLines);

  // ---------- o corpo: molduras de madeira ----------
  const bodyUniforms = { uBody: { value: 0 }, uFade: { value: 1 } };
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xa87a48,
    roughness: 0.58,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  bodyMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uBody = bodyUniforms.uBody;
    shader.uniforms.uFade = bodyUniforms.uFade;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = transformed;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vLocal;
        uniform float uBody;
        uniform float uFade;`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        // a madeira sobe de baixo pra cima, com a frente irregular
        vec3 q = vLocal / 2.8;
        float n = sin(q.x * 9.1 + q.z * 5.3) * sin(q.y * 11.7 - q.x * 6.2);
        float order = dot(q, normalize(vec3(-0.35, 0.9, 0.25))) * 0.5 + 0.5 + n * 0.05;
        if (order > uBody) discard;`,
      )
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.rgb *= uFade;",
      );
  };
  const bodyGeo = buildFrames();
  const body = new THREE.Mesh(bodyGeo, bodyMaterial);
  body.visible = false;
  body.renderOrder = 1;
  group.add(body);

  const v = new THREE.Vector3();
  const w = new THREE.Vector3();

  function update(st: PacioliState) {
    const { extrude, expand } = st;
    EDGES.forEach(([i, j], e) => {
      vertexPos(VERTS[i], expand, extrude, v);
      vertexPos(VERTS[j], expand, extrude, w);
      edgePos.set([v.x, v.y, v.z, w.x, w.y, w.z], e * 6);
    });
    edgeGeo.attributes.position.needsUpdate = true;

    // o centro do círculo desce até o centro do cubo (no desenho ele está
    // no umbigo, acima do centro do quadrado), e o raio cresce até
    // envolver o sólido inteiro
    const cy = VITRUVIAN_CIRCLE.cy * (1 - extrude);
    const r = VITRUVIAN_CIRCLE.r + (1.78 - VITRUVIAN_CIRCLE.r) * extrude + (2.9 - 1.78) * expand;
    const spin = st.time * 0.12 * st.fan;
    for (let ring = 0; ring < 3; ring++) {
      const phi = ring === 0 ? spin * 0.5 : ring * (Math.PI / 3) * st.fan + spin;
      // os anéis novos também tombam um pouco: viram uma esfera, não um leque
      const tilt = ring === 0 ? 0 : (ring === 1 ? 0.5 : -0.5) * st.fan;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const ct = Math.cos(tilt);
      const stl = Math.sin(tilt);
      for (let s = 0; s < RING_SEGMENTS; s++)
        for (let e = 0; e < 2; e++) {
          const th = ((s + e) / RING_SEGMENTS) * Math.PI * 2;
          // th = 0 embaixo
          let x = r * Math.sin(th);
          let y = -r * Math.cos(th);
          let z = 0;
          // tomba em volta de x, depois gira em volta de y
          const y2 = y * ct - z * stl;
          z = y * stl + z * ct;
          y = y2;
          const x2 = x * cp + z * sp;
          z = -x * sp + z * cp;
          x = x2;
          const o = ((ring * RING_SEGMENTS + s) * 2 + e) * 3;
          ringPos[o] = x;
          ringPos[o + 1] = y + cy;
          ringPos[o + 2] = z;
        }
    }
    ringGeo.attributes.position.needsUpdate = true;

    const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    lineUniforms.uDraw.value = st.draw * 1.08;
    // o traço cede lugar à madeira (as arestas coincidem com a quina das
    // molduras: um fio por cima delas só brigaria com a profundidade)
    const edgeFade = 1 - ramp(0.3, 0.95, st.body);
    lineUniforms.uOpacity.value = st.opacity;
    lineUniforms.uKindAlpha.value.set(
      edgeFade,
      ramp(0.02, 0.3, extrude) * edgeFade,
      ramp(0.0, 0.18, expand) * edgeFade,
      st.fan,
    );
    // os anéis recuam quando a madeira chega: são o andaime, não a obra
    lineUniforms.uRingAlpha.value = 1 - st.body * 0.6;

    body.visible = st.body > 0.001;
    bodyUniforms.uBody.value = st.body * 1.15;
    bodyUniforms.uFade.value = st.opacity;
  }

  return {
    group,
    update,
    dispose() {
      lineMaterial.dispose();
      bodyMaterial.dispose();
      edgeGeo.dispose();
      ringGeo.dispose();
      bodyGeo.dispose();
    },
  };
}
