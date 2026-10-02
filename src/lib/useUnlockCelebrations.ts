import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueUnlocks } from './unlocks';
import type { PendingUnlock } from './unlocks';

/**
 * Cola de celebraciones "¡región desbloqueada!".
 *
 * - `enqueue` agrega regiones nuevas SIN pisar las que esperan (antes un único ref
 *   guardaba solo la última y la de Resta se perdía cuando también se abría Multiplicación).
 * - La celebración se muestra sola, una a la vez y en orden, apenas `canShow` sea true
 *   (el jugador está en el mapa, sin el modal de resultado encima). Así no depende de
 *   por qué ruta llegó al mapa: botón, tecla M, pausa, etc.
 * - `dismiss` cierra la actual; si quedan más en la cola, sale la siguiente.
 */
export function useUnlockCelebrations(canShow: boolean, onShow?: () => void) {
  const [pending, setPending] = useState<PendingUnlock[]>([]);
  const [current, setCurrent] = useState<PendingUnlock | null>(null);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;

  const enqueue = useCallback((regionIds: readonly string[], fromRegionName: string) => {
    setPending((q) => enqueueUnlocks(q, regionIds, fromRegionName));
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!canShow || current || pending.length === 0) return;
    const [next, ...rest] = pending;
    setPending(rest);
    setCurrent(next);
    onShowRef.current?.();
  }, [canShow, current, pending]);

  return { current, enqueue, dismiss };
}
