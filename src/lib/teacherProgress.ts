import { supabase } from './supabase';
import type { StudentLevelDetailRow, StudentProgressSummary } from './types';

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
