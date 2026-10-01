import { LOW_ACCURACY_PCT, INACTIVE_DAYS } from '../lib/teacherPanelUtils';
import type { CourseSummary } from '../lib/teacherPanelUtils';

/** "1 estudiante" / "3 estudiantes". */
function students(n: number): string {
  return n === 1 ? '1 estudiante' : `${n} estudiantes`;
}

/**
 * Foto rápida de la clase para el docente: cuántos juegan, cómo van de aciertos y a
 * quién mirar primero. Se calcula con los datos que ya trae la lista (sin consultas
 * nuevas). El significado nunca depende solo del color: cada dato lleva su texto.
 */
export function CourseSummaryStrip({ summary }: { summary: CourseSummary }) {
  const { students: total, played, avgAccuracy, inactive, lowAccuracy } = summary;
  const avgTone =
    avgAccuracy === null
      ? 'text-slate-400'
      : avgAccuracy >= 80
        ? 'text-emerald-300'
        : avgAccuracy >= LOW_ACCURACY_PCT
          ? 'text-amber-300'
          : 'text-red-300';

  return (
    <div
      role="group"
      aria-label="Resumen del curso"
      className="mt-3 rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-300"
    >
      <span>
        <strong className="text-slate-100">{played}</strong> de {total} han jugado
      </span>
      <span>
        Promedio de aciertos:{' '}
        {avgAccuracy === null ? (
          <span className="text-slate-400">aún sin datos</span>
        ) : (
          <strong className={avgTone}>{avgAccuracy}%</strong>
        )}
      </span>
      {inactive > 0 && (
        <span title={`Nunca han jugado o llevan ${INACTIVE_DAYS}+ días sin jugar`}>
          <span aria-hidden="true">⚠️ </span>
          <strong className="text-amber-300">{students(inactive)}</strong> sin jugar o inactivo{inactive === 1 ? '' : 's'}
        </span>
      )}
      {lowAccuracy > 0 && (
        <span title={`Juegan, pero aciertan menos del ${LOW_ACCURACY_PCT}%`}>
          <span aria-hidden="true">📉 </span>
          <strong className="text-red-300">{students(lowAccuracy)}</strong> con pocos aciertos
        </span>
      )}
      {inactive === 0 && lowAccuracy === 0 && (
        <span className="text-emerald-300 font-semibold">
          <span aria-hidden="true">✅ </span>Nadie necesita atención ahora
        </span>
      )}
    </div>
  );
}
