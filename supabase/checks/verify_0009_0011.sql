-- =====================================================================
-- Verifica qué migraciones del panel docente / orden de islas están aplicadas.
-- Solo LEE (más un "notify" inofensivo que recarga el caché de la API).
-- Pégalo completo en el SQL Editor de Supabase y dale Run.
-- Resultado: una fila por revisión, con ok = true / false.
-- =====================================================================

-- Recarga el caché de la API (PostgREST). Si las funciones existen pero la app no
-- las ve, casi siempre es esto. No cambia nada en tus datos.
notify pgrst, 'reload schema';

with f as (
  select
    to_regprocedure('public.get_course_progress_summary(uuid)')       as summary,
    to_regprocedure('public.get_my_progress()')                       as myprog,
    to_regprocedure('public.get_student_level_detail(uuid)')          as detail,
    to_regprocedure('public.get_student_difficulty_breakdown(uuid)')  as diff,
    to_regprocedure('public.get_student_recent_rounds(uuid, integer)') as recent
)
select n, revision, ok, case when ok then '' else si_es_false end as que_hacer
from (
  select 1 as n, '0009 · lista del docente trae % de aciertos' as revision,
         coalesce(pg_get_function_result(summary) like '%overall_accuracy%', false) as ok,
         'Aplicar 0009_teacher_detailed_progress.sql' as si_es_false from f
  union all select 2, '0009 · existe precisión por dificultad', diff is not null,
         'Aplicar 0009_teacher_detailed_progress.sql' from f
  union all select 3, '0009 · existen rondas recientes', recent is not null,
         'Aplicar 0009_teacher_detailed_progress.sql' from f
  union all select 4, '0010 · detalle del docente trae region_unlocked',
         coalesce(pg_get_function_result(detail) like '%region_unlocked%', false),
         'Aplicar 0010_teacher_region_lock.sql' from f
  union all select 5, '0011 · el ESTUDIANTE abre islas al completar la anterior',
         coalesce((select prosrc like '%prevreg%' from pg_proc where oid = myprog), false),
         'Aplicar 0011_regions_unlock_in_order.sql' from f
  union all select 6, '0011 · la LISTA del docente usa la misma regla',
         coalesce((select prosrc like '%prevreg%' from pg_proc where oid = summary), false),
         'Aplicar 0011_regions_unlock_in_order.sql' from f
  union all select 7, '0011 · el DETALLE del docente usa la misma regla',
         coalesce((select prosrc like '%prevreg%' from pg_proc where oid = detail), false),
         'Aplicar 0011_regions_unlock_in_order.sql' from f
  union all select 8, 'Permisos: las 5 funciones solo para usuarios con sesión (no anon)',
         coalesce(
           (select bool_and(has_function_privilege('authenticated', x, 'execute')
                            and not has_function_privilege('anon', x, 'execute'))
            from unnest(array[summary, myprog, detail, diff, recent]) as x
            where x is not null)
           and summary is not null and myprog is not null and detail is not null
           and diff is not null and recent is not null, false),
         'Faltan funciones o permisos: aplicar lo que marque false arriba' from f
  union all select 9, 'Datos: 4 regiones y 5 juegos activos',
         (select count(*) from public.regions where is_active) = 4
         and (select count(*) from public.game_modes where is_active) = 5,
         'Revisar tablas regions / game_modes' from f
) t
order by n;
