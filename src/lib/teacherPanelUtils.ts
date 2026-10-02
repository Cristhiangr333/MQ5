/**
 * Lógica pura del panel docente (sin React ni Supabase), para poder probarla
 * con `node --test` junto al resto de src/lib. Antes vivía dentro de TeacherPanel.tsx.
 *
 * Nota: los tipos se importan con `import type` a propósito -- este archivo lo
 * ejecuta `node --experimental-strip-types`, que no resuelve imports de valores
 * hacia módulos con extensiones o dependencias del bundler.
 */
import type { StudentLevelDetailRow, StudentProgressSummary, StudentRow } from './types.ts';

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------

/**
 * Escapa un valor para una celda CSV (comillas dobles + separador ,).
 *
 * Además neutraliza "inyección de fórmulas": los estudiantes escriben su propio
 * nombre sin cuenta, y Excel/Sheets interpretan como fórmula una celda de TEXTO que
 * empieza con = + - @ (o tab / retorno de carro). Se antepone un apóstrofo para
 * que se muestre como texto. Los números reales (typeof number) no se tocan.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Arma el contenido del CSV con el progreso de un curso, listo para pegar en una planilla de notas. */
export function buildCourseCsv(
  list: StudentRow[],
  progressRows: StudentProgressSummary[],
  totalLevels: number,
): string {
  const header = [
    'Nombre',
    'Apellido',
    'XP total',
    'Regiones desbloqueadas',
    `Niveles pasados (de ${totalLevels})`,
    'Precisión (%)',
    'Rondas jugadas',
    'Última vez que jugó',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const s of [...list].sort((a, b) => a.first_name.localeCompare(b.first_name))) {
    const p = progressRows.find((r) => r.student_id === s.id);
    lines.push(
      [
        s.first_name,
        s.last_name,
        p?.total_xp ?? 0,
        p?.regions_unlocked ?? 0,
        p?.levels_passed ?? 0,
        p?.overall_accuracy ?? '',
        p?.rounds_played ?? 0,
        p?.last_played_at ? new Date(p.last_played_at).toLocaleDateString('es-CO') : 'Nunca ha jugado',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

/** Nombre de archivo seguro para la descarga del CSV de un curso. */
export function csvFileName(courseName: string): string {
  return `${courseName.replace(/[^a-z0-9áéíóúñ]+/gi, '_')}_progreso.csv`;
}

// ---------------------------------------------------------------------
// Tiempo y señales de atención
// ---------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Días sin jugar a partir de los cuales se marca al estudiante con ⚠️. */
export const INACTIVE_DAYS = 14;
/** Debajo de este % de aciertos (con muestra suficiente) el estudiante necesita refuerzo. */
export const LOW_ACCURACY_PCT = 50;
/** Rondas mínimas para considerar fiable el % de aciertos (con 1 ronda sería puro azar). */
export const MIN_ROUNDS_FOR_ACCURACY = 2;

/** "hace 2 días", "hoy", "Nunca ha jugado" a partir de un timestamp o null. */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Nunca ha jugado';
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Jugó hoy';
  if (days === 1) return 'Jugó ayer';
  if (days < 30) return `Jugó hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Jugó hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

/** Nunca jugó, o no juega hace INACTIVE_DAYS+ días: una señal simple para resaltar en la lista. */
export function needsAttention(
  progress: StudentProgressSummary | undefined,
  now: number = Date.now(),
): boolean {
  if (!progress) return false;
  if (progress.rounds_played === 0) return true;
  if (!progress.last_played_at) return true;
  return (now - new Date(progress.last_played_at).getTime()) / DAY_MS >= INACTIVE_DAYS;
}

/** Juega, pero acierta poco: necesita refuerzo aunque esté activo. */
export function hasLowAccuracy(progress: StudentProgressSummary | undefined): boolean {
  if (!progress) return false;
  if (progress.overall_accuracy === null) return false;
  if (progress.rounds_played < MIN_ROUNDS_FOR_ACCURACY) return false;
  return progress.overall_accuracy < LOW_ACCURACY_PCT;
}

// ---------------------------------------------------------------------
// Orden de la lista
// ---------------------------------------------------------------------

export type SortKey = 'name' | 'least_progress' | 'inactive';

/**
 * Ordena la lista de un curso según lo elegido: alfabético (por defecto), quién va
 * más atrás primero, o quién lleva más tiempo sin jugar primero. Los que todavía no
 * tienen datos de progreso siempre quedan al final. No modifica la lista original.
 */
export function sortStudents(
  list: StudentRow[],
  progressRows: StudentProgressSummary[],
  sortKey: SortKey,
): StudentRow[] {
  if (sortKey === 'name') return list;
  const progressOf = (s: StudentRow) => progressRows.find((r) => r.student_id === s.id);
  return [...list].sort((a, b) => {
    const pa = progressOf(a);
    const pb = progressOf(b);
    if (!pa && !pb) return 0;
    if (!pa) return 1; // sin datos: al final
    if (!pb) return -1;
    if (sortKey === 'least_progress') {
      // Desempate: a igualdad de niveles, primero quien tiene menos XP.
      return pa.levels_passed - pb.levels_passed || pa.total_xp - pb.total_xp;
    }
    // 'inactive': nunca jugó primero, luego de más antiguo a más reciente
    const ta = pa.last_played_at ? new Date(pa.last_played_at).getTime() : -Infinity;
    const tb = pb.last_played_at ? new Date(pb.last_played_at).getTime() : -Infinity;
    if (ta === tb) return 0; // evita NaN de -Infinity - -Infinity
    return ta < tb ? -1 : 1;
  });
}

// ---------------------------------------------------------------------
// Resumen del curso
// ---------------------------------------------------------------------

export interface CourseSummary {
  /** Estudiantes del curso. */
  students: number;
  /** Cuántos han jugado al menos una ronda. */
  played: number;
  /** Promedio de % de aciertos entre quienes tienen dato (null si nadie juega aún). */
  avgAccuracy: number | null;
  /** Nunca jugaron o llevan INACTIVE_DAYS+ días sin jugar. */
  inactive: number;
  /** Juegan pero aciertan menos de LOW_ACCURACY_PCT. */
  lowAccuracy: number;
}

/** Foto rápida de la clase a partir de las filas de progreso que ya trae la lista. */
export function summarizeCourse(
  list: StudentRow[],
  progressRows: StudentProgressSummary[],
  now: number = Date.now(),
): CourseSummary {
  let played = 0;
  let inactive = 0;
  let lowAccuracy = 0;
  let accSum = 0;
  let accCount = 0;
  for (const s of list) {
    const p = progressRows.find((r) => r.student_id === s.id);
    if (!p) continue; // sin datos aún: no cuenta para nada
    if (p.rounds_played > 0) played += 1;
    if (needsAttention(p, now)) inactive += 1;
    if (hasLowAccuracy(p)) lowAccuracy += 1;
    if (p.overall_accuracy !== null) {
      accSum += p.overall_accuracy;
      accCount += 1;
    }
  }
  return {
    students: list.length,
    played,
    avgAccuracy: accCount > 0 ? Math.round(accSum / accCount) : null,
    inactive,
    lowAccuracy,
  };
}

// ---------------------------------------------------------------------
// Detalle por estudiante
// ---------------------------------------------------------------------

/**
 * ¿Se muestra el nivel como "Bloqueado" al docente?
 *  - Nivel anterior sin pasar (regla de siempre), o
 *  - su región sigue cerrada por XP (migración 0010) y no tiene rondas ahí.
 *
 * Si hay rondas jugadas nunca se oculta el dato, aunque la región figure cerrada.
 * Si `region_unlocked` no llega (0010 sin aplicar) rige solo la regla de siempre.
 */
export function isLevelLocked(row: StudentLevelDetailRow): boolean {
  if (!row.unlocked) return true;
  return row.region_unlocked === false && row.rounds_played === 0;
}

/** ¿La región entera está cerrada para este estudiante (sin ninguna ronda jugada en ella)? */
export function isRegionLocked(regionRows: StudentLevelDetailRow[]): boolean {
  return (
    regionRows.length > 0 &&
    regionRows.every((r) => r.region_unlocked === false) &&
    regionRows.every((r) => r.rounds_played === 0)
  );
}
