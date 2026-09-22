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
