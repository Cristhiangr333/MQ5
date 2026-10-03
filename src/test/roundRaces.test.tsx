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
      universeFinale?: { regions: unknown[]; totalXp: number; onExplore: () => void; onReplay: () => void } | null;
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
          'data-finale': props.universeFinale ? String(props.universeFinale.regions.length) : '',
        },
        ['bosque', 'montana', 'ciudad', 'castillo'].map((id) =>
          React.createElement('button', { key: id, onClick: () => props.onSelectRegion(id) }, `ir-${id}`),
        ),
        React.createElement('button', { onClick: props.onDismissUnlock }, 'cerrar-celebracion'),
        props.universeFinale
          ? React.createElement('button', { key: 'fx', onClick: props.universeFinale.onExplore }, 'finale-explorar')
          : null,
        props.universeFinale
          ? React.createElement('button', { key: 'fr', onClick: props.universeFinale.onReplay }, 'finale-repetir')
          : null,
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

/** Las 4 regiones abiertas y con 3 estrellas en todo; `castilloDone` decide si el Detective del Castillo está pasado. */
function universeSnapshot(castilloDone: boolean) {
  const regions: RegionProgress[] = REGION_IDS.map((id, i) => ({
    regionId: id,
    sortOrder: i + 1,
    requiredXp: 0,
    unlocked: true,
    levels: MODES.map((m, k) => ({
      gameModeId: m,
      sortOrder: k + 1,
      unlocked: true,
      bestStars: id === 'castillo' && m === 'detective' && !castilloDone ? 0 : 3,
      roundsPlayed: id === 'castillo' && m === 'detective' && !castilloDone ? 0 : 1,
    })),
  }));
  return { regions, totalXp: 900 };
}

const QUESTION = { id: 1, text: '2 + 2', category: 'add', difficulty: 1, options: [3, 4, 5], correct: 4, explanation: '' };
const QUESTION_B = { id: 2, text: '9 - 1', category: 'sub', difficulty: 1, options: [7, 8, 9], correct: 8, explanation: '' };
const level = (lives = 3) => ({
  questions: [QUESTION],
  config: { questionsPerRound: 1, secondsPerQuestion: 12, lives },
});
const twoQuestionLevel = () => ({
  questions: [QUESTION, QUESTION_B],
  config: { questionsPerRound: 2, secondsPerQuestion: 12, lives: 3 },
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


describe('Carreras de estado en la ronda', () => {
  test('"Reiniciar" dentro de los 1,4 s tras la última respuesta NO da por ganado el nivel nuevo ni reenvía la ronda vieja', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    await renderApp();
    await startDetective();

    answer(1); // última (y única) pregunta: la ronda terminará en 1,4 s
    await tick(300);
    fireEvent.click(screen.getByTitle('Reiniciar mundo actual')); // el niño reinicia antes de que termine la espera
    await tick(2000);

    expect(h.submitRound).not.toHaveBeenCalled(); // la ronda vieja nunca debió enviarse
    expect(world()).toHaveAttribute('data-won', 'false'); // el nivel nuevo NO está "ganado"
    expect(document.getElementById('option-btn-1')).not.toBeNull(); // y la pregunta 1 está lista para jugarse
  });

  test('una carga de nivel lenta NO pisa al nivel que el niño eligió después', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque', 'montana']));
    const slowA = deferred<ReturnType<typeof level>>();
    h.fetchQuestionsForLevel
      .mockReturnValueOnce(slowA.promise) // 1.er clic (Bosque): red lenta
      .mockResolvedValueOnce({ questions: [QUESTION_B], config: { questionsPerRound: 1, secondsPerQuestion: 12, lives: 3 } });
    await renderApp();

    click('ir-bosque'); // pide el nivel A (queda colgado)
    await tick();
    click('ir-montana'); // el niño cambia de idea: pide el nivel B (responde al instante)
    await tick();
    expect(screen.getByText('9 - 1')).toBeInTheDocument();

    slowA.resolve(level()); // llega tarde la respuesta de A
    await tick();
    expect(screen.getByText('9 - 1')).toBeInTheDocument(); // sigue B; A no lo pisó
    expect(screen.queryByText('2 + 2')).not.toBeInTheDocument();
  });

  test('dos respuestas en el mismo instante (ej. tecla repetida o tiempo agotado + clic) cuentan UNA sola vez', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque']));
    h.fetchQuestionsForLevel.mockResolvedValue(twoQuestionLevel());
    await renderApp();
    await startDetective();

    act(() => {
      fireEvent.keyDown(window, { key: '2' });
      fireEvent.keyDown(window, { key: '2' }); // llega antes de que React repinte
    });
    await tick(1400);

    // Con el bug, la 2.ª respuesta adelantaba también la pregunta 2 y cerraba la ronda con 1 sola respuesta.
    expect(world()).toHaveAttribute('data-won', 'false');
    expect(screen.getByText('9 - 1')).toBeInTheDocument();
    expect(h.submitRound).not.toHaveBeenCalled();
  });
});
