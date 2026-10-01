import { supabase } from './supabase';
import type {
  StudentDifficultyRow,
  StudentLevelDetailRow,
  StudentProgressSummary,
  StudentRecentRound,
} from './types';

/** Progreso de todos los estudiantes de un curso, para la lista del panel docente. */
export async function fetchCourseProgress(courseId: string): Promise<StudentProgressSummary[]> {
  const { data, error } = await supabase.rpc('get_course_progress_summary', { p_course_id: courseId });
  if (error) throw error;
  return (data ?? []) as StudentProgressSummary[];
}

/** Detalle de los 20 niveles (4 regiones × 5) de un estudiante en particular. */
export async function fetchStudentLevelDetail(studentId: string): Promise<StudentLevelDetailRow[]> {
  const { data, error } = await supabase.rpc('get_student_level_detail', { p_student_id: studentId });
  if (error) throw error;
  return (data ?? []) as StudentLevelDetailRow[];
}

/** Precisión por región y nivel de dificultad (1 fácil / 2 medio / 3 difícil). */
export async function fetchStudentDifficultyBreakdown(studentId: string): Promise<StudentDifficultyRow[]> {
  const { data, error } = await supabase.rpc('get_student_difficulty_breakdown', { p_student_id: studentId });
  if (error) throw error;
  return (data ?? []) as StudentDifficultyRow[];
}

/** Últimas rondas jugadas por el estudiante, para ver si está mejorando con el tiempo. */
export async function fetchStudentRecentRounds(studentId: string, limit = 10): Promise<StudentRecentRound[]> {
  const { data, error } = await supabase.rpc('get_student_recent_rounds', { p_student_id: studentId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as StudentRecentRound[];
}
