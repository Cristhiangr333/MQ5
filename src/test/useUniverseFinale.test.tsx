import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUniverseFinale } from '../lib/useUniverseFinale';

function setup(canShow = false) {
  const onShow = vi.fn();
  const hook = renderHook(({ canShow }) => useUniverseFinale(canShow, onShow), { initialProps: { canShow } });
  return { ...hook, onShow };
}

describe('useUniverseFinale', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('un pendiente NO se muestra mientras no se pueda (modal abierto o fuera del mapa)', () => {
    const { result, onShow } = setup(false);
    act(() => result.current.trigger());
    expect(result.current.pending).toBe(true);
    expect(result.current.active).toBe(false);
    expect(onShow).not.toHaveBeenCalled();
  });

  test('al poder mostrarse, el pendiente pasa a activo una sola vez', () => {
    const { result, rerender, onShow } = setup(false);
    act(() => result.current.trigger());
    rerender({ canShow: true });
    expect(result.current.active).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  test('dismiss cierra el final sin volver a abrirlo solo', () => {
    const { result, rerender } = setup(true);
    act(() => result.current.trigger());
    expect(result.current.active).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.active).toBe(false);
    rerender({ canShow: true });
    expect(result.current.active).toBe(false); // ya no hay pendiente
  });

  test('si el jugador sale a jugar con el final pendiente, este espera su vuelta al mapa', () => {
    const { result, rerender } = setup(false);
    act(() => result.current.trigger());
    act(() => result.current.dismiss()); // p. ej. entra a otro nivel: cierra lo activo, NO el pendiente
    expect(result.current.pending).toBe(true);
    rerender({ canShow: true });
    expect(result.current.active).toBe(true);
  });

  test('open() lo muestra ya (botón "Ver el Gran Final") y limpia el pendiente', () => {
    const { result, onShow } = setup(false);
    act(() => result.current.open());
    expect(result.current.active).toBe(true);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  test('replay() lo cierra y lo reabre desde cero tras una pausa corta', () => {
    const { result, onShow } = setup(true);
    act(() => result.current.open());
    act(() => result.current.replay());
    expect(result.current.active).toBe(false); // cerrado: el 3D se desmonta
    act(() => void vi.advanceTimersByTime(59));
    expect(result.current.active).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.active).toBe(true); // y se vuelve a montar
    expect(onShow).toHaveBeenCalledTimes(2);
  });

  test('cerrar durante un "repetir" a medias cancela la reapertura', () => {
    const { result } = setup(true);
    act(() => result.current.open());
    act(() => result.current.replay());
    act(() => result.current.dismiss());
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.active).toBe(false);
  });

  test('desmontar durante un "repetir" no deja un temporizador suelto', () => {
    const { result, unmount } = setup(true);
    act(() => result.current.open());
    act(() => result.current.replay());
    unmount();
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
