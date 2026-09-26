import { supabase } from './supabase';
import type { GameMode, MathQuestion, RegionProgress, RoundAnswer } from '../types';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function questionKindLabel(kind: string): string {
  if (kind === 'missing_first') return 'Falta el primer número';
  if (kind === 'missing_second') return 'Falta el segundo número';
  return 'Cálculo directo';
}

interface ProgressRow {
  region_id: string;
  region_sort: number;
  region_required_xp: number;
  region_unlocked: boolean;
  game_mode_id: GameMode;
  level_sort: number;
  level_unlocked: boolean;
  best_stars: number;
  rounds_played: number;
}

/** Progreso completo (4 regiones × 5 niveles) desde get_my_progress() + XP total. */
export async function fetchProgress(): Promise<{ regions: RegionProgress[]; totalXp: number }> {
  const [progressRes, xpRes] = await Promise.all([
    supabase.rpc('get_my_progress'),
    supabase.rpc('get_my_total_xp'),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (xpRes.error) throw xpRes.error;

  const byRegion = new Map<string, RegionProgress>();
  for (const row of (progressRes.data ?? []) as ProgressRow[]) {
    let region = byRegion.get(row.region_id);
    if (!region) {
      region = {
        regionId: row.region_id,
        sortOrder: row.region_sort,
        requiredXp: row.region_required_xp,
        unlocked: row.region_unlocked,
        levels: [],
      };
      byRegion.set(row.region_id, region);
    }
    region.levels.push({
      gameModeId: row.game_mode_id,
      sortOrder: row.level_sort,
      unlocked: row.level_unlocked,
      bestStars: row.best_stars,
      roundsPlayed: row.rounds_played,
    });
  }

  const regions = [...byRegion.values()]
    .map((r) => ({ ...r, levels: r.levels.sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { regions, totalXp: (xpRes.data as number) ?? 0 };
}

export interface LevelConfig {
  questionsPerRound: number;
  secondsPerQuestion: number;
  lives: number;
}

interface GameModeRow {
  question_kinds: string[];
  questions_per_round: number;
  seconds_per_question: number;
  lives: number;
  difficulty_min: number;
  difficulty_max: number;
}

interface QuestionRow {
  id: number;
  kind: string;
  prompt: string;
  correct_answer: number;
  distractors: number[];
  difficulty: number;
  explanation: string;
}

/**
 * Trae las preguntas para jugar un nivel (región + modo): lee la configuración real
 * del nivel desde `game_modes` y saca una muestra aleatoria del banco de `questions`
 * que respeta el `kind` y el rango de dificultad de ese nivel (ver ADR-004/006).
 */
export async function fetchQuestionsForLevel(
  regionId: string,
  gameModeId: GameMode,
): Promise<{ questions: MathQuestion[]; config: LevelConfig }> {
  const { data: gameMode, error: gameModeError } = await supabase
    .from('game_modes')
    .select('question_kinds, questions_per_round, seconds_per_question, lives, difficulty_min, difficulty_max')
    .eq('id', gameModeId)
    .single();
  if (gameModeError) throw gameModeError;
  const gm = gameMode as GameModeRow;

  const { data: rows, error: questionsError } = await supabase
    .from('questions')
    .select('id, kind, prompt, correct_answer, distractors, difficulty, explanation')
    .eq('region_id', regionId)
    .eq('is_active', true)
    .in('kind', gm.question_kinds)
    .gte('difficulty', gm.difficulty_min)
    .lte('difficulty', gm.difficulty_max)
    .limit(200);
  if (questionsError) throw questionsError;

  const pool = shuffle((rows ?? []) as QuestionRow[]).slice(0, gm.questions_per_round);
  const questions: MathQuestion[] = pool.map((q) => ({
    id: q.id,
    text: q.prompt,
    category: questionKindLabel(q.kind),
    difficulty: q.difficulty,
    options: shuffle([q.correct_answer, ...q.distractors.slice(0, 2)]),
    correct: q.correct_answer,
    explanation: q.explanation,
  }));

  return {
    questions,
    config: {
      questionsPerRound: gm.questions_per_round,
      secondsPerQuestion: gm.seconds_per_question,
      lives: gm.lives,
    },
  };
}

export interface SubmitRoundResult {
  stars: number;
  xp_earned: number;
  correct_count: number;
  questions_total: number;
  completed: boolean;
}

/**
 * Envía la ronda jugada. El servidor recalcula aciertos, estrellas y XP desde
 * `questions.correct_answer`: el cliente nunca declara si acertó (ver ADR-004/007).
 */
export async function submitRound(
  regionId: string,
  gameModeId: GameMode,
  answers: RoundAnswer[],
): Promise<SubmitRoundResult> {
  const { data, error } = await supabase.rpc('submit_round', {
    p_region_id: regionId,
    p_game_mode_id: gameModeId,
    p_answers: answers,
  });
  if (error) throw error;
  return data as SubmitRoundResult;
}
