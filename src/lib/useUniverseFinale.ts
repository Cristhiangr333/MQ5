import { useCallback, useEffect, useRef, useState } from 'react';

/** Pausa entre cerrar y reabrir al "repetir": deja que el 3D desmonte el final y lo monte de cero. */
const REPLAY_GAP_MS = 60;

/**
 * Estado del Gran Final "universo completado".
 *
 * - `trigger()` lo deja PENDIENTE (lo llama finishRound al detectar la transición).
 * - Un pendiente se muestra solo, apenas `canShow` sea true (el jugador está en el mapa,
 *   sin modal de resultado ni otra celebración encima): igual que las celebraciones de isla.
 * - `open()` lo muestra ya (botón "Ver el Gran Final" del mapa, para volver a verlo).
 * - `dismiss()` lo cierra; NO borra un pendiente (si el jugador sale a rejugar, el final
 *   sigue esperando a que vuelva al mapa).
 * - `replay()` lo reinicia desde cero (cierra y vuelve a abrir).
 */
export function useUniverseFinale(canShow: boolean, onShow?: () => void) {
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(false);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReplayTimer = useCallback(() => {
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }, []);

  const trigger = useCallback(() => setPending(true), []);

  const open = useCallback(() => {
    clearReplayTimer();
    setPending(false);
    setActive(true);
    onShowRef.current?.();
  }, [clearReplayTimer]);

  const dismiss = useCallback(() => {
    clearReplayTimer();
    setActive(false);
  }, [clearReplayTimer]);

  const replay = useCallback(() => {
    clearReplayTimer();
    setActive(false);
    replayTimerRef.current = setTimeout(() => {
      replayTimerRef.current = null;
      setActive(true);
      onShowRef.current?.();
    }, REPLAY_GAP_MS);
  }, [clearReplayTimer]);

  useEffect(() => {
    if (!canShow || !pending || active) return;
    setPending(false);
    setActive(true);
    onShowRef.current?.();
  }, [canShow, pending, active]);

  // Un "repetir" a medias no debe dispararse después de desmontar.
  useEffect(() => clearReplayTimer, [clearReplayTimer]);

  return { active, pending, trigger, open, dismiss, replay };
}
