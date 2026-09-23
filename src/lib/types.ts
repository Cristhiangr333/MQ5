export type Role = 'teacher' | 'student' | 'none';

/** Fila devuelta por la función get_my_student(). */
export interface StudentProfile {
  student_id: string;
  first_name: string;
  last_name: string;
  course_id: string;
  course_name: string;
}

export interface CourseRow {
  id: string;
  name: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
}

export interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  course_id: string;
  created_at: string;
}

/** Fila de get_course_progress_summary(): resumen de un estudiante para la lista. */
export interface StudentProgressSummary {
  student_id: string;
  first_name: string;
  last_name: string;
  total_xp: number;
  regions_unlocked: number;
  levels_passed: number;
  rounds_played: number;
  last_played_at: string | null;
}

/** Fila de get_student_level_detail(): una de las 20 combinaciones región×nivel. */
export interface StudentLevelDetailRow {
  region_id: string;
  region_sort: number;
  game_mode_id: string;
  level_sort: number;
  unlocked: boolean;
  best_stars: number;
  rounds_played: number;
  correct_count: number;
  questions_total: number;
}
