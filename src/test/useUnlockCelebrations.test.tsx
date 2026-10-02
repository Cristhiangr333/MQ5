import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUnlockCelebrations } from '../lib/useUnlockCelebrations';

function setup(initialCanShow = false) {
  const onShow = vi.fn();
  const hook = renderHook(({ canShow }) => useUnlockCelebrations(canShow, onShow), {
    initialProps: { canShow: initialCanShow },
  });
  return { ...hook, onShow };
}

describe('useUnlockCelebrations', () => {
  test('no muestra nada mientras no se pueda (modal de resultado abierto o fuera del mapa)', () => {
    const { result, onShow } = setup(false);
    act(() => result.current.enqueue(['montana'], 'Bosque de la Suma'));
    expect(result.current.current).toBeNull();
    expect(onShow).not.toHaveBeenCalled();
  });

  test('al poder mostrarse, sale la celebración con el nombre de la región completada', () => {
    const { result, rerender, onShow } = setup(false);
    act(() => result.current.enqueue(['montana'], 'Bosque de la Suma'));
    rerender({ canShow: true });
    expect(result.current.current).toEqual({ regionId: 'montana', fromRegionName: 'Bosque de la Suma' });
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  test('si se encolan ya con canShow, sale sin esperar a un cambio de vista', () => {
    const { result } = setup(true);
    act(() => result.current.enqueue(['montana'], 'Bosque de la Suma'));
    expect(result.current.current?.regionId).toBe('montana');
  });

  test('BUG ORIGINAL: dos desbloqueos seguidos NO se pisan; salen en orden, la Resta primero', () => {
    const { result, rerender, onShow } = setup(false);
    // Ronda 1 abre Resta, ronda 2 abre Multiplicación; el jugador aún no volvió al mapa.
    act(() => result.current.enqueue(['montana'], 'Bosque de la Suma'));
    act(() => result.current.enqueue(['ciudad'], 'Montaña de la Resta'));
    rerender({ canShow: true });
    expect(result.current.current?.regionId).toBe('montana'); // antes salía solo la última
    act(() => result.current.dismiss());
    expect(result.current.current?.regionId).toBe('ciudad');
    act(() => result.current.dismiss());
    expect(result.current.current).toBeNull();
    expect(onShow).toHaveBeenCalledTimes(2);
  });

  test('no repite una región ya encolada ni una ya mostrada', () => {
    const { result, rerender } = setup(false);
    act(() => result.current.enqueue(['montana'], 'Bosque'));
    act(() => result.current.enqueue(['montana'], 'Bosque'));
    rerender({ canShow: true });
    act(() => result.current.dismiss());
    expect(result.current.current).toBeNull(); // solo hubo una
  });

  test('una que llega mientras el jugador está en una partida espera a que vuelva al mapa', () => {
    const { result, rerender, onShow } = setup(true);
    act(() => result.current.enqueue(['montana'], 'Bosque'));
    act(() => result.current.dismiss());
    expect(result.current.current).toBeNull();
    rerender({ canShow: false }); // el jugador entra a otro nivel
    act(() => result.current.enqueue(['ciudad'], 'Montaña')); // la ronda siguiente abre otra isla
    expect(result.current.current).toBeNull(); // no se muestra encima de la partida
    rerender({ canShow: true }); // vuelve al mapa
    expect(result.current.current?.regionId).toBe('ciudad');
    expect(onShow).toHaveBeenCalledTimes(2);
  });
});
