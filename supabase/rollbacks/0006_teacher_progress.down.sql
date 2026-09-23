-- Deshace 0006: solo quita las dos funciones de lectura para el panel
-- docente. No toca ninguna tabla ni borra datos.

revoke execute on function
  public.get_course_progress_summary(uuid), public.get_student_level_detail(uuid)
from authenticated;

drop function if exists public.get_student_level_detail(uuid);
drop function if exists public.get_course_progress_summary(uuid);
