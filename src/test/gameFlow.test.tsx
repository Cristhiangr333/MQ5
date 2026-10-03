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

/** Entra al Castillo (retoma el nivel que falta, Detective) y responde bien. */
async function winCastilloDetective() {
  click('ir-castillo');
  await tick();
  expect(document.getElementById('option-btn-1')).not.toBeNull();
  await winRound();
  await tick(1800); // el modal de victoria espera 1,8 s
}

describe('Juego completo · Gran Final del universo', () => {
  test('completar el último nivel ofrece el Gran Final y lo muestra al volver al mapa', async () => {
    h.fetchProgress.mockResolvedValueOnce(universeSnapshot(false)).mockResolvedValue(universeSnapshot(true));
    await renderApp();
    await winCastilloDetective();

    // Con el modal abierto el final NO se muestra encima; el botón dorado sustituye a "Siguiente nivel".
    expect(world()).toHaveAttribute('data-finale', '');
    expect(screen.getByRole('button', { name: /Ver el Gran Final/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente nivel/ })).not.toBeInTheDocument();

    click(/¡Ver el Gran Final!/);
    await tick();
    expect(world()).toHaveAttribute('data-view', 'map');
    expect(world()).toHaveAttribute('data-finale', '4'); // el final recibe las 4 regiones con su progreso real
  });

  test('"Explorar el mapa" lo cierra y el mapa ofrece volver a verlo; "Repetir" lo reinicia', async () => {
    h.fetchProgress.mockResolvedValueOnce(universeSnapshot(false)).mockResolvedValue(universeSnapshot(true));
    await renderApp();
    await winCastilloDetective();
    click(/¡Ver el Gran Final!/);
    await tick();

    click('finale-explorar');
    await tick();
    expect(world()).toHaveAttribute('data-finale', '');

    click(/Ver el Gran Final/); // botón del panel del mapa
    await tick();
    expect(world()).toHaveAttribute('data-finale', '4');

    click('finale-repetir');
    expect(world()).toHaveAttribute('data-finale', ''); // cerrado un instante: el 3D se desmonta y se vuelve a montar
    await tick(60);
    expect(world()).toHaveAttribute('data-finale', '4');
  });

  test('si había sido completado antes, rejugar un nivel NO dispara el final de nuevo', async () => {
    h.fetchProgress.mockResolvedValue(universeSnapshot(true));
    await renderApp();
    click('ir-castillo'); // nada pendiente: arranca el primer nivel sin las 3 estrellas
    await tick();
    expect(document.getElementById('option-btn-1')).not.toBeNull();
    await winRound();
    await tick(1800);
    expect(screen.queryByRole('button', { name: /¡Ver el Gran Final!/ })).not.toBeInTheDocument();
    click(/Volver al mapa/);
    await tick();
    expect(world()).toHaveAttribute('data-finale', '');
  });

  test('con el universo ya completo, el mapa ofrece el botón para revivir el final', async () => {
    h.fetchProgress.mockResolvedValue(universeSnapshot(true));
    await renderApp();
    click(/Ver el Gran Final/);
    await tick();
    expect(world()).toHaveAttribute('data-finale', '4');
  });

  test('sin el universo completo no existe el botón ni se muestra el final', async () => {
    h.fetchProgress.mockResolvedValue(universeSnapshot(false));
    await renderApp();
    expect(screen.queryByRole('button', { name: /Ver el Gran Final/ })).not.toBeInTheDocument();
    expect(world()).toHaveAttribute('data-finale', '');
  });

  test('ganar un nivel que NO completa el universo no ofrece el final', async () => {
    h.fetchProgress.mockResolvedValue(snapshot(['bosque'])); // solo el Bosque abierto
    await renderApp();
    await startDetective();
    await winRound();
    await tick(1800);
    expect(screen.queryByRole('button', { name: /¡Ver el Gran Final!/ })).not.toBeInTheDocument();
  });

  test('con el final pendiente, "Jugar de nuevo" no lo muestra en la partida y la tecla M sí lo trae', async () => {
    h.fetchProgress.mockResolvedValueOnce(universeSnapshot(false)).mockResolvedValue(universeSnapshot(true));
    await renderApp();
    await winCastilloDetective();
    click(/Jugar de nuevo/);
    await tick();
    expect(world()).toHaveAttribute('data-view', 'game');
    expect(world()).toHaveAttribute('data-finale', ''); // nunca encima de una partida
    fireEvent.keyDown(window, { key: 'm' });
    await tick();
    expect(world()).toHaveAttribute('data-view', 'map');
    expect(world()).toHaveAttribute('data-finale', '4'); // el pendiente esperó su vuelta al mapa
  });

  test('entrar a otro nivel con el final abierto lo cierra (no reaparece encima de la partida)', async () => {
    h.fetchProgress.mockResolvedValue(universeSnapshot(true));
    await renderApp();
    click(/Ver el Gran Final/);
    await tick();
    expect(world()).toHaveAttribute('data-finale', '4');
    click('ir-bosque'); // el final ofrece rejugar una región desde sus medallones
    await tick();
    expect(world()).toHaveAttribute('data-view', 'game');
    expect(world()).toHaveAttribute('data-finale', '');
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
