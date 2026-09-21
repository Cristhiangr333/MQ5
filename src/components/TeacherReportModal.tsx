import React from 'react';
import { X, Award, CheckCircle2, BookOpen, UserCheck, Flame, Compass } from 'lucide-react';
import { PlayerStats } from '../types';
import { WORLDS } from '../data/worldsData';

interface TeacherReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
}

export const TeacherReportModal: React.FC<TeacherReportModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  const totalAnswered = stats.totalAnswered || 0;
  const totalCorrect = stats.totalCorrect || 0;
  const globalAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const competencies = [
    {
      name: 'Operaciones y cálculo mental ágil',
      worldName: 'Bosque de la Suma',
      icon: '🏃',
      target: '3er Grado - Sumas de 1 cifra (1 al 9) y patrones',
      status: (stats.worldProgress['bosque']?.correctAnswers || 0) >= 3 ? 'Dominado' : 'En progreso',
      score: stats.worldProgress['bosque']?.highScore || 0,
    },
    {
      name: 'Sustracción y diferencias',
      worldName: 'Montaña de la Resta',
      icon: '⚔️',
      target: '3er Grado - Restas de 1 cifra y cálculo inverso',
      status: (stats.worldProgress['montana']?.correctAnswers || 0) >= 3 ? 'Dominado' : 'En progreso',
      score: stats.worldProgress['montana']?.highScore || 0,
    },
    {
      name: 'Multiplicación en contextos cotidianos',
      worldName: 'Ciudad de la Multiplicación',
      icon: '🛒',
      target: '3er Grado - Tablas de multiplicar de 1 cifra (2, 3, 4 y 5)',
      status: (stats.worldProgress['ciudad']?.correctAnswers || 0) >= 3 ? 'Dominado' : 'Bloqueado/Inicial',
      score: stats.worldProgress['ciudad']?.highScore || 0,
    },
    {
      name: 'Reparto equitativo y enigmas de 1 cifra',
      worldName: 'Río y Castillo',
      icon: '🌉',
      target: '3er Grado - Divisiones exactas e incógnitas de 1 cifra',
      status: (stats.worldProgress['rio']?.correctAnswers || 0) >= 3 ? 'Dominado' : 'En exploración',
      score: (stats.worldProgress['rio']?.highScore || 0) + (stats.worldProgress['castillo']?.highScore || 0),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar reporte"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold font-['Baloo_2'] text-white leading-tight">
              Panel de Aprendizaje y Docente
            </h2>
            <p className="text-xs text-slate-400">
              Diagnóstico pedagógico en tiempo real · 3er Grado de Primaria (1 Cifra)
            </p>
          </div>
        </div>

        {/* High-level metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
            <div className="text-2xl font-extrabold font-mono text-emerald-400">{globalAccuracy}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Precisión global</div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
            <div className="text-2xl font-extrabold font-mono text-amber-400">{stats.xp}</div>
            <div className="text-[11px] text-slate-400 mt-1">Puntos XP acumulados</div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
            <div className="text-2xl font-extrabold font-mono text-blue-400">{totalCorrect}/{totalAnswered}</div>
            <div className="text-[11px] text-slate-400 mt-1">Aciertos / Intentos</div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
            <div className="text-2xl font-extrabold font-mono text-rose-400">x{stats.highestCombo}</div>
            <div className="text-[11px] text-slate-400 mt-1">Mejor racha combo</div>
          </div>
        </div>

        {/* Competency breakdown */}
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" /> Competencias del Currículo
        </h3>

        <div className="space-y-2.5 mb-6">
          {competencies.map((comp, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 border border-slate-700/80 p-3.5 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{comp.icon}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 leading-snug">{comp.name}</h4>
                  <p className="text-[11px] text-slate-400">{comp.target}</p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    comp.status === 'Dominado'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {comp.status}
                </span>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Puntaje: {comp.score} pts
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Worlds Checklist */}
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" /> Progreso de los 5 Mundos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-6">
          {WORLDS.map((w) => {
            const prog = stats.worldProgress[w.id];
            return (
              <div
                key={w.id}
                className="bg-slate-800/40 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span>{w.icon}</span>
                  <span>{w.name}</span>
                </span>
                <span className="font-mono text-slate-300">
                  {prog?.completed ? '🏆 Completado' : `${prog?.correctAnswers || 0} aciertos`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors"
          >
            Entendido, continuar jugando
          </button>
        </div>
      </div>
    </div>
  );
};
