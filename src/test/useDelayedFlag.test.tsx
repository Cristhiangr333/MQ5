import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDelayedFlag } from '../lib/useDelayedFlag';

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('espera el retraso antes de pasar a true', () => {
    const { result } = renderHook(({ on }) => useDelayedFlag(on, 1800), { initialProps: { on: false } });
    expect(result.current).toBe(false);
  });

  test('true solo después de delayMs seguidos activo', () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 1800), { initialProps: { on: false } });
    rerender({ on: true });
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1799));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  test('se apaga al instante cuando deja de estar activo', () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 1800), { initialProps: { on: true } });
    act(() => void vi.advanceTimersByTime(1800));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
  });

  test('si se apaga antes del retraso, nunca llega a true (reintentar rápido)', () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 1800), { initialProps: { on: true } });
    act(() => void vi.advanceTimersByTime(900));
    rerender({ on: false });
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
    // Y si vuelve a activarse, el reloj empieza de cero.
    rerender({ on: true });
    act(() => void vi.advanceTimersByTime(1799));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
