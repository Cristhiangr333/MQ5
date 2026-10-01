import { useEffect, useState } from 'react';
import { X, Lock, Star, TrendingUp, Clock } from 'lucide-react';
import {
  fetchStudentLevelDetail,
  fetchStudentDifficultyBreakdown,
  fetchStudentRecentRounds,
} from '../lib/teacherProgress';
import { friendlyError } from '../lib/errors';
import type { StudentDifficultyRow, StudentLevelDetailRow, StudentRecentRound } from '../lib/types';
import { REGIONS, GAME_MODES } from '../data/regionsData';
import { Spinner, ErrorBanner } from './ui';

interface StudentDetailModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Fácil', 2: 'Medio', 3: 'Difícil' };

/** "hace 2 días", "hoy" a partir de un timestamp -- versión corta para la lista de actividad. */
function shortTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function StudentDetailModal({ studentId, studentName, onClose }: StudentDetailModalProps) {
  const [rows, setRows] = useState<StudentLevelDetailRow[] | null>(null);
  const [difficultyRows, setDifficultyRows] = useState<StudentDifficultyRow[] | null>(null);
  const [recentRounds, setRecentRounds] = useState<StudentRecentRound[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setDifficultyRows(null);
    setRecentRounds(null);
    setError(null);
    Promise.all([
      fetchStudentLevelDetail(studentId),
      fetchStudentDifficultyBreakdown(studentId),
      fetchStudentRecentRounds(studentId, 10),
    ])
      .then(([level, difficulty, recent]) => {
        if (cancelled) return;
        setRows(level);
        setDifficultyRows(difficulty);
        setRecentRounds(recent);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 sm:p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Progreso de ${studentName}`}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-extrabold font-['Baloo_2'] truncate">Progreso de {studentName}</h2>
          <button
            onClick={onClose}
            className="min-w-10 min-h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {!rows && !error && (
          <div role="status" className="flex flex-col items-center gap-3 text-slate-300 py-14">
            <Spinner className="w-8 h-8 text-emerald-400" />
            <p className="font-bold text-sm">Cargando su progreso...</p>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {rows && (
          <div className="space-y-5">
            {REGIONS.map((region) => {
              const regionRows = rows
                .filter((r) => r.region_id === region.id)
                .sort((a, b) => a.level_sort - b.level_sort);
              if (regionRows.length === 0) return null;

              return (
                <div key={region.id}>
                  <h3 className="text-sm font-extrabold font-['Baloo_2'] mb-2 flex items-center gap-1.5">
                    <span>{region.icon}</span>
                    <span>{region.name}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {regionRows.map((row) => {
                      const mode = GAME_MODES.find((g) => g.id === row.game_mode_id);
                      const accuracy =
                        row.questions_total > 0 ? Math.round((row.correct_count / row.questions_total) * 100) : null;

                      return (
                        <div
                          key={row.game_mode_id}
                          className={`rounded-xl border p-2.5 text-center ${
                            !row.unlocked
                              ? 'bg-slate-950/60 border-slate-800 opacity-60'
                              : 'bg-slate-800/70 border-slate-700'
                          }`}
                        >
                          <div className="text-lg">{mode?.icon ?? '🎮'}</div>
                          <p className="text-[11px] font-bold text-slate-200 leading-tight mt-0.5">
                            {mode?.name.replace(' Matemática', '').replace('Construye el ', '') ?? row.game_mode_id}
                          </p>
                          {!row.unlocked ? (
                            <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mt-1">
                              <Lock className="w-3 h-3" /> Bloqueado
                            </p>
                          ) : row.rounds_played === 0 ? (
                            <p className="text-[10px] text-slate-500 mt-1">Sin jugar aún</p>
                          ) : (
                            <>
                              <p className="flex items-center justify-center gap-0.5 text-[11px] text-amber-400 font-bold mt-1">
                                {row.best_stars} <Star className="w-3 h-3 fill-amber-400" />
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {accuracy}% de aciertos · {row.rounds_played}{' '}
                                {row.rounds_played === 1 ? 'intento' : 'intentos'}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const regionDifficulty = (difficultyRows ?? []).filter((d) => d.region_id === region.id);
                    if (regionDifficulty.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([1, 2, 3] as const).map((level) => {
                          const d = regionDifficulty.find((r) => r.difficulty === level);
                          const pct = d && d.questions_total > 0 ? Math.round((100 * d.correct_count) / d.questions_total) : null;
                          return (
                            <div
                              key={level}
                              className="flex-1 min-w-[90px] rounded-lg bg-slate-950/50 border border-slate-800 px-2.5 py-1.5"
                              title={`Dificultad ${DIFFICULTY_LABEL[level]}: ${d ? `${d.correct_count}/${d.questions_total} preguntas` : 'sin datos'}`}
                            >
                              <p className="text-[10px] text-slate-400 font-semibold">{DIFFICULTY_LABEL[level]}</p>
                              {pct === null ? (
                                <p className="text-[10px] text-slate-600">—</p>
                              ) : (
                                <>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1 mb-1">
                                    <div
                                      className={`h-full rounded-full ${
                                        pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[11px] font-bold text-slate-200">{pct}%</p>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {recentRounds && recentRounds.length > 0 && (
              <div>
                <h3 className="text-sm font-extrabold font-['Baloo_2'] mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Actividad reciente</span>
                </h3>
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
                  {recentRounds.map((round, idx) => {
                    const region = REGIONS.find((r) => r.id === round.region_id);
                    const mode = GAME_MODES.find((g) => g.id === round.game_mode_id);
                    const pct =
                      round.questions_total > 0
                        ? Math.round((100 * round.correct_count) / round.questions_total)
                        : 0;
                    return (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/60 text-xs"
                      >
                        <span className="flex items-center gap-1.5 text-slate-300 min-w-0">
                          <span>{mode?.icon ?? '🎮'}</span>
                          <span className="truncate">
                            {region?.name.replace(/^(Bosque|Montaña|Ciudad|Castillo) de la? /, '') ?? round.region_id}
                            {' · '}
                            {mode?.name.replace(' Matemática', '').replace('Construye el ', '') ?? round.game_mode_id}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0 text-slate-400">
                          <span className={!round.completed ? 'text-red-400 font-semibold' : 'font-semibold text-slate-200'}>
                            {round.correct_count}/{round.questions_total} ({pct}%)
                          </span>
                          {round.stars > 0 && (
                            <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                              {round.stars} <Star className="w-3 h-3 fill-amber-400" />
                            </span>
                          )}
                          <span className="hidden sm:flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" /> {shortTimeAgo(round.created_at)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
