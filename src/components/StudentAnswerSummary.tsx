import type { StudentDetailSummary } from '../lib/teacherPanelUtils';

/**
 * Cabecera del detalle de un estudiante: "Acertó 37 de 50 preguntas", con barra,
 * cuántas falló y cuánto ha jugado. Los números van siempre escritos: la barra y
 * el color solo refuerzan, nunca llevan el significado solos.
 */
export function StudentAnswerSummary({ summary }: { summary: StudentDetailSummary }) {
  const { answers, rounds, levelsWithStars } = summary;

  if (answers.total === 0) {
    return (
      <div
        role="group"
        aria-label="Resumen de respuestas"
        className="rounded-2xl bg-slate-950/50 border border-slate-800 px-4 py-3 text-sm text-slate-300"
      >
        Todavía no ha respondido preguntas.
      </div>
    );
  }

  const pct = answers.pct ?? 0;
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const toneText = pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-red-300';

  return (
    <div
      role="group"
      aria-label="Resumen de respuestas"
      className="rounded-2xl bg-slate-950/50 border border-slate-800 px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-base text-slate-200">
          Acertó <strong className="text-xl font-extrabold text-white">{answers.correct}</strong> de{' '}
          <strong className="text-xl font-extrabold text-white">{answers.total}</strong> preguntas
        </p>
        <p className={`text-lg font-extrabold ${toneText}`}>{pct}%</p>
      </div>
      <div
        className="h-2 rounded-full bg-slate-800 overflow-hidden mt-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% de aciertos`}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        {answers.wrong === 0 ? 'Sin errores' : `${answers.wrong} ${answers.wrong === 1 ? 'fallada' : 'falladas'}`}
        {' · '}
        {rounds} {rounds === 1 ? 'ronda' : 'rondas'} jugadas
        {' · '}
        {levelsWithStars} {levelsWithStars === 1 ? 'nivel' : 'niveles'} con estrellas
      </p>
    </div>
  );
}
