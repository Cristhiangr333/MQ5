-- Deshace 0011: restaura las tres funciones a su estado ANTERIOR a esta
-- migración (es decir, tras 0010): las regiones vuelven a abrirse por XP
-- total (`required_xp`). No toca ninguna tabla ni borra datos.
--   get_my_progress()             -> versión de 0005 (región por XP)
--   get_course_progress_summary() -> versión de 0009 (regions_unlocked por XP)
--   get_student_level_detail()    -> versión de 0010 (region_unlocked por XP)
-- Definiciones extraídas con pg_get_functiondef() de una base real con
-- 0001-0010 aplicadas, no copiadas a mano.

CREATE OR REPLACE FUNCTION public.get_my_progress()
 RETURNS TABLE(region_id text, region_sort smallint, region_required_xp integer, region_unlocked boolean, game_mode_id text, level_sort smallint, level_unlocked boolean, best_stars smallint, rounds_played integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (
    select id as student_id from public.students where auth_user_id = (select auth.uid())
  ),
  total as (
    select coalesce(sum(xp_earned), 0)::integer as xp from public.rounds r, me where r.student_id = me.student_id
  ),
  mine as (
    select r.region_id, r.game_mode_id,
           bool_or(r.completed and r.stars >= 1) as passed,
           max(r.stars) as best_stars,
           count(*)::integer as rounds_played
    from public.rounds r, me
    where r.student_id = me.student_id
    group by r.region_id, r.game_mode_id
  )
  select
    reg.id, reg.sort_order, reg.required_xp,
    (select xp from total) >= reg.required_xp,
    g.id, g.sort_order,
    g.sort_order = 1 or exists (
      select 1 from mine m
      join public.game_modes prev on prev.sort_order = g.sort_order - 1
      where m.region_id = reg.id and m.game_mode_id = prev.id and m.passed
    ),
    coalesce((select best_stars from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0)::smallint,
    coalesce((select rounds_played from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0)
  from public.regions reg
  cross join public.game_modes g
  where reg.is_active and g.is_active
  order by reg.sort_order, g.sort_order;
$function$

;

CREATE OR REPLACE FUNCTION public.get_course_progress_summary(p_course_id uuid)
 RETURNS TABLE(student_id uuid, first_name text, last_name text, total_xp integer, regions_unlocked smallint, levels_passed smallint, rounds_played integer, overall_accuracy smallint, last_played_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

;

CREATE OR REPLACE FUNCTION public.get_student_level_detail(p_student_id uuid)
 RETURNS TABLE(region_id text, region_sort smallint, game_mode_id text, level_sort smallint, unlocked boolean, best_stars smallint, rounds_played integer, correct_count integer, questions_total integer, region_unlocked boolean, region_required_xp integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_course_id uuid;
  v_total_xp  integer;
begin
  select course_id into v_course_id from public.students where id = p_student_id;
  if v_course_id is null or not public.teacher_owns_course(v_course_id) then
    raise exception 'not_your_student';
  end if;

  -- Mismo cálculo que get_my_progress(): XP total de TODAS sus rondas.
  select coalesce(sum(r.xp_earned), 0)::integer into v_total_xp
  from public.rounds r
  where r.student_id = p_student_id;

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
    coalesce((select m.questions_total from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0),
    v_total_xp >= reg.required_xp,
    reg.required_xp
  from public.regions reg
  cross join public.game_modes g
  where reg.is_active and g.is_active
  order by reg.sort_order, g.sort_order;
end;
$function$

;

notify pgrst, 'reload schema';
