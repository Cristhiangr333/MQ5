-- =====================================================================
-- MathQuest 5 · Migración 0012 · Divisiones largas en el Castillo (solo región "castillo")
-- =====================================================================
-- Pedido: que en el mundo de la División la dificultad suba más allá de las
-- tablas, SOLO en esa región:
--   Nivel 1 Carrera   -> normal (sin cambios: dificultad 1)
--   Nivel 2 Batalla   -> 3 cifras ÷ 1 cifra   (ej. 122 ÷ 2)
--   Nivel 3 Puente    -> 3 cifras ÷ 2 cifras  (ej. 228 ÷ 12)
--   Nivel 4 Tienda    -> 4 cifras ÷ 2 cifras  (ej. 2338 ÷ 14)
--   Nivel 5 Detective -> sin cambios (formato "número faltante")
-- Todas las divisiones nuevas son EXACTAS (sin residuo): las respuestas del
-- juego son números enteros y el banco no modela residuos. Por eso 233/12 o
-- 2345/14 (que dejan residuo) no están; se usan dividendos equivalentes
-- en tamaño que sí dan cociente exacto.
--
-- Cómo, sin tocar las otras 3 regiones ni las preguntas existentes:
--   1. questions.difficulty admite 1..6 (4, 5 y 6 = las tres tandas nuevas).
--   2. region_games gana difficulty_min/max y seconds_per_question
--      OPCIONALES (null = usa el valor del modo de juego, como siempre).
--   3. Solo las filas de 'castillo' (battle, bridge, shop) llevan override.
--   4. submit_round valida contra el rango efectivo (override o modo). Es la
--      MISMA función de la 0005 con solo dos cambios marcados abajo.
-- Tiempo por pregunta: 25 s / 40 s / 60 s. Con 10-11 s (los del resto de las
-- regiones) una división larga es imposible para un niño de 3.º. Ajustable
-- con un solo UPDATE sobre region_games.
--
-- Cada tanda es una muestra DETERMINISTA de <= 200 preguntas (el cliente lee
-- con limit(200) sin orden; un banco mayor serviría siempre las mismas).
-- Solo formato 'direct': los 3 niveles nuevos usan modos de juego 'direct'.
-- Despliegue: ver docs/DECISIONS.md (ADR-021): primero el frontend, luego esta.
-- =====================================================================

-- 1. Dificultad 1..6 en questions ------------------------------------
alter table public.questions drop constraint if exists questions_difficulty_check;
alter table public.questions
  add constraint questions_difficulty_check check (difficulty between 1 and 6);

-- 2. Overrides opcionales por región + juego -------------------------
alter table public.region_games
  add column difficulty_min       smallint,
  add column difficulty_max       smallint,
  add column seconds_per_question smallint,
  add constraint region_games_difficulty_chk check (
    (difficulty_min is null and difficulty_max is null)
    or (difficulty_min between 1 and 6 and difficulty_max between 1 and 6
        and difficulty_min <= difficulty_max)),
  add constraint region_games_seconds_chk check (
    seconds_per_question is null or seconds_per_question between 5 and 120);

-- 3. Preguntas nuevas (castillo, dificultad 4, 5 y 6) ----------------
create function public.tmp_mk_div_distractors_0012(p_ans int)
returns int[]
language sql
immutable
set search_path = ''
as $f$
  -- Errores típicos de valor posicional primero (+10), luego +-1, +-2.
  select (array(
    select v from unnest(array[p_ans + 10, p_ans - 1, p_ans + 1, p_ans - 10, p_ans + 2, p_ans - 2]) as v
    where v >= 1 and v <> p_ans
  ))[1:6]
$f$;

insert into public.questions
  (region_id, kind, operand_a, operand_b, result, prompt, correct_answer, distractors, difficulty, explanation)
with cand as (
  select 4::smallint as diff, b.b, q.q, b.b * q.q as a
    from generate_series(2, 9) as b(b), generate_series(1, 999) as q(q)
   where b.b * q.q between 100 and 999
  union all
  select 5, b.b, q.q, b.b * q.q
    from generate_series(11, 25) as b(b), generate_series(1, 999) as q(q)
   where b.b * q.q between 100 and 999
  union all
  select 6, b.b, q.q, b.b * q.q
    from generate_series(11, 25) as b(b), generate_series(1, 999) as q(q)
   where b.b * q.q between 1000 and 9999
),
ranked as (
  select c.*,
         row_number() over (partition by c.diff, c.b order by md5(c.a::text || '/' || c.b::text)) as rn
    from cand c
),
picked as (
  -- 8 divisores x 24 = 192; 15 divisores x 13 = 195 (<= 200 por tanda)
  select * from ranked
   where rn <= case diff when 4 then 24 else 13 end
)
select
  'castillo', 'direct', a, b, q,
  a::text || ' ÷ ' || b::text || ' = ?',
  q,
  public.tmp_mk_div_distractors_0012(q),
  diff,
  'Repartir ' || a::text || ' en ' || b::text || ' partes iguales da ' || q::text
    || ', porque ' || b::text || ' × ' || q::text || ' = ' || a::text || '.'
from picked;

drop function public.tmp_mk_div_distractors_0012(int);

-- 4. Overrides solo para el Castillo ---------------------------------
update public.region_games set difficulty_min = 4, difficulty_max = 4, seconds_per_question = 25
 where region_id = 'castillo' and game_mode_id = 'battle';
update public.region_games set difficulty_min = 5, difficulty_max = 5, seconds_per_question = 40
 where region_id = 'castillo' and game_mode_id = 'bridge';
update public.region_games set difficulty_min = 6, difficulty_max = 6, seconds_per_question = 60
 where region_id = 'castillo' and game_mode_id = 'shop';

-- 5. submit_round: valida contra el rango efectivo --------------------
-- Cambios respecto a la 0005 (solo estos dos): (a) calcula v_diff_min/max
-- con coalesce(override, modo); (b) la validación de preguntas usa ese rango.
create or replace function public.submit_round(
  p_region_id    text,
  p_game_mode_id text,
  p_answers      jsonb   -- [{"question_id": 123, "answer": 42}, ...]
)
returns public.rounds
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_student_id   uuid;
  v_game         public.game_modes;
  v_region       public.regions;
  v_prev_game_id text;
  v_diff_min     smallint;
  v_diff_max     smallint;
  v_answer_count int;
  v_distinct_ids int;
  v_correct_count smallint;
  v_completed    boolean;
  v_stars        smallint;
  v_xp           integer;
  v_round        public.rounds;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_student_id from public.students where auth_user_id = v_uid;
  if not found then
    raise exception 'not_a_student';
  end if;

  select * into v_region from public.regions where id = p_region_id and is_active;
  if not found then
    raise exception 'invalid_region';
  end if;

  select * into v_game from public.game_modes where id = p_game_mode_id and is_active;
  if not found then
    raise exception 'invalid_game_mode';
  end if;

  if not exists (
    select 1 from public.region_games
    where region_id = p_region_id and game_mode_id = p_game_mode_id
  ) then
    raise exception 'game_not_in_region';
  end if;

  -- Rango de dificultad efectivo: el override de la región (region_games)
  -- si existe; si no, el del modo de juego (comportamiento de siempre).
  select coalesce(rg.difficulty_min, v_game.difficulty_min),
         coalesce(rg.difficulty_max, v_game.difficulty_max)
    into v_diff_min, v_diff_max
  from public.region_games rg
  where rg.region_id = p_region_id and rg.game_mode_id = p_game_mode_id;

  -- Desbloqueo secuencial: el nivel 1 siempre está abierto; los demás
  -- requieren una ronda completa con >=1 estrella en el nivel anterior.
  if v_game.sort_order > 1 then
    select id into v_prev_game_id
    from public.game_modes
    where sort_order = v_game.sort_order - 1 and is_active;

    if v_prev_game_id is null or not exists (
      select 1 from public.rounds
      where student_id = v_student_id
        and region_id = p_region_id
        and game_mode_id = v_prev_game_id
        and completed
        and stars >= 1
    ) then
      raise exception 'level_locked';
    end if;
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'invalid_answers';
  end if;

  v_answer_count := jsonb_array_length(p_answers);
  if v_answer_count > v_game.questions_per_round then
    raise exception 'too_many_answers';
  end if;

  select count(distinct (elem ->> 'question_id')::bigint)
    into v_distinct_ids
  from jsonb_array_elements(p_answers) as elem;
  if v_distinct_ids <> v_answer_count then
    raise exception 'duplicate_question';
  end if;

  -- Cada pregunta debe pertenecer a esta región y encajar con este nivel
  -- (mismo tipo y mismo rango de dificultad que se le pidió al cliente).
  if exists (
    select 1
    from jsonb_array_elements(p_answers) as elem
    left join public.questions q
      on q.id = (elem ->> 'question_id')::bigint
     and q.region_id = p_region_id
     and q.is_active
     and q.kind = any (v_game.question_kinds)
     and q.difficulty between v_diff_min and v_diff_max
    where q.id is null
  ) then
    raise exception 'invalid_question';
  end if;

  select count(*) filter (where q.correct_answer = (elem ->> 'answer')::integer)
    into v_correct_count
  from jsonb_array_elements(p_answers) as elem
  join public.questions q on q.id = (elem ->> 'question_id')::bigint;

  v_completed := (v_answer_count = v_game.questions_per_round);

  if not v_completed then
    v_stars := 0;
  elsif v_correct_count = v_answer_count then
    v_stars := 3;
  elsif v_correct_count >= ceil(v_answer_count * 0.7) then
    v_stars := 2;
  else
    v_stars := 1;
  end if;

  v_xp := case
    when v_completed then v_correct_count * 10 + (case v_stars when 3 then 30 when 2 then 15 else 0 end)
    else v_correct_count * 5
  end;

  insert into public.rounds
    (student_id, region_id, game_mode_id, questions_total, correct_count, completed, stars, xp_earned)
  values
    (v_student_id, p_region_id, p_game_mode_id, v_answer_count, v_correct_count, v_completed, v_stars, v_xp)
  returning * into v_round;

  insert into public.attempts (round_id, question_id, given_answer, is_correct)
  select v_round.id, (elem ->> 'question_id')::bigint, (elem ->> 'answer')::integer,
         q.correct_answer = (elem ->> 'answer')::integer
  from jsonb_array_elements(p_answers) as elem
  join public.questions q on q.id = (elem ->> 'question_id')::bigint;

  return v_round;
end;
$$;
