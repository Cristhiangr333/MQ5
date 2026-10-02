import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { LevelProgress, RegionProgress } from '../types';

/**
 * Flujo de juego COMPLETO a través del App real: elegir isla, responder, ganar/perder,
 * guardar la ronda, refrescar el progreso, modal de resultado y celebración de isla nueva.
 *
 * Lo único simulado: la red (lib/game), el audio, el confeti y el lienzo 3D. El lienzo se
 * reemplaza por un doble (`world`) que CUENTA cuántas veces se monta y desmonta -- así se
 * detecta si el juego destruye la escena 3D en mitad de la animación de victoria.
 * (jsdom no tiene WebGL; no sustituye mirar el juego en un navegador de verdad.)
 */

const h = vi.hoisted(() => ({
  world: { mounts: 0, unmounts: 0 },
  fetchProgress: vi.fn(),
  fetchQuestionsForLevel: vi.fn(),
  submitRound: vi.fn(),
}));

vi.mock('../lib/game', () => ({
  fetchProgress: h.fetchProgress,
  fetchQuestionsForLevel: h.fetchQuestionsForLevel,
  submitRound: h.submitRound,
}));
vi.mock('../utils/audio', () => ({
  playSfx: vi.fn(),
  toggleAudioMute: vi.fn(() => false),
  getIsMuted: vi.fn(() => false),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../components/WorldViewport', async () => {
  const React = await import('react');
  return {
    WorldViewport: (props: {
      viewMode: string;
      gameWon: boolean;
      unlockingRegionId: string | null;
      onSelectRegion: (id: string) => void;
      onDismissUnlock: () => void;
    }) => {
      React.useEffect(() => {
        h.world.mounts += 1;
        return () => {
          h.world.unmounts += 1;
        };
      }, []);
      return React.createElement(
        'div',
        {
          'data-testid': 'world',
          'data-view': props.viewMode,
          'data-won': String(props.gameWon),
          'data-unlocking': props.unlockingRegionId ?? '',
        },
        ['bosque', 'montana', 'ciudad'].map((id) =>
          React.createElement('button', { key: id, onClick: () => props.onSelectRegion(id) }, `ir-${id}`),
        ),
        React.createElement('button', { onClick: props.onDismissUnlock }, 'cerrar-celebracion'),
      );
    },
  };
});

const MODES = ['race', 'battle', 'bridge', 'shop', 'detective'] as const;
const REGION_IDS = ['bosque', 'montana', 'ciudad', 'castillo'];

function levels(unlockedCount: number, starredCount: number): LevelProgress[] {
  return MODES.map((m, i) => ({
    gameModeId: m,
    sortOrder: i + 1,
    unlocked: i < unlockedCount,
    bestStars: i < starredCount ? 3 : 0,
    roundsPlayed: i < starredCount ? 1 : 0,
  }));
}

/** Foto del progreso. `open` = islas abiertas; el Bosque tiene 4 niveles con estrellas y el 5 por jugar. */
function snapshot(open: string[], bosqueDone = false) {
  const regions: RegionProgress[] = REGION_IDS.map((id, i) => {
    const unlocked = open.includes(id);
    const lv =
      id === 'bosque' ? levels(5, bosqueDone ? 5 : 4) : unlocked ? levels(1, 0) : levels(1, 0).map((l) => l); // nivel 1 "abierto" aunque la isla no (como el servidor)
    return { regionId: id, sortOrder: i + 1, requiredXp: 0, unlocked, levels: lv };
  });
  return { regions, totalXp: 320 };
}

const QUESTION = { id: 1, text: '2 + 2', category: 'add', difficulty: 1, options: [3, 4, 5], correct: 4, explanation: '' };
const level = (lives = 3) => ({
  questions: [QUESTION],
  config: { questionsPerRound: 1, secondsPerQuestion: 12, lives },
});
const WIN = { stars: 3, xp_earned: 80, correct_count: 1, questions_total: 1, completed: true };
const LOSS = { stars: 0, xp_earned: 0, correct_count: 0, questions_total: 1, completed: false };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const world = () => screen.getByTestId('world');
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const answer = (idx: number) => fireEvent.click(document.getElementById(`option-btn-${idx}`) as HTMLElement);

async function renderApp() {
  const { default: App } = await import('../App');
  render(<App playerName="Ana" />);
  await tick(); // resuelve la carga inicial del progreso
  screen.getByTestId('world'); // (findBy* se cuelga con relojes falsos)
}

/** Entra al Bosque (retoma el nivel 5, Detective) y espera a tener la pregunta en pantalla. */
async function startDetective() {
  click('ir-bosque');
  await tick();
  expect(document.getElementById('option-btn-1')).not.toBeNull();
}

/** Responde bien y deja correr la espera de 1,4 s: la ronda termina y se guarda. */
async function winRound() {
  answer(1);
  await tick(1400);
}

beforeEach(() => {
  vi.useFakeTimers();
  h.world.mounts = 0;
  h.world.unmounts = 0;
  h.fetchProgress.mockReset();
  h.fetchQuestionsForLevel.mockReset().mockResolvedValue(level());
  h.submitRound.mockReset().mockResolvedValue(WIN);
  window.localStorage.setItem('mq5_tutorial_seen_v1', JSON.stringify(MODES)); // sin tutoriales
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('Juego completo · fin de ronda', () => {
  test('al guardar la ronda NO aparece el cargador de pantalla completa ni se desmonta el mundo', async () => {
    const refresh = deferred<ReturnType<typeof snapshot>>();
    h.fetchProgress.mockResolvedValueOnce(snapshot(['bosque'])).mockReturnValueOnce(refresh.promise);
    await renderApp();
    await startDetective();
    const unmountsBefore = h.world.unmounts;

    await winRound(); // la ronda terminó; el refresco del progreso sigue en vuelo
    expect(world()).toHaveAttribute('data-won', 'true'); // la animación de victoria está corriendo...
    // ...y no debe ser reemplazada por la pantalla "Cargando tu progreso..."
    expect(screen.queryByText(/Cargando tu progreso/)).not.toBeInTheDocument();
    expect(h.world.unmounts).toBe(unmountsBefore); // la escena 3D sigue montada

    refresh.resolve(snapshot(['bosque', 'montana'], true));
    await tick();
    expect(h.world.unmounts).toBe(unmountsBefore);
  });

  test('el modal de victoria espera 1,8 s; el de derrota sale de inmediato', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1799);
    expect(screen.queryByText(/Superado/)).not.toBeInTheDocument();
    await tick(1);
    expect(screen.getByText(/Superado/)).toBeInTheDocument();
  });

  test('derrota: el modal "Sin vidas" aparece sin esperar', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    h.fetchQuestionsForLevel.mockResolvedValue(level(1)); // 1 vida
    h.submitRound.mockResolvedValue(LOSS);
    await renderApp();
    await startDetective();
    answer(0); // mal
    await tick(1400);
    expect(screen.getByText(/Sin vidas/)).toBeInTheDocument();
  });

  test('si falla el refresco del progreso el juego NO se tumba: se avisa y se puede seguir', async () => {
    h.fetchProgress.mockResolvedValueOnce(snapshot(['bosque'])).mockRejectedValueOnce(new Error('sin red'));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    expect(screen.queryByText(/No pudimos cargar tus datos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Superado/)).toBeInTheDocument(); // el jugador ve su resultado
    expect(screen.getByRole('status')).toHaveTextContent(/No pudimos actualizar tu progreso/);
    click(/Volver al mapa/); // y puede salir al mapa
    expect(world()).toHaveAttribute('data-view', 'map');
  });

  test('la carga INICIAL que falla sí muestra el error de pantalla completa', async () => {
    h.fetchProgress.mockRejectedValue(new Error('sin red'));
    const { default: App } = await import('../App');
    render(<App playerName="Ana" />);
    await tick();
    expect(screen.getByText(/No pudimos cargar tus datos/)).toBeInTheDocument();
  });

  test('"Reintentar" tras una carga inicial fallida carga el juego', async () => {
    h.fetchProgress.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce(snapshot(['bosque']));
    const { default: App } = await import('../App');
    render(<App playerName="Ana" />);
    await tick();
    click('Reintentar');
    await tick();
    expect(screen.queryByText(/No pudimos cargar tus datos/)).not.toBeInTheDocument();
    expect(world()).toHaveAttribute('data-view', 'map');
  });
});

describe('Juego completo · escena al rejugar', () => {
  test('"Jugar de nuevo" arranca con una escena 3D nueva (como pasaba antes por accidente)', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    const mountsBefore = h.world.mounts;
    click(/Jugar de nuevo/);
    await tick();
    expect(h.world.mounts).toBe(mountsBefore + 1); // escena nueva: nada de la victoria anterior
    expect(world()).toHaveAttribute('data-won', 'false');
  });

  test('elegir OTRO nivel de la tira no remonta el lienzo (lo reconstruye el propio efecto 3D)', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    await startDetective();
    const mountsBefore = h.world.mounts;
    fireEvent.click(screen.getAllByRole('button', { name: /Carrera/ })[0]); // otro modo, misma isla
    await tick();
    expect(h.world.mounts).toBe(mountsBefore);
  });
});

describe('Juego completo · desbloqueo de islas', () => {
  test('ganar el nivel 5 de la Suma celebra la RESTA (y solo esa), al volver al mapa', async () => {
    h.fetchProgress.mockResolvedValueOnce(snapshot(['bosque'])).mockResolvedValue(snapshot(['bosque', 'montana'], true));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    expect(world()).toHaveAttribute('data-unlocking', ''); // con el modal abierto no se celebra encima
    click(/Siguiente nivel/); // no hay nivel 6: va al mapa
    await tick();
    expect(world()).toHaveAttribute('data-view', 'map');
    expect(world()).toHaveAttribute('data-unlocking', 'montana');
    click('cerrar-celebracion');
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', '');
  });

  test('dos islas abiertas en una ronda: se celebran en orden, la Resta primero', async () => {
    h.fetchProgress
      .mockResolvedValueOnce(snapshot(['bosque']))
      .mockResolvedValue(snapshot(['bosque', 'montana', 'ciudad'], true));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    click(/Volver al mapa/);
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', 'montana');
    click('cerrar-celebracion');
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', 'ciudad');
    click('cerrar-celebracion');
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', '');
  });

  test('la tecla M también muestra la celebración pendiente', async () => {
    h.fetchProgress.mockResolvedValueOnce(snapshot(['bosque'])).mockResolvedValue(snapshot(['bosque', 'montana'], true));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    click(/Jugar de nuevo/); // vuelve a jugar en vez de ir al mapa
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', '');
    fireEvent.keyDown(window, { key: 'm' });
    await tick();
    expect(world()).toHaveAttribute('data-view', 'map');
    expect(world()).toHaveAttribute('data-unlocking', 'montana');
  });

  test('una isla bloqueada no se puede jugar tocándola en el mapa', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    click('ir-ciudad');
    await tick();
    expect(h.fetchQuestionsForLevel).not.toHaveBeenCalled();
  });

  test('sin isla nueva no hay celebración', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    click(/Volver al mapa/);
    await tick();
    expect(world()).toHaveAttribute('data-unlocking', '');
  });
});
