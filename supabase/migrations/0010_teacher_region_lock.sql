-- =====================================================================
-- MathQuest 5 · Migración 0010 · El docente ve las regiones bloqueadas
-- =====================================================================
-- Problema: get_student_level_detail() (0006) decidía "desbloqueado" solo
-- por el nivel anterior DENTRO de la región (el nivel 1 siempre abierto).
-- Pero el estudiante, en get_my_progress() (0005), también necesita XP
-- suficiente para abrir la REGIÓN (regions.required_xp). Resultado: el
-- docente veía "Sin jugar aún" en niveles de una región que el estudiante
-- todavía tiene cerrada, en vez de "Bloqueado".
--
-- Arreglo ADITIVO: se agregan dos columnas AL FINAL y todo lo anterior
-- queda idéntico (mismas columnas, mismo orden, misma lógica de `unlocked`):
--
--   region_unlocked    boolean  -- ¿el XP total del estudiante alcanza la región?
--   region_required_xp integer  -- XP necesario para abrirla (para mostrarlo)
--
-- Un front viejo ignora las columnas nuevas; el front nuevo las trata como
-- opcionales. Es seguro desplegar el código antes o después de esta migración.
--
-- Seguridad: igual que la 0006 (security definer + teacher_owns_course).
-- No toca tablas ni datos. Rollback: supabase/rollbacks/0010_*.down.sql
-- =====================================================================

drop function if exists public.get_student_level_detail(uuid);

create function public.get_student_level_detail(p_student_id uuid)
returns table (
  region_id          text,
  region_sort        smallint,
  game_mode_id       text,
  level_sort         smallint,
  unlocked           boolean,
  best_stars         smallint,
  rounds_played      integer,
  correct_count      integer,
  questions_total    integer,
  region_unlocked    boolean,
  region_required_xp integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.get_student_level_detail(uuid) from public, anon;
grant execute on function public.get_student_level_detail(uuid) to authenticated;

-- Pide a PostgREST que recargue su caché de esquema, para que la función
-- recreada se vea de inmediato (ver ADR-010: sin esto puede tardar en aparecer).
notify pgrst, 'reload schema';
