-- Deshace 0008: vuelve register_student() a su versión original de la
-- 0001 (siempre crea una fila nueva, sin buscar coincidencia de nombre).
-- No borra ni fusiona ninguna fila de estudiante ya tomada por la 0008;
-- solo restaura el comportamiento anterior para registros nuevos.

create or replace function public.register_student(
  p_join_code  text,
  p_first_name text,
  p_last_name  text
)
returns public.students
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_course  public.courses;
  v_student public.students;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_only';
  end if;

  select * into v_student from public.students where auth_user_id = v_uid;
  if found then
    return v_student;
  end if;

  select * into v_course
  from public.courses
  where join_code = upper(btrim(p_join_code)) and is_active;
  if not found then
    raise exception 'invalid_course_code';
  end if;

  insert into public.students (auth_user_id, course_id, first_name, last_name)
  values (v_uid, v_course.id, btrim(p_first_name), btrim(p_last_name))
  returning * into v_student;

  return v_student;
end;
$$;
