import React from 'react';
import { MathQuestion } from '../types';
import { Sparkles, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface QuestionPanelProps {
  question: MathQuestion | null;
  timeLeft: number;
  maxTime: number;
  isAnswered: boolean;
  selectedOption: number | string | null;
  isCorrect: boolean | null;
  combo: number;
  feedbackText: string;
  onSelectOption: (option: number | string) => void;
  gameMode: string;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  timeLeft,
  maxTime,
  isAnswered,
  selectedOption,
  isCorrect,
  combo,
  feedbackText,
  onSelectOption,
  gameMode,
}) => {
  if (!question) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Cargando desafío matemático...
      </div>
    );
  }

  const timePct = Math.max(0, (timeLeft / maxTime) * 100);
  const timerColor =
    timePct > 50
      ? 'bg-emerald-500'
      : timePct > 22
      ? 'bg-amber-400'
      : 'bg-rose-500 animate-pulse';

  return (
    <div className="bg-slate-900/95 border border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-xl backdrop-blur-md flex flex-col items-center text-center relative overflow-hidden">
      {/* Top Metadata Badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          {question.category}
        </span>

        <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-700">
          Nivel {question.difficulty} · 3º Grado (1 Cifra)
        </span>

        {combo >= 2 && (
          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
            🔥 Combo x{Math.min(combo, 4)} (+{Math.min(combo, 4) * 5} pts)
          </span>
        )}
      </div>

      {/* Math Challenge Prompt */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white my-3 drop-shadow-sm">
        {question.text}
      </h2>

      {/* Timer Bar */}
      <div className="w-full max-w-md my-2">
        <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Tiempo restante
          </span>
          <span className={timePct < 25 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
            {(timeLeft / 1000).toFixed(1)}s
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
          <div
            className={`h-full ${timerColor} transition-all duration-100 ease-linear rounded-full`}
            style={{ width: `${timePct}%` }}
          />
        </div>
      </div>

      {/* Interactive Answer Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mt-4">
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isThisCorrect = isAnswered && option === question.correct;
          const isThisWrong = isAnswered && isSelected && !isCorrect;

          let btnStyles = 'bg-slate-800/90 border-slate-700 text-slate-100 hover:border-slate-500 hover:bg-slate-750';

          if (isThisCorrect) {
            btnStyles = 'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold scale-[1.02] shadow-lg shadow-emerald-500/20';
          } else if (isThisWrong) {
            btnStyles = 'bg-rose-600/30 border-rose-500 text-rose-200 font-bold scale-[0.98]';
          } else if (isAnswered) {
            btnStyles = 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60';
          }

          return (
            <button
              key={idx}
              id={`option-btn-${idx}`}
              disabled={isAnswered}
              onClick={() => onSelectOption(option)}
              className={`p-4 rounded-xl border-2 font-mono text-xl sm:text-2xl font-bold transition-all duration-150 flex items-center justify-center relative cursor-pointer active:scale-95 disabled:cursor-not-allowed ${btnStyles}`}
            >
              <span className="absolute top-1 left-2 text-[10px] text-slate-500 font-sans font-normal">
                {idx + 1}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {/* Immediate Educational Feedback Banner */}
      <div
        className={`w-full max-w-lg mt-4 p-3.5 rounded-xl text-xs sm:text-sm transition-all flex items-start gap-2.5 text-left ${
          isAnswered
            ? isCorrect
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
            : 'bg-slate-800/40 border border-slate-800 text-slate-400'
        }`}
      >
        {isAnswered ? (
          isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )
        ) : (
          <Sparkles className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-bold leading-tight">
            {feedbackText || 'Selecciona la respuesta correcta antes de que se agote el tiempo.'}
          </p>
          {isAnswered && (
            <p className="mt-1 text-[11.5px] text-slate-300 font-normal leading-relaxed">
              💡 {question.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
