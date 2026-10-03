import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
  FINALE_ASCENT_END_S,
  FINALE_STAR_POSITION,
  FINALE_SWEEP_END_S,
  createUniverseFinaleFX,
  disposeUniverseFinaleFX,
  universeFinaleCamera,
  updateUniverseFinaleFX,
} from '../components/universeFinaleFX';
import { REGIONS } from '../data/regionsData';

const ISLANDS = REGIONS.map((r) => ({ id: r.id, position: r.islandPosition, color: r.themeColor }));

describe('universeFinaleFX · construcción', () => {
  test('crea una pieza por región: faro, trozo de estrella, corriente y puente', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    expect(ISLANDS).toHaveLength(4);
    expect(fx.beacons.map((b) => b.islandId)).toEqual(['bosque', 'montana', 'ciudad', 'castillo']);
    expect(fx.starShards).toHaveLength(4);
    expect(fx.energyStreams).toHaveLength(4);
    expect(fx.bridges).toHaveLength(4); // círculo cerrado: bosque→montaña→ciudad→castillo→bosque
    expect(fx.shockwaveRings).toHaveLength(3);
    expect(fx.meteors).toHaveLength(14);
  });

  test('los faros nacen sobre su isla y toman el color de su región', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    fx.beacons.forEach((b, i) => {
      const [x, y, z] = ISLANDS[i].position;
      expect(b.mesh.position.toArray()).toEqual([x, y + 16, z]);
      const mat = b.mesh.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHexString()).toBe(new THREE.Color(ISLANDS[i].color).getHexString());
    });
  });

  test('la Gran Estrella está en el centro, a la altura prevista', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    expect(fx.grandStarGroup.position.toArray()).toEqual(FINALE_STAR_POSITION);
  });

  test('la estrella es solo una estrella dorada (sin rostro ni piezas extra)', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    // El núcleo no lleva hijos: el diseño original le añadía "ojos" que copiaban a un personaje ajeno.
    expect(fx.grandStarCore.children).toHaveLength(0);
  });

  test('con otra cantidad de regiones se adapta (no está fijo a 4 ni a 5)', () => {
    const three = createUniverseFinaleFX(ISLANDS.slice(0, 3));
    expect(three.beacons).toHaveLength(3);
    expect(three.bridges).toHaveLength(3);
    const none = createUniverseFinaleFX([]);
    expect(none.beacons).toHaveLength(0);
    expect(() => updateUniverseFinaleFX(none, 1, 0.016, 1)).not.toThrow();
  });
});

describe('universeFinaleFX · animación', () => {
  test('cada fotograma mueve la estrella, los trozos y las ondas sin producir NaN', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    const before = fx.grandStarCore.rotation.y;
    updateUniverseFinaleFX(fx, 2.0, 0.016, 3.0);
    expect(fx.grandStarCore.rotation.y).not.toBe(before);
    for (const s of fx.starShards) expect(s.position.toArray().every(Number.isFinite)).toBe(true);
    for (const r of fx.shockwaveRings) {
      expect(Number.isFinite(r.scale.x)).toBe(true);
      expect((r.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThanOrEqual(0);
      expect((r.material as THREE.MeshBasicMaterial).opacity).toBeLessThanOrEqual(0.75);
    }
  });

  test('los meteoros caen y reaparecen arriba al salir del cielo', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    const m = fx.meteors[0];
    m.mesh.position.y = -5; // ya cayó por debajo del límite
    updateUniverseFinaleFX(fx, 1, 0.016, 1);
    expect(m.mesh.position.y).toBeGreaterThanOrEqual(18);
  });

  test('el pulso de los faros se mantiene en un rango de opacidad válido durante mucho tiempo', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    for (let t = 0; t < 60; t += 0.37) {
      updateUniverseFinaleFX(fx, t, 0.016, t);
      for (const b of fx.beacons) {
        const o = (b.mesh.material as THREE.MeshBasicMaterial).opacity;
        expect(o).toBeGreaterThanOrEqual(0.25);
        expect(o).toBeLessThanOrEqual(0.65);
      }
    }
  });
});

describe('universeFinaleFX · cámara', () => {
  test('tres fases: barrido, acercamiento a la estrella y órbita libre', () => {
    const sweep = universeFinaleCamera(1, 0);
    expect(sweep.look).toEqual([0, 5, 0]);
    expect(Math.hypot(sweep.pos[0], sweep.pos[2])).toBeCloseTo(24, 5);

    const ascent = universeFinaleCamera(FINALE_SWEEP_END_S + 0.5, 0);
    expect(ascent.look).toEqual([0, FINALE_STAR_POSITION[1], 0]); // mira a la estrella
    expect(Math.hypot(ascent.pos[0], ascent.pos[2])).toBeCloseTo(14.5, 5); // más cerca

    const orbit = universeFinaleCamera(FINALE_ASCENT_END_S + 1, Math.PI / 2);
    expect(orbit.pos[0]).toBeCloseTo(25, 5); // sin(π/2) · 25
    expect(orbit.pos[1]).toBe(16.5);
  });

  test('en la órbita libre el ángulo de arrastre del jugador manda', () => {
    const a = universeFinaleCamera(20, 0);
    const b = universeFinaleCamera(20, Math.PI);
    expect(a.pos[2]).toBeGreaterThan(0);
    expect(b.pos[2]).toBeLessThan(0);
  });

  test('nunca devuelve valores no numéricos, en ninguna fase', () => {
    for (let t = 0; t < 40; t += 0.25) {
      const c = universeFinaleCamera(t, t * 0.3);
      expect([...c.pos, ...c.look].every(Number.isFinite)).toBe(true);
    }
  });
});

describe('universeFinaleFX · limpieza de memoria', () => {
  test('dispose libera TODAS las geometrías y materiales, incluidos meteoros (Line) y polvo (Points)', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    fx.group.traverse((o) => {
      const x = o as THREE.Mesh;
      if (x.geometry) geos.add(x.geometry);
      const m = x.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mats.add(mm));
      else if (m) mats.add(m);
    });
    expect(geos.size).toBeGreaterThan(30);

    let geoDisposed = 0;
    let matDisposed = 0;
    geos.forEach((g) => g.addEventListener('dispose', () => geoDisposed++));
    mats.forEach((m) => m.addEventListener('dispose', () => matDisposed++));

    disposeUniverseFinaleFX(fx);
    expect(geoDisposed).toBe(geos.size);
    expect(matDisposed).toBe(mats.size);
    expect(fx.group.children).toHaveLength(0);
  });

  test('los meteoros y el polvo SÍ se liberan (lo que la limpieza genérica de Mesh dejaba)', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    let lineDisposed = 0;
    fx.meteors.forEach((m) => m.mesh.geometry.addEventListener('dispose', () => lineDisposed++));
    let pointsDisposed = 0;
    fx.stardustPoints.geometry.addEventListener('dispose', () => pointsDisposed++);
    disposeUniverseFinaleFX(fx);
    expect(lineDisposed).toBe(14);
    expect(pointsDisposed).toBe(1);
  });

  test('dispose se puede llamar dos veces sin error (desmontar tras limpiar)', () => {
    const fx = createUniverseFinaleFX(ISLANDS);
    disposeUniverseFinaleFX(fx);
    expect(() => disposeUniverseFinaleFX(fx)).not.toThrow();
  });
});
