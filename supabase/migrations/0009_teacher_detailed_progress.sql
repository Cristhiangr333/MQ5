-- =====================================================================
-- MathQuest 5 · Migración 0009 · Datos más detallados para el docente
-- =====================================================================
-- El docente pidió "datos más detallados para calificar mejor, sin
-- volverlo complicado" -- pero explícitamente NO quiere una nota
-- automática calculada por el sistema; él decide la nota, nosotros le
-- damos mejor información. Tres piezas:
--
--   1. get_course_progress_summary() ahora también trae overall_accuracy
--      (% de aciertos de TODA la vida del estudiante) para la lista de
--      estudiantes -- hoy solo se veía XP y niveles pasados, no precisión.
--
--   2. get_student_difficulty_breakdown(student_id)
--      Por cada región, el % de aciertos separado por nivel de
--      dificultad (1 fácil / 2 medio / 3 difícil) de TODAS sus preguntas
--      respondidas ahí. Esto es más útil que ver el "kind" de la
--      pregunta (que es un detalle de formato interno, no de dificultad
--      real) y le dice al docente en qué tan exigente puede ser antes de
--      que el estudiante empiece a fallar.
--
--   3. get_student_recent_rounds(student_id, limit)
--      Las últimas rondas jugadas con fecha, para ver si el estudiante
--      está mejorando o no con el tiempo, no solo un promedio histórico
--      que puede esconder una mala racha reciente.
--
-- Seguridad: mismo patrón que la 0006 (security definer + verificación
-- manual de teacher_owns_course, sin RLS porque son funciones de
-- agregación, no acceso directo a filas).
-- =====================================================================

drop function if exists public.get_course_progress_summary(uuid);

create function public.get_course_progress_summary(p_course_id uuid)
returns table (
  student_id       uuid,
  first_name       text,
  last_name        text,
  total_xp         integer,
  regions_unlocked smallint,
  levels_passed    smallint,
  rounds_played    integer,
  overall_accuracy smallint, -- % de aciertos de toda la vida (null = nunca jugó)
  last_played_at   timestamptz
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
    case
      when coalesce(totals.questions_total, 0) > 0
        then round(100.0 * totals.correct_count / totals.questions_total)::smallint
      else null
    end,
    totals.last_played_at
  from public.students s
  left join lateral (
    select
      sum(r.xp_earned) as xp,
      count(r.id)::integer as rounds_played,
      max(r.created_at) as last_played_at,
      sum(r.correct_count)::integer as correct_count,
      sum(r.questions_total)::integer as questions_total,
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

revoke execute on function public.get_course_progress_summary(uuid) from public, anon;
grant execute on function public.get_course_progress_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Precisión por dificultad, por región
-- ---------------------------------------------------------------------

create function public.get_student_difficulty_breakdown(p_student_id uuid)
returns table (
  region_id       text,
  difficulty      smallint,
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
  select
    r.region_id,
    q.difficulty,
    count(*) filter (where a.is_correct)::integer,
    count(*)::integer
  from public.attempts a
  join public.rounds r on r.id = a.round_id
  join public.questions q on q.id = a.question_id
  where r.student_id = p_student_id
  group by r.region_id, q.difficulty
  order by r.region_id, q.difficulty;
end;
$$;

revoke execute on function public.get_student_difficulty_breakdown(uuid) from public, anon;
grant execute on function public.get_student_difficulty_breakdown(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Actividad reciente (últimas rondas jugadas)
-- ---------------------------------------------------------------------

create function public.get_student_recent_rounds(p_student_id uuid, p_limit integer default 10)
returns table (
  region_id       text,
  game_mode_id    text,
  correct_count   smallint,
  questions_total smallint,
  completed       boolean,
  stars           smallint,
  xp_earned       integer,
  created_at      timestamptz
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
  select r.region_id, r.game_mode_id, r.correct_count, r.questions_total,
         r.completed, r.stars, r.xp_earned, r.created_at
  from public.rounds r
  where r.student_id = p_student_id
  order by r.created_at desc
  limit greatest(1, least(p_limit, 50));
end;
$$;

revoke execute on function public.get_student_recent_rounds(uuid, integer) from public, anon;
grant execute on function public.get_student_recent_rounds(uuid, integer) to authenticated;
