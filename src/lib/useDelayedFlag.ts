import { useEffect, useState } from 'react';

/**
 * Devuelve `true` una vez que `active` lleva `delayMs` seguido en true; vuelve a
 * `false` al instante cuando `active` se apaga. Sirve para dejar respirar una
 * animación antes de mostrar un modal encima (el de victoria tapaba la escena 3D).
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  // Aunque `ready` se apague un render tarde, nunca devolvemos true si ya no está activo.
  return active && ready;
}
