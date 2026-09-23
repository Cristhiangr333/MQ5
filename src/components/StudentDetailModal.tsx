import { useEffect, useState } from 'react';
import { X, Lock, Star } from 'lucide-react';
import { fetchStudentLevelDetail } from '../lib/teacherProgress';
import { friendlyError } from '../lib/errors';
import type { StudentLevelDetailRow } from '../lib/types';
import { REGIONS, GAME_MODES } from '../data/regionsData';
import { Spinner, ErrorBanner } from './ui';

interface StudentDetailModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

export function StudentDetailModal({ studentId, studentName, onClose }: StudentDetailModalProps) {
  const [rows, setRows] = useState<StudentLevelDetailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetchStudentLevelDetail(studentId)
      .then((data) => {
        if (!cancelled) setRows(data);
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
