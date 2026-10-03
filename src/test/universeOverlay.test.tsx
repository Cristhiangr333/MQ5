import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { RegionProgress } from '../types';

const h = vi.hoisted(() => ({ confetti: vi.fn(), playSfx: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: h.confetti }));
vi.mock('../utils/audio', () => ({ playSfx: h.playSfx, toggleAudioMute: vi.fn(), getIsMuted: vi.fn(() => false) }));

import { UniverseCompleteOverlay } from '../components/UniverseCompleteOverlay';

const MODES = ['race', 'battle', 'bridge', 'shop', 'detective'];
const mk = (id: string, i: number, stars: number[]): RegionProgress => ({
  regionId: id,
  sortOrder: i + 1,
  requiredXp: 0,
  unlocked: true,
  levels: MODES.map((m, k) => ({ gameModeId: m as never, sortOrder: k + 1, unlocked: true, bestStars: stars[k], roundsPlayed: 1 })),
});
const FULL = [
  mk('bosque', 0, [3, 3, 3, 3, 3]), // 15/15
  mk('montana', 1, [3, 2, 1, 3, 3]), // 12/15
  mk('ciudad', 2, [1, 1, 1, 1, 1]), // 5/15
  mk('castillo', 3, [2, 2, 2, 2, 2]), // 10/15
];

function setup(regions = FULL) {
  const handlers = { onExplore: vi.fn(), onReplay: vi.fn(), onPlayRegion: vi.fn() };
  render(<UniverseCompleteOverlay regions={regions} totalXp={320} {...handlers} />);
  return handlers;
}

beforeEach(() => {
  vi.useFakeTimers();
  h.confetti.mockClear();
  h.playSfx.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UniverseCompleteOverlay', () => {
  test('anuncia el final con datos reales: regiones conquistadas, XP y estrellas de cada región', () => {
    setup();
    const region = screen.getByRole('region', { name: 'Universo matemático completado' });
    expect(within(region).getByRole('heading')).toHaveTextContent(/Universo matemático completado/i);
    expect(region).toHaveTextContent('4 de 4 regiones conquistadas (100%)');
    expect(region).toHaveTextContent('XP total: 320');
    expect(screen.getByRole('button', { name: /Bosque de la Suma: 15 de 15 estrellas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Montaña de la Resta: 12 de 15 estrellas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ciudad de la Multiplicación: 5 de 15 estrellas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Castillo de la División: 10 de 15 estrellas/ })).toBeInTheDocument();
  });

  test('no inventa logros: si una región no está completa, el contador lo refleja', () => {
    setup([...FULL.slice(0, 3), mk('castillo', 3, [2, 2, 2, 2, 0])]);
    expect(screen.getByRole('region')).toHaveTextContent('3 de 4 regiones conquistadas (75%)');
  });

  test('sin marcas de terceros en ningún texto visible', () => {
    setup();
    expect(document.body.textContent ?? '').not.toMatch(/mario|nintendo|galaxy/i);
  });

  test('los botones llaman a sus acciones', () => {
    const h2 = setup();
    fireEvent.click(screen.getByRole('button', { name: /Explorar el mapa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Repetir la cinemática/ }));
    fireEvent.click(screen.getByRole('button', { name: /Montaña de la Resta/ }));
    expect(h2.onExplore).toHaveBeenCalledTimes(1);
    expect(h2.onReplay).toHaveBeenCalledTimes(1);
    expect(h2.onPlayRegion).toHaveBeenCalledWith('montana');
  });

  test('la Gran Estrella es un botón: da chispa, suena y lanza confeti; el contador se pluraliza', () => {
    setup();
    const star = screen.getByRole('button', { name: /Gran Estrella/ });
    fireEvent.click(star);
    expect(star).toHaveTextContent('1 chispa');
    fireEvent.click(star);
    expect(star).toHaveTextContent('2 chispas');
    expect(h.playSfx).toHaveBeenCalledWith('combo');
    expect(h.confetti).toHaveBeenCalledTimes(2);
  });

  test('al abrir lanza fuegos artificiales durante unos 2,5 s y luego se detienen', () => {
    setup();
    act(() => void vi.advanceTimersByTime(1000));
    const during = h.confetti.mock.calls.length;
    expect(during).toBeGreaterThanOrEqual(3);
    act(() => void vi.advanceTimersByTime(4000));
    const after = h.confetti.mock.calls.length;
    act(() => void vi.advanceTimersByTime(4000));
    expect(h.confetti.mock.calls.length).toBe(after); // ya no sigue
  });

  test('con "reducir movimiento" no hay fuegos artificiales ni confeti al tocar la estrella', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    setup();
    act(() => void vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole('button', { name: /Gran Estrella/ }));
    expect(h.confetti).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Gran Estrella/ })).toHaveTextContent('1 chispa'); // el juego sigue funcionando
  });

  test('si el confeti falla, el final no se rompe', () => {
    h.confetti.mockImplementation(() => {
      throw new Error('canvas no disponible');
    });
    setup();
    expect(() => act(() => void vi.advanceTimersByTime(500))).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Gran Estrella/ }))).not.toThrow();
    h.confetti.mockReset();
  });

  test('al cerrarse deja de lanzar fuegos artificiales (sin temporizadores sueltos)', () => {
    const { unmount } = render(
      <UniverseCompleteOverlay regions={FULL} totalXp={1} onExplore={vi.fn()} onReplay={vi.fn()} onPlayRegion={vi.fn()} />,
    );
    act(() => void vi.advanceTimersByTime(500));
    unmount();
    h.confetti.mockClear();
    act(() => void vi.advanceTimersByTime(3000));
    expect(h.confetti).not.toHaveBeenCalled();
  });
});
