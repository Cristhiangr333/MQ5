/**
 * "Universo completado": el estudiante pasó los 5 niveles de las 4 regiones.
 * Lógica pura (sin React ni THREE), probada con `node --test` junto al resto de src/lib.
 *
 * Un nivel está "pasado" cuando tiene al menos 1 estrella: el servidor solo da
 * estrellas a una ronda COMPLETADA (submit_round: `v_stars := 0` si no se completó),
 * y `bestStars` es el máximo histórico. Así que `bestStars >= 1` equivale a
 * "pasó ese nivel", igual que hace get_my_progress en SQL.
 */

interface LevelLike {
  bestStars: number;
}

interface RegionLike {
  levels: ReadonlyArray<LevelLike>;
}

/** Estrellas máximas por nivel (1, 2 o 3 según aciertos). */
export const MAX_STARS_PER_LEVEL = 3;

/** ¿Pasó TODOS los niveles de TODAS las regiones? Sin regiones cargadas: false. */
export function isUniverseComplete(regions: ReadonlyArray<RegionLike>): boolean {
  return (
    regions.length > 0 &&
    regions.every((r) => r.levels.length > 0 && r.levels.every((l) => l.bestStars >= 1))
  );
}

/**
 * ¿Esta ronda fue la que completó el universo? Solo en la TRANSICIÓN de "incompleto" a
 * "completo": quien ya lo tenía completo y rejuega un nivel no vuelve a disparar el final.
 */
export function didCompleteUniverse(
  before: ReadonlyArray<RegionLike>,
  after: ReadonlyArray<RegionLike>,
): boolean {
  return !isUniverseComplete(before) && isUniverseComplete(after);
}

/** Estrellas conseguidas y máximas posibles de una región (para mostrar "⭐ 14/15"). */
export function regionStarTotals(region: RegionLike): { stars: number; max: number } {
  return {
    stars: region.levels.reduce((sum, l) => sum + l.bestStars, 0),
    max: region.levels.length * MAX_STARS_PER_LEVEL,
  };
}
