-- Deshace 0010: restaura get_student_level_detail() a su forma de la
-- migración 0006 (sin region_unlocked / region_required_xp). No toca
-- ninguna tabla ni borra datos.

drop function if exists public.get_student_level_detail(uuid);

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

revoke execute on function public.get_student_level_detail(uuid) from public, anon;
grant execute on function public.get_student_level_detail(uuid) to authenticated;

notify pgrst, 'reload schema';
