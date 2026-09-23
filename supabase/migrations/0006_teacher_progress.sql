-- =====================================================================
-- MathQuest 5 · Migración 0006 · Progreso real para el panel docente
-- =====================================================================
-- Hasta ahora TeacherPanel solo mostraba nombres de estudiantes. Con
-- `rounds`/`attempts` ya guardando cada ronda jugada (migración 0005),
-- esta migración añade dos funciones de solo lectura para que el
-- docente vea el progreso real:
--
--   get_course_progress_summary(course_id)
--     Una fila por estudiante del curso: XP total, cuántas regiones y
--     niveles tiene desbloqueados/pasados, cuántas rondas ha jugado y
--     cuándo jugó por última vez. Para la lista de estudiantes.
--
--   get_student_level_detail(student_id)
--     Una fila por cada uno de los 20 niveles (4 regiones × 5) de ESE
--     estudiante: desbloqueado, mejores estrellas, y aciertos/total de
--     todas sus rondas en ese nivel (para ver en qué tiene dificultad).
--     Para cuando el docente abre el detalle de un estudiante.
--
-- Seguridad: ninguna usa RLS porque ambas son SECURITY DEFINER y
-- verifican "a mano" que el nivel que llama es dueño del curso/del
-- estudiante (mismo patrón que teacher_owns_course en la 0001) — si no,
-- lanzan una excepción en vez de devolver filas de otro docente.
-- =====================================================================

create function public.get_course_progress_summary(p_course_id uuid)
returns table (
  student_id      uuid,
  first_name      text,
  last_name       text,
  total_xp        integer,
  regions_unlocked smallint,
  levels_passed   smallint,
  rounds_played   integer,
  last_played_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.teacher_owns_course(p_course_id) then
    raise exception 'not_your_course';
  end if;

  return query
  select
    s.id,
    s.first_name,
    s.last_name,
    coalesce(totals.xp, 0)::integer,
    coalesce(totals.regions_unlocked, 0)::smallint,
    coalesce(totals.levels_passed, 0)::smallint,
    coalesce(totals.rounds_played, 0)::integer,
    totals.last_played_at
  from public.students s
  left join lateral (
    select
      sum(r.xp_earned) as xp,
      count(r.id)::integer as rounds_played,
      max(r.created_at) as last_played_at,
      count(distinct case when r.completed and r.stars >= 1 then (r.region_id, r.game_mode_id) end) as levels_passed,
      (
        select count(*) from public.regions reg
        where reg.is_active and reg.required_xp <= coalesce(sum(r.xp_earned), 0)
      ) as regions_unlocked
    from public.rounds r
    where r.student_id = s.id
  ) totals on true
  where s.course_id = p_course_id
  order by s.first_name, s.last_name;
end;
$$;

create function public.get_student_level_detail(p_student_id uuid)
returns table (
  region_id       text,
  region_sort     smallint,
  game_mode_id    text,
  level_sort      smallint,
  unlocked        boolean,
  best_stars      smallint,
  rounds_played   integer,
  correct_count   integer,
  questions_total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  select course_id into v_course_id from public.students where id = p_student_id;
  if v_course_id is null or not public.teacher_owns_course(v_course_id) then
    raise exception 'not_your_student';
  end if;

  return query
  with mine as (
    select
      r.region_id,
      r.game_mode_id,
      bool_or(r.completed and r.stars >= 1) as passed,
      max(r.stars) as best_stars,
      count(*)::integer as rounds_played,
      sum(r.correct_count)::integer as correct_count,
      sum(r.questions_total)::integer as questions_total
    from public.rounds r
    where r.student_id = p_student_id
    group by r.region_id, r.game_mode_id
  )
  select
    reg.id,
    reg.sort_order,
    g.id,
    g.sort_order,
    g.sort_order = 1 or exists (
      select 1 from mine m
      join public.game_modes prev on prev.sort_order = g.sort_order - 1
      where m.region_id = reg.id and m.game_mode_id = prev.id and m.passed
    ),
    coalesce((select m.best_stars from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0)::smallint,
    coalesce((select m.rounds_played from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0),
    coalesce((select m.correct_count from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0),
    coalesce((select m.questions_total from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0)
  from public.regions reg
  cross join public.game_modes g
  where reg.is_active and g.is_active
  order by reg.sort_order, g.sort_order;
end;
$$;

revoke execute on function
  public.get_course_progress_summary(uuid), public.get_student_level_detail(uuid)
from public, anon;
grant execute on function
  public.get_course_progress_summary(uuid), public.get_student_level_detail(uuid)
to authenticated;
