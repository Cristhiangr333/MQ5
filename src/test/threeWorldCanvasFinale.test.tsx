import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import * as THREE from 'three';
import { REGIONS } from '../data/regionsData';

/**
 * Prueba de humo del lienzo 3D REAL (ThreeWorldCanvas) con el Gran Final. jsdom no tiene
 * WebGL, así que el renderizador es falso, pero registra la escena y la cámara que recibe
 * en cada fotograma: así se ejecutan de verdad el efecto de montaje, la cámara por fases,
 * la limpieza y la guarda de clics. NO verifica cómo se ve (eso solo se ve en un navegador).
 */
const h = vi.hoisted(() => ({
  scene: null as unknown as THREE.Scene,
  camera: null as unknown as THREE.PerspectiveCamera,
  constructed: 0,
  disposed: 0,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = document.createElement('canvas');
    shadowMap = { enabled: false, type: 0 };
    constructor() {
      h.constructed += 1;
      this.domElement.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    }
    setSize() {}
    setPixelRatio() {}
    dispose() {
      h.disposed += 1;
    }
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      h.scene = scene;
      h.camera = camera;
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

import { ThreeWorldCanvas } from '../components/ThreeWorldCanvas';

let now = 1000;
let queue: FrameRequestCallback[] = [];

/** Corre `n` fotogramas de `dtMs` ms cada uno (el reloj de THREE y performance.now avanzan juntos). */
function frames(n: number, dtMs = 16) {
  for (let i = 0; i < n; i++) {
    now += dtMs;
    const cbs = queue;
    queue = [];
    act(() => cbs.forEach((cb) => cb(now)));
  }
}

const baseProps = {
  viewMode: 'map' as const,
  currentRegionId: 'bosque',
  gameMode: 'race' as never,
  questionIndex: 0,
  totalQuestions: 5,
  isCorrect: null,
  heroHp: 3,
  enemyHp: 3,
  bridgeBuiltSegments: 0,
};

function mount(over: Partial<React.ComponentProps<typeof ThreeWorldCanvas>> = {}) {
  const onSelectRegion = vi.fn();
  const onWebGLError = vi.fn();
  const ui = (extra: Partial<React.ComponentProps<typeof ThreeWorldCanvas>> = {}) => (
    <ThreeWorldCanvas {...baseProps} onSelectRegion={onSelectRegion} onWebGLError={onWebGLError} {...over} {...extra} />
  );
  const view = render(ui());
  return { ...view, onSelectRegion, onWebGLError, rerenderWith: (extra: Partial<React.ComponentProps<typeof ThreeWorldCanvas>>) => view.rerender(ui(extra)) };
}

const finaleGroup = () => h.scene.getObjectByName('universe_finale');
const horizontalDistance = () => Math.hypot(h.camera.position.x, h.camera.position.z);

beforeEach(() => {
  now = 1000;
  queue = [];
  h.constructed = 0;
  h.disposed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  // Contexto 2D de mentira: la escena dibuja texturas en <canvas> (jsdom no lo implementa)
  const ctx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }) },
    { get: (t, p) => (p in t ? (t as never)[p] : () => undefined), set: () => true },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === '2d' ? ctx : null)) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ThreeWorldCanvas · Gran Final (lienzo real, renderizador falso)', () => {
  test('el lienzo monta y corre fotogramas en el mapa sin el final (el comportamiento de siempre)', () => {
    const { onWebGLError } = mount();
    expect(h.constructed).toBe(1);
    frames(20);
    expect(onWebGLError).not.toHaveBeenCalled();
    expect(finaleGroup()).toBeUndefined();
    expect(h.camera.position.toArray().every(Number.isFinite)).toBe(true);
  });

  test('al activar el final se monta su grupo en la escena, y al cerrarlo se retira', () => {
    const { rerenderWith } = mount();
    frames(5);
    rerenderWith({ universeFinaleActive: true });
    frames(5);
    const group = finaleGroup();
    expect(group).toBeDefined();
    expect(group!.children.length).toBeGreaterThan(30);
    rerenderWith({ universeFinaleActive: false });
    frames(2);
    expect(finaleGroup()).toBeUndefined();
  });

  test('"repetir": cerrar y reabrir deja UNA sola copia nueva, no acumula grupos', () => {
    const { rerenderWith } = mount();
    frames(3);
    rerenderWith({ universeFinaleActive: true });
    frames(2);
    const first = finaleGroup();
    rerenderWith({ universeFinaleActive: false });
    rerenderWith({ universeFinaleActive: true });
    frames(2);
    const second = finaleGroup();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(h.scene.children.filter((c) => c.name === 'universe_finale')).toHaveLength(1);
  });

  test('la animación corre durante 20 s sin producir valores inválidos', () => {
    const { rerenderWith } = mount();
    frames(3);
    rerenderWith({ universeFinaleActive: true });
    for (let i = 0; i < 20; i++) {
      frames(50, 20); // 1 s por vuelta
      expect(h.camera.position.toArray().every(Number.isFinite)).toBe(true);
      const g = finaleGroup()!;
      g.traverse((o) => expect([o.position.x, o.position.y, o.position.z].every(Number.isFinite)).toBe(true));
    }
  });

  test('la cámara pasa por el barrido, el acercamiento y la órbita final', () => {
    const { rerenderWith } = mount();
    frames(120); // la cámara del mapa se asienta antes de empezar
    rerenderWith({ universeFinaleActive: true });
    frames(150, 20); // ~3 s: barrido (radio 24)
    expect(horizontalDistance()).toBeGreaterThan(18);
    frames(150, 20); // hasta ~6 s: acercamiento (radio 14,5)
    expect(horizontalDistance()).toBeLessThan(horizontalDistance() + 1); // sanity: valor finito
    const closeUp = horizontalDistance();
    expect(closeUp).toBeLessThan(21);
    frames(400, 20); // hasta ~14 s: órbita panorámica
    expect(horizontalDistance()).toBeGreaterThan(22);
    expect(horizontalDistance()).toBeLessThan(27);
    expect(h.camera.position.y).toBeGreaterThan(15);
  });

  test('al cerrar el final la cámara vuelve a mirar al centro del mapa (no se queda mirando la estrella)', () => {
    const { rerenderWith } = mount();
    frames(120);
    rerenderWith({ universeFinaleActive: true });
    frames(700, 20); // órbita final: mira a (0, 5.5, 0)
    rerenderWith({ universeFinaleActive: false });
    frames(400, 20); // la cámara vuelve a su órbita normal
    const dir = new THREE.Vector3();
    h.camera.getWorldDirection(dir);
    const toCenter = new THREE.Vector3(0, 1, 0).sub(h.camera.position).normalize();
    expect(dir.dot(toCenter)).toBeGreaterThan(0.999); // mirando a (0, 1, 0), el valor por defecto del mapa
  });

  test('GUARDA DE CLICS: el mismo clic que entra a una isla no hace nada durante el final', () => {
    const { rerenderWith, onSelectRegion } = mount();
    frames(200); // cámara asentada
    const island = REGIONS[0].islandPosition;
    const p = new THREE.Vector3(island[0], island[1] + 0.6, island[2]).project(h.camera);
    const clientX = (p.x * 0.5 + 0.5) * 800;
    const clientY = (-p.y * 0.5 + 0.5) * 400;
    const click = () => window.dispatchEvent(new MouseEvent('mouseup', { clientX, clientY }));

    // Control positivo: sin el final, soltar el clic sobre la isla SÍ la selecciona.
    click();
    expect(onSelectRegion).toHaveBeenCalledWith('bosque');

    onSelectRegion.mockClear();
    rerenderWith({ universeFinaleActive: true });
    frames(2);
    click();
    expect(onSelectRegion).not.toHaveBeenCalled(); // con el final activo se ignora

    rerenderWith({ universeFinaleActive: false });
    frames(2);
    click();
    expect(onSelectRegion).toHaveBeenCalledWith('bosque'); // y al cerrarlo todo vuelve a funcionar
  });

  test('al cerrar el final se libera la memoria de GPU de TODO su grupo (incluidos meteoros y polvo)', () => {
    const { rerenderWith } = mount();
    frames(3);
    rerenderWith({ universeFinaleActive: true });
    frames(3);
    const geometries = new Set<THREE.BufferGeometry>();
    finaleGroup()!.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) geometries.add(g);
    });
    expect(geometries.size).toBeGreaterThan(30);
    let freed = 0;
    geometries.forEach((g) => g.addEventListener('dispose', () => freed++));
    rerenderWith({ universeFinaleActive: false });
    frames(2);
    expect(freed).toBe(geometries.size);
  });

  test('desmontar el lienzo con el final activo también libera su memoria', () => {
    const { rerenderWith, unmount } = mount();
    frames(3);
    rerenderWith({ universeFinaleActive: true });
    frames(3);
    const geometries = new Set<THREE.BufferGeometry>();
    finaleGroup()!.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) geometries.add(g);
    });
    let freed = 0;
    geometries.forEach((g) => g.addEventListener('dispose', () => freed++));
    unmount();
    expect(freed).toBe(geometries.size);
  });

  test('desmontar con el final activo libera todo sin errores', () => {
    const { rerenderWith, unmount } = mount();
    frames(3);
    rerenderWith({ universeFinaleActive: true });
    frames(5);
    expect(() => unmount()).not.toThrow();
    expect(h.disposed).toBeGreaterThanOrEqual(1);
  });

  test('el final solo se monta en el mapa: en la vista de juego no aparece', () => {
    const { rerenderWith } = mount({ viewMode: 'game', gameMode: 'race' as never });
    frames(5);
    rerenderWith({ universeFinaleActive: true });
    frames(5);
    expect(finaleGroup()).toBeUndefined();
  });
});
