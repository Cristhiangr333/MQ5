-- Deshace 0009: quita las dos funciones nuevas y restaura
-- get_course_progress_summary() a su forma de la migración 0006 (sin
-- overall_accuracy). No toca ninguna tabla ni borra datos.

revoke execute on function
  public.get_student_difficulty_breakdown(uuid), public.get_student_recent_rounds(uuid, integer)
from authenticated;

drop function if exists public.get_student_difficulty_breakdown(uuid);
drop function if exists public.get_student_recent_rounds(uuid, integer);
drop function if exists public.get_course_progress_summary(uuid);

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

revoke execute on function public.get_course_progress_summary(uuid) from public, anon;
grant execute on function public.get_course_progress_summary(uuid) to authenticated;
