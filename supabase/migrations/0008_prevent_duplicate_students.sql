-- =====================================================================
-- MathQuest 5 · Migración 0008 · "Soy yo": evita estudiantes duplicados
-- =====================================================================
-- Motivo (ver docs/DECISIONS.md, ADR-009): el acceso sin cuenta (ADR-002)
-- usa una sesión anónima de Supabase atada al navegador/dispositivo.
-- register_student() creaba SIEMPRE una fila nueva de estudiante, sin
-- revisar si ya existía alguien con ese nombre en ese curso. Un mismo
-- niño real que juega un día en una tablet del salón y otro día en el
-- celular de la casa (o si el colegio resetea las tablets, o si borra el
-- caché) terminaba viéndose como dos o tres estudiantes distintos en el
-- panel docente, cada uno con una parte de su progreso real.
--
-- Esta migración reemplaza register_student(): si ya existe un
-- estudiante con el mismo nombre y apellido (sin importar mayúsculas ni
-- espacios extra) en ese curso, la sesión nueva "toma" esa fila en vez
-- de crear una fantasma. Es una decisión consciente de simplicidad sobre
-- seguridad (ADR-002 ya eligió eso): cualquiera que escriba el mismo
-- nombre en ese curso puede continuar ese progreso. Para un juego de
-- matemáticas de salón, sin datos sensibles, es un riesgo aceptado.
--
-- Requiere: 0001-0007 ya ejecutadas. Reemplaza solo la función; no
-- cambia ninguna tabla ni borra ningún dato existente.
-- =====================================================================

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
  v_first   text := btrim(p_first_name);
  v_last    text := btrim(p_last_name);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_only';
  end if;

  -- Esta sesión/dispositivo ya se había registrado antes: igual que siempre.
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

  -- "Soy yo, continúa mi progreso": mismo nombre y apellido ya registrado
  -- en este curso desde otro dispositivo/sesión → tomar esa fila.
  -- (El más antiguo si por lo que sea hay más de uno; no debería pasar
  -- salvo que ya existieran duplicados de antes de esta migración.)
  select * into v_student
  from public.students
  where course_id = v_course.id
    and lower(first_name) = lower(v_first)
    and lower(last_name)  = lower(v_last)
  order by created_at asc
  limit 1;

  if found then
    update public.students
    set auth_user_id = v_uid
    where id = v_student.id
    returning * into v_student;
    return v_student;
  end if;

  insert into public.students (auth_user_id, course_id, first_name, last_name)
  values (v_uid, v_course.id, v_first, v_last)
  returning * into v_student;

  return v_student;
end;
$$;
