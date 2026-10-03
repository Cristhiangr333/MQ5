import * as THREE from 'three';

/**
 * FX 3D del Gran Final "universo completado" (se ve sobre el mapa, con las 4 regiones
 * restauradas): una Gran Estrella dorada en el centro, un faro de luz sobre cada isla,
 * puentes de luz entre islas, corrientes de energía hacia la estrella, ondas expansivas,
 * lluvia de meteoros y polvo estelar.
 *
 * Vive en su propio módulo (y no dentro de ThreeWorldCanvas, que ya tiene ~4900 líneas)
 * para que sea aislable: ThreeWorldCanvas solo llama a create / update / camera / dispose,
 * con el mismo patrón que el FX de región desbloqueada. No depende de los datos del juego:
 * las islas entran por parámetro.
 */

export interface FinaleIsland {
  id: string;
  /** Posición 3D de la isla en el mapa. */
  position: [number, number, number];
  /** Color del tema de la región (hex "#rrggbb"). */
  color: string;
}

export interface UniverseFinaleFX {
  group: THREE.Group;
  grandStarGroup: THREE.Group;
  grandStarCore: THREE.Mesh;
  grandStarCorona: THREE.Mesh;
  grandStarRingOuter: THREE.Mesh;
  grandStarRingInner: THREE.Mesh;
  /** Un trozo de estrella por región, con su color, orbitando la Gran Estrella. */
  starShards: THREE.Mesh[];
  beacons: { mesh: THREE.Mesh; islandId: string }[];
  bridges: THREE.Mesh[];
  energyStreams: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3 }[];
  shockwaveRings: THREE.Mesh[];
  meteors: { mesh: THREE.Line; speed: number; angle: number; radius: number; y: number }[];
  stardustPoints: THREE.Points;
}

/** Centro de la Gran Estrella sobre el mapa. */
export const FINALE_STAR_POSITION: [number, number, number] = [0, 7.5, 0];

/** Duración de las dos primeras fases de la cámara (después, órbita libre). */
export const FINALE_SWEEP_END_S = 4.0;
export const FINALE_ASCENT_END_S = 8.5;

const STAR_Y = FINALE_STAR_POSITION[1];

export function createUniverseFinaleFX(islands: ReadonlyArray<FinaleIsland>): UniverseFinaleFX {
  const group = new THREE.Group();
  group.name = 'universe_finale';

  // 1. Gran Estrella central (estrella dorada de 5 puntas, extruida y biselada)
  const grandStarGroup = new THREE.Group();
  grandStarGroup.position.set(0, STAR_Y, 0);

  const starShape = new THREE.Shape();
  const numPoints = 5;
  const outerR = 1.9;
  const innerR = 0.88;
  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / numPoints - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.65,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.28,
    bevelThickness: 0.28,
  });
  starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    metalness: 0.7,
    roughness: 0.18,
  });
  const grandStarCore = new THREE.Mesh(starGeo, starMat);
  grandStarGroup.add(grandStarCore);

  // Resplandor (corona) solar
  const grandStarCorona = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  grandStarGroup.add(grandStarCorona);

  // Dos anillos planetarios que giran en sentidos opuestos
  const grandStarRingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.14, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  grandStarRingOuter.rotation.x = Math.PI / 3;
  grandStarRingOuter.rotation.y = Math.PI / 6;
  grandStarGroup.add(grandStarRingOuter);

  const grandStarRingInner = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.11, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    }),
  );
  grandStarRingInner.rotation.x = -Math.PI / 3.5;
  grandStarRingInner.rotation.z = Math.PI / 4;
  grandStarGroup.add(grandStarRingInner);

  // Un trozo de estrella por región, del color de esa región
  const shardGeo = new THREE.OctahedronGeometry(0.32, 0);
  const starShards: THREE.Mesh[] = islands.map((isl) => {
    const col = new THREE.Color(isl.color);
    const shard = new THREE.Mesh(
      shardGeo,
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.1 }),
    );
    grandStarGroup.add(shard);
    return shard;
  });

  group.add(grandStarGroup);

  // 2. Un faro de luz que sube desde cada isla
  const beacons: { mesh: THREE.Mesh; islandId: string }[] = islands.map((isl) => {
    const [ix, iy, iz] = isl.position;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.8, 38, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(isl.color),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.set(ix, iy + 16, iz);
    group.add(mesh);
    return { mesh, islandId: isl.id };
  });

  // 3. Puentes de luz que unen las islas en círculo (cada una con la siguiente)
  const bridges: THREE.Mesh[] = [];
  for (let i = 0; i < islands.length; i++) {
    const next = islands[(i + 1) % islands.length];
    const p1 = new THREE.Vector3(...islands[i].position);
    const p2 = new THREE.Vector3(...next.position);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.y += 3.2; // arco suave
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(p1.x, p1.y + 0.8, p1.z),
      mid,
      new THREE.Vector3(p2.x, p2.y + 0.8, p2.z),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.16, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    group.add(tube);
    bridges.push(tube);
  }

  // 4. Corrientes de energía de cada isla hacia la Gran Estrella
  const centerPos = new THREE.Vector3(...FINALE_STAR_POSITION);
  const energyStreams: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3 }[] = islands.map((isl) => {
    const startPos = new THREE.Vector3(isl.position[0], isl.position[1] + 1.2, isl.position[2]);
    const midPoint = new THREE.Vector3().addVectors(startPos, centerPos).multiplyScalar(0.5);
    midPoint.y += 2.0;
    const curve = new THREE.CatmullRomCurve3([startPos, midPoint, centerPos]);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.22, 8, false),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(isl.color),
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    group.add(mesh);
    return { mesh, curve };
  });

  // 5. Ondas expansivas que salen de la estrella
  const shockwaveRings: THREE.Mesh[] = [];
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.4, 36),
      new THREE.MeshBasicMaterial({
        color: r === 0 ? 0xffea00 : r === 1 ? 0x38bdf8 : 0xf43f5e,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, STAR_Y, 0);
    group.add(ring);
    shockwaveRings.push(ring);
  }

  // 6. Lluvia de meteoros (líneas doradas que cruzan el cielo)
  const meteors: UniverseFinaleFX['meteors'] = [];
  for (let m = 0; m < 14; m++) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.4, -1.8)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 }));
    const ang = Math.random() * Math.PI * 2;
    const rad = 18 + Math.random() * 14;
    const initialY = 16 + Math.random() * 12;
    line.position.set(Math.cos(ang) * rad, initialY, Math.sin(ang) * rad);
    group.add(line);
    meteors.push({ mesh: line, speed: 12 + Math.random() * 10, angle: ang, radius: rad, y: initialY });
  }

  // 7. Nube de polvo estelar
  const stardustCount = 200;
  const positions = new Float32Array(stardustCount * 3);
  const colors = new Float32Array(stardustCount * 3);
  const palette = [0xfbbf24, 0x38bdf8, 0xa855f7, 0x34d399, 0xffffff].map((c) => new THREE.Color(c));
  for (let p = 0; p < stardustCount; p++) {
    const theta = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 22;
    positions[p * 3] = Math.cos(theta) * dist;
    positions[p * 3 + 1] = 2 + Math.random() * 16;
    positions[p * 3 + 2] = Math.sin(theta) * dist;
    const col = palette[p % palette.length];
    colors[p * 3] = col.r;
    colors[p * 3 + 1] = col.g;
    colors[p * 3 + 2] = col.b;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stardustPoints = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  group.add(stardustPoints);

  return {
    group,
    grandStarGroup,
    grandStarCore,
    grandStarCorona,
    grandStarRingOuter,
    grandStarRingInner,
    starShards,
    beacons,
    bridges,
    energyStreams,
    shockwaveRings,
    meteors,
    stardustPoints,
  };
}

function setOpacity(mesh: THREE.Object3D, value: number) {
  const mat = (mesh as THREE.Mesh).material as THREE.Material | undefined;
  if (mat && 'opacity' in mat) (mat as THREE.MeshBasicMaterial).opacity = value;
}

/**
 * Anima el FX en cada fotograma.
 * @param time    segundos del reloj de la escena (para movimientos periódicos)
 * @param delta   segundos desde el fotograma anterior (para los meteoros)
 * @param elapsed segundos desde que empezó el final (para las ondas expansivas)
 */
export function updateUniverseFinaleFX(fx: UniverseFinaleFX, time: number, delta: number, elapsed: number): void {
  // Gran Estrella
  fx.grandStarGroup.position.y = STAR_Y + Math.sin(time * 2.5) * 0.35;
  fx.grandStarCore.rotation.y = time * 1.6;
  fx.grandStarCorona.scale.setScalar(1 + Math.sin(time * 4) * 0.12);
  fx.grandStarRingOuter.rotation.z = time * 0.9;
  fx.grandStarRingInner.rotation.z = -time * 1.2;

  // Trozos de estrella orbitando (repartidos en partes iguales según cuántas regiones hay)
  const n = Math.max(fx.starShards.length, 1);
  fx.starShards.forEach((shard, idx) => {
    const a = time * 2.2 + (idx * Math.PI * 2) / n;
    const rad = 2.6 + Math.sin(time * 3 + idx) * 0.3;
    shard.position.set(Math.cos(a) * rad, Math.sin(time * 3.5 + idx) * 0.5, Math.sin(a) * rad);
    shard.rotation.x += 0.04;
    shard.rotation.y += 0.06;
  });

  // Faros, corrientes y puentes pulsando
  fx.beacons.forEach((b, idx) => {
    b.mesh.rotation.y = time * 0.8 + idx;
    setOpacity(b.mesh, 0.45 + Math.sin(time * 5 + idx) * 0.2);
  });
  fx.energyStreams.forEach((s, idx) => setOpacity(s.mesh, 0.5 + Math.sin(time * 6 + idx) * 0.25));
  fx.bridges.forEach((b, idx) => setOpacity(b, 0.45 + Math.sin(time * 4 + idx) * 0.25));

  // Ondas expansivas
  fx.shockwaveRings.forEach((ring, rIdx) => {
    const prog = (elapsed * 0.8 + rIdx * 0.33) % 1;
    const scale = 1 + prog * 9.5;
    ring.scale.set(scale, scale, scale);
    setOpacity(ring, (1 - prog) * 0.75);
  });

  // Meteoros: caen y reaparecen arriba
  fx.meteors.forEach((m) => {
    m.mesh.position.y -= m.speed * delta;
    m.mesh.position.x += Math.cos(m.angle) * delta * 2;
    m.mesh.position.z += Math.sin(m.angle) * delta * 2;
    if (m.mesh.position.y < -2) {
      m.mesh.position.y = 18 + Math.random() * 10;
      m.angle = Math.random() * Math.PI * 2;
      m.mesh.position.x = Math.cos(m.angle) * m.radius;
      m.mesh.position.z = Math.sin(m.angle) * m.radius;
    }
  });

  fx.stardustPoints.rotation.y = time * 0.04;
}

export interface FinaleCameraTarget {
  pos: [number, number, number];
  look: [number, number, number];
}

/**
 * Cámara cinemática del final, en tres fases:
 *  1. (0 a 4 s) barrido bajo alrededor del archipiélago, viendo encenderse los faros;
 *  2. (4 a 8,5 s) acercamiento y ascenso para encuadrar la Gran Estrella;
 *  3. (8,5 s en adelante) órbita panorámica. `orbitAngle` lo pone quien llama, para que
 *     arrastrar con el dedo o el ratón siga girando el mapa también durante el final.
 */
export function universeFinaleCamera(elapsed: number, orbitAngle: number): FinaleCameraTarget {
  if (elapsed < FINALE_SWEEP_END_S) {
    const a = elapsed * 0.52;
    return { pos: [Math.sin(a) * 24, 11 + Math.sin(elapsed) * 1.8, Math.cos(a) * 24], look: [0, 5.0, 0] };
  }
  if (elapsed < FINALE_ASCENT_END_S) {
    const b = 2.2 + (elapsed - FINALE_SWEEP_END_S) * 0.32;
    return { pos: [Math.sin(b) * 14.5, 11.8, Math.cos(b) * 14.5], look: [0, STAR_Y, 0] };
  }
  return { pos: [Math.sin(orbitAngle) * 25, 16.5, Math.cos(orbitAngle) * 25], look: [0, 5.5, 0] };
}

/**
 * Libera TODA la memoria de GPU del FX. `disposeObjectHierarchy` de ThreeWorldCanvas solo
 * recorre `Mesh`, y este FX usa también `Line` (meteoros) y `Points` (polvo estelar): con
 * esa función se quedarían sin liberar cada vez que se repite el final.
 */
export function disposeUniverseFinaleFX(fx: UniverseFinaleFX): void {
  // Recursos únicos: los trozos de estrella comparten geometría, y liberarla N veces es ruido.
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  fx.group.traverse((obj) => {
    const o = obj as THREE.Mesh | THREE.Line | THREE.Points;
    if (o.geometry) geometries.add(o.geometry);
    const mat = o.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m));
    else if (mat) materials.add(mat);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  fx.group.clear();
}
