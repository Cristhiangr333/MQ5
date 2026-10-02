/**
 * Lógica pura de desbloqueo de regiones (sin React ni Supabase), probada con
 * `node --test` junto al resto de src/lib. Sin imports de valores a propósito:
 * node --experimental-strip-types no resuelve el resto del bundle.
 */

/** Una celebración de "región desbloqueada" que aún no se mostró al estudiante. */
export interface PendingUnlock {
  regionId: string;
  /** Nombre de la región que acaba de completar (para "Completaste X → ¡Desbloqueaste Y!"). */
  fromRegionName: string;
}

interface RegionLike {
  regionId: string;
  sortOrder: number;
  unlocked: boolean;
}

/**
 * Regiones que están desbloqueadas ahora y NO lo estaban antes, en orden de mapa
 * (Suma → Resta → Multiplicación → División). Devuelve TODAS: antes se usaba
 * `.find()` y una segunda región desbloqueada en la misma ronda se perdía.
 */
export function detectNewlyUnlocked(
  previouslyUnlocked: ReadonlySet<string>,
  regions: ReadonlyArray<RegionLike>,
): string[] {
  return regions
    .filter((r) => r.unlocked && !previouslyUnlocked.has(r.regionId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => r.regionId);
}

/**
 * Agrega celebraciones a la cola SIN pisar las que ya estaban esperando (antes un
 * único hueco `pendingUnlockRef` se sobrescribía y solo sobrevivía la última) y sin
 * duplicar una región que ya está en cola. No modifica la cola original.
 */
export function enqueueUnlocks(
  queue: ReadonlyArray<PendingUnlock>,
  regionIds: ReadonlyArray<string>,
  fromRegionName: string,
): PendingUnlock[] {
  const next = [...queue];
  for (const regionId of regionIds) {
    if (!next.some((p) => p.regionId === regionId)) next.push({ regionId, fromRegionName });
  }
  return next;
}

/**
 * Qué región hay que completar para abrir la de la posición `index`, o undefined si
 * es la primera (siempre abierta). Se usa para decir QUÉ falta ("Termina Bosque"),
 * no cuántos XP: desde la migración 0011 el XP ya no abre regiones.
 */
export function previousRegionOf<T>(regions: ReadonlyArray<T>, index: number): T | undefined {
  return index > 0 ? regions[index - 1] : undefined;
}
