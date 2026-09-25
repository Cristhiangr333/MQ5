-- =====================================================================
-- MathQuest 5 · Migración 0009 · Restringe el acceso directo al banco de preguntas
-- =====================================================================
-- Motivo (ADR-004, punto P2 pendiente -- "Opción A", acordada con el
-- usuario): el grant de la 0002 daba `select` sin restricción de
-- columnas sobre `questions` a cualquier sesión `authenticated`,
-- incluida la sesión anónima de un estudiante. Eso permitía a cualquier
-- estudiante hacer `supabase.from('questions').select('*')` desde la
-- consola del navegador y bajarse el banco completo (1674 preguntas)
-- con sus respuestas correctas -- no solo las de su ronda actual.
--
-- Esta migración NO cambia qué ve el estudiante durante su propia
-- ronda: sigue recibiendo la respuesta correcta de sus preguntas por
-- adelantado, a propósito (el juego necesita feedback instantáneo sin
-- una llamada al servidor por cada respuesta -- ver ADR-004 y la
-- sección 14 del master doc sobre game feel). Solo cierra la
-- posibilidad de leer preguntas fuera de la ronda que le corresponde
-- jugar en ese momento.
--
-- Mecanismo: se revoca el select directo sobre `questions` para
-- `authenticated` y se reemplaza por una función `security definer`
-- (`get_round_questions`) que aplica los mismos filtros que antes hacía
-- el cliente (región, tipos de pregunta y rango de dificultad del modo
-- de juego) y muestrea aleatoriamente solo `questions_per_round` filas,
-- ni una más. No toca `regions`, `game_modes` ni `region_games`: no
-- tienen respuestas, no hay nada que ocultar ahí.
--
-- Requiere: 0001-0008 ya ejecutadas. No modifica ninguna tabla ni borra
-- datos existentes.
-- =====================================================================

create function public.get_round_questions(
  p_region_id    text,
  p_game_mode_id text
)
returns table (
  id             bigint,
  kind           text,
  prompt         text,
  correct_answer integer,
  distractors    integer[],
  difficulty     smallint,
  explanation    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gm  public.game_modes;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_gm
  from public.game_modes
  where public.game_modes.id = p_game_mode_id and public.game_modes.is_active;
  if not found then
    raise exception 'invalid_game_mode';
  end if;

  return query
    select q.id, q.kind, q.prompt, q.correct_answer, q.distractors, q.difficulty, q.explanation
    from public.questions q
    where q.region_id = p_region_id
      and q.is_active
      and q.kind = any (v_gm.question_kinds)
      and q.difficulty between v_gm.difficulty_min and v_gm.difficulty_max
    order by random()
    limit v_gm.questions_per_round;
end;
$$;

grant execute on function public.get_round_questions(text, text) to authenticated;

-- Cierra el hueco: ya nadie puede leer `questions` directamente, solo a
-- través de la función de arriba (que sí corre con privilegios propios
-- y devuelve nada más que la ronda que toca).
revoke select on public.questions from authenticated;
