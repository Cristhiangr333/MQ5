import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RegionProgress } from '../types';

/**
 * Cableado del Gran Final dentro del WorldViewport REAL: qué recibe cada motor (3D / ilustrado),
 * cuándo aparece el overlay y que no se pisa con la celebración de isla. Los dos motores y la
 * celebración de isla se simulan con dobles que muestran las props que reciben.
 */
vi.mock('../components/ThreeWorldCanvas', async () => {
  const React = await import('react');
  return {
    ThreeWorldCanvas: (p: { universeFinaleActive?: boolean; onWebGLError?: () => void }) =>
      React.createElement(
        'div',
        { 'data-testid': 'three', 'data-finale': String(!!p.universeFinaleActive) },
        React.createElement('button', { onClick: p.onWebGLError }, 'fallar-webgl'),
      ),
  };
});
vi.mock('../components/IllustratedWorldViewport', async () => {
  const React = await import('react');
  return {
    IllustratedWorldViewport: (p: { universeFinaleActive?: boolean }) =>
      React.createElement('div', { 'data-testid': 'illustrated', 'data-finale': String(!!p.universeFinaleActive) }),
  };
});
vi.mock('../components/GalaxyUnlockOverlay', async () => {
  const React = await import('react');
  return { GalaxyUnlockOverlay: () => React.createElement('div', { 'data-testid': 'galaxy-unlock' }) };
});
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/audio', () => ({ playSfx: vi.fn(), toggleAudioMute: vi.fn(), getIsMuted: vi.fn(() => false) }));

import { WorldViewport } from '../components/WorldViewport';

const MODES = ['race', 'battle', 'bridge', 'shop', 'detective'];
const REGIONS_DONE: RegionProgress[] = ['bosque', 'montana', 'ciudad', 'castillo'].map((id, i) => ({
  regionId: id,
  sortOrder: i + 1,
  requiredXp: 0,
  unlocked: true,
  levels: MODES.map((m, k) => ({ gameModeId: m as never, sortOrder: k + 1, unlocked: true, bestStars: 3, roundsPlayed: 1 })),
}));

function props(over: Partial<React.ComponentProps<typeof WorldViewport>> = {}) {
  return {
    viewMode: 'map' as const,
    currentRegionId: 'bosque',
    gameMode: 'race' as never,
    questionIndex: 0,
    totalQuestions: 5,
    isCorrect: null,
    heroHp: 3,
    enemyHp: 3,
    bridgeBuiltSegments: 0,
    combo: 0,
    activeQuestion: null,
    onSelectRegion: vi.fn(),
    onToggleViewMode: vi.fn(),
    ...over,
  };
}

const finale = (over = {}) => ({
  regions: REGIONS_DONE,
  totalXp: 900,
  onExplore: vi.fn(),
  onReplay: vi.fn(),
  ...over,
});

describe('WorldViewport · Gran Final', () => {
  test('sin la prop, todo funciona como antes: sin overlay y los motores reciben false', () => {
    render(<WorldViewport {...props()} />);
    expect(screen.queryByRole('region', { name: 'Universo matemático completado' })).not.toBeInTheDocument();
    expect(screen.getByTestId('three')).toHaveAttribute('data-finale', 'false');
  });

  test('con la prop en el mapa: aparece el overlay y el motor 3D recibe la orden', () => {
    render(<WorldViewport {...props({ universeFinale: finale() })} />);
    expect(screen.getByRole('region', { name: 'Universo matemático completado' })).toBeInTheDocument();
    expect(screen.getByTestId('three')).toHaveAttribute('data-finale', 'true');
  });

  test('el motor ilustrado (respaldo si falla WebGL) también recibe la orden', () => {
    render(<WorldViewport {...props({ universeFinale: finale() })} />);
    fireEvent.click(screen.getByRole('button', { name: 'fallar-webgl' }));
    expect(screen.queryByTestId('three')).not.toBeInTheDocument();
    expect(screen.getByTestId('illustrated')).toHaveAttribute('data-finale', 'true');
    expect(screen.getByRole('region', { name: 'Universo matemático completado' })).toBeInTheDocument();
  });

  test('en la vista de juego el overlay no se dibuja', () => {
    render(<WorldViewport {...props({ viewMode: 'game', universeFinale: finale() })} />);
    expect(screen.queryByRole('region', { name: 'Universo matemático completado' })).not.toBeInTheDocument();
  });

  test('la celebración de isla no se muestra a la vez que el final', () => {
    const { rerender } = render(<WorldViewport {...props({ unlockingRegionId: 'montana' })} />);
    expect(screen.getByTestId('galaxy-unlock')).toBeInTheDocument();
    rerender(<WorldViewport {...props({ unlockingRegionId: 'montana', universeFinale: finale() })} />);
    expect(screen.queryByTestId('galaxy-unlock')).not.toBeInTheDocument();
  });

  test('los botones del overlay llegan a las acciones: explorar, repetir y rejugar una región', () => {
    const f = finale();
    const base = props({ universeFinale: f });
    render(<WorldViewport {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /Explorar el mapa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Repetir la cinemática/ }));
    fireEvent.click(screen.getByRole('button', { name: /Castillo de la División/ }));
    expect(f.onExplore).toHaveBeenCalledTimes(1);
    expect(f.onReplay).toHaveBeenCalledTimes(1);
    expect(base.onSelectRegion).toHaveBeenCalledWith('castillo');
  });
});
