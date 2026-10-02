-- =====================================================================
-- MathQuest 5 · Migración 0011 · Las regiones se desbloquean en orden real
-- =====================================================================
-- Historial de número: esta migración nació como "0009" en una sesión
-- paralela, se renumeró a "0010" cuando 0009 pasó a ser el panel docente,
-- y quedó como 0011 porque 0010_teacher_region_lock.sql (el candado de
-- región para el docente, ya en main) usa el 0010. Cada una de las tres
-- funciones de abajo reemplaza la versión de la migración anterior que la
-- definió (ver "Versiones que reemplaza").
--
-- Motivo (a pedido del usuario): "los mundos tienen un orden específico,
-- primero suma, luego resta, luego multiplicación, luego división, este
-- debe ser así en orden para que la dificultad sea escalable". La 0005
-- original desbloqueaba una región solo por XP total acumulado
-- (`region_unlocked = total_xp >= reg.required_xp`), sin exigir haber
-- jugado siquiera la región anterior. Como el XP se puede acumular
-- rejugando la región más fácil una y otra vez, un estudiante podía
-- saltarse regiones intermedias (ej. desbloquear "Multiplicación" sin
-- haber tocado "Resta" nunca) con tal de acumular suficiente XP en
-- "Suma". Esto también explicaba por qué la celebración de desbloqueo
-- (ver App.tsx) no coincidía con terminar una región completa: el umbral
-- de XP se podía cruzar en cualquier punto intermedio, no justo al
-- terminar los 5 niveles.
--
-- Ahora una región se desbloquea si es la primera (sort_order = 1), o si
-- el estudiante ya pasó (completed and stars >= 1) los 5 modos de juego
-- de la región anterior -- exactamente el mismo patrón que ya usa el
-- desbloqueo de NIVEL dentro de una región, solo que una región más arriba.
--
-- `required_xp` se deja en la tabla tal cual (puede servir para algo más
-- adelante), pero deja de usarse para decidir el desbloqueo.
--
-- Versiones que reemplaza:
--   get_my_progress()               <- 0005 (lo que ve el estudiante)
--   get_course_progress_summary()   <- 0009 (lista de estudiantes del docente)
--   get_student_level_detail()      <- 0010 (detalle del docente; su
--                                       region_unlocked seguía la regla vieja)
-- Las tres usan AHORA el mismo criterio, para que docente y estudiante
-- siempre vean lo mismo.
--
-- ROBUSTEZ ante el estado previo de tu base: `create or replace` NO puede
-- cambiar las columnas de salida de una función (error 42P13 "cannot change
-- return type of existing function"). La primera versión de esta migración lo
-- asumía y falló en un Supabase real donde get_course_progress_summary no
-- tenía la forma de la 0009. Por eso get_course_progress_summary y
-- get_student_level_detail se hacen con `drop function if exists` + `create`:
-- funciona igual si la 0009 / 0010 ya estaban aplicadas, si estaban a medias
-- o si no estaban. (`drop` borra los permisos, así que se vuelven a poner.)
-- get_my_progress conserva exactamente las columnas de la 0005: create or replace.
--
-- Todo va en UNA transacción: o se aplica completo o no se aplica nada.
--
-- Requiere: 0001-0008. No borra datos; solo reemplaza funciones.
-- Rollback: supabase/rollbacks/0011_*.down.sql
-- =====================================================================

begin;

create or replace function public.get_my_progress()
returns table (
  region_id        text,
  region_sort      smallint,
  region_required_xp integer,
  region_unlocked  boolean,
  game_mode_id     text,
  level_sort       smallint,
  level_unlocked   boolean,
  best_stars       smallint,
  rounds_played    integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select id as student_id from public.students where auth_user_id = (select auth.uid())
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
    reg.sort_order = 1 or not exists (
      -- ¿Hay algún modo de juego activo que la región anterior NO tenga
      -- pasado todavía? Si no hay ninguno, la región anterior está
      -- completa y esta región se desbloquea.
      select 1 from public.game_modes gm2
      where gm2.is_active
        and not exists (
          select 1 from mine m2
          join public.regions prevreg on prevreg.sort_order = reg.sort_order - 1
          where m2.region_id = prevreg.id and m2.game_mode_id = gm2.id and m2.passed
        )
    ),
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
$$;

-- get_course_progress_summary() ya venía con su PROPIO cálculo de
-- "regions_unlocked" por XP, totalmente aparte del de get_my_progress()
-- -- el docente veía un número de regiones desbloqueadas distinto del que
-- en realidad ve su estudiante en la app. Mismo criterio nuevo acá, sobre
-- la forma que le dio 0009_teacher_detailed_progress.sql (con
-- overall_accuracy) -- misma firma, por eso alcanza con `create or
-- replace` en vez de volver a hacer drop + create.
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
  overall_accuracy smallint,
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
    (
      select count(*) from public.regions reg
      where reg.is_active and (
        reg.sort_order = 1 or not exists (
          select 1 from public.game_modes gm2
          where gm2.is_active
            and not exists (
              select 1 from public.rounds pr
              join public.regions prevreg on prevreg.sort_order = reg.sort_order - 1
              where pr.student_id = s.id and pr.region_id = prevreg.id and pr.game_mode_id = gm2.id
                and pr.completed and pr.stars >= 1
            )
        )
      )
    )::smallint,
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
      count(distinct case when r.completed and r.stars >= 1 then (r.region_id, r.game_mode_id) end) as levels_passed
    from public.rounds r
    where r.student_id = s.id
  ) totals on true
  where s.course_id = p_course_id
  order by s.first_name, s.last_name;
end;
$$;

revoke execute on function public.get_course_progress_summary(uuid) from public, anon;
grant execute on function public.get_course_progress_summary(uuid) to authenticated;

-- get_student_level_detail() (0010) calculaba `region_unlocked` por XP: con la
-- regla nueva mostraría "bloqueada" una región que el estudiante SÍ tiene
-- abierta (o al revés). Misma firma y mismas 11 columnas que la 0010; solo
-- cambia cómo se decide region_unlocked. `region_required_xp` se sigue
-- devolviendo (ya no es una llave: el front muestra "Se abre al terminar X").
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
    coalesce((select m.questions_total from mine m where m.region_id = reg.id and m.game_mode_id = g.id), 0),
    reg.sort_order = 1 or not exists (
      select 1 from public.game_modes gm2
      where gm2.is_active
        and not exists (
          select 1 from mine m2
          join public.regions prevreg on prevreg.sort_order = reg.sort_order - 1
          where m2.region_id = prevreg.id and m2.game_mode_id = gm2.id and m2.passed
        )
    ),
    reg.required_xp
  from public.regions reg
  cross join public.game_modes g
  where reg.is_active and g.is_active
  order by reg.sort_order, g.sort_order;
end;
$$;

revoke execute on function public.get_student_level_detail(uuid) from public, anon;
grant execute on function public.get_student_level_detail(uuid) to authenticated;

-- Recarga el caché de esquema de PostgREST (ver ADR-010).
notify pgrst, 'reload schema';

commit;
