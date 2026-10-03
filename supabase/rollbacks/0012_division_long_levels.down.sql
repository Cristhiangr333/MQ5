-- Deshace 0012: borra las divisiones largas (dificultad 4-6, solo castillo),
-- quita los overrides de region_games y restaura submit_round a la versión de 0005.
-- ATENCIÓN: borra también los `attempts` que apunten a esas preguntas (cascada
-- manual abajo) para no dejar filas huérfanas; los `rounds` se conservan.
begin;

delete from public.attempts
 where question_id in (select id from public.questions where difficulty >= 4);
delete from public.questions where difficulty >= 4;

alter table public.region_games
  drop constraint if exists region_games_difficulty_chk,
  drop constraint if exists region_games_seconds_chk,
  drop column if exists difficulty_min,
  drop column if exists difficulty_max,
  drop column if exists seconds_per_question;

alter table public.questions drop constraint if exists questions_difficulty_check;
alter table public.questions
  add constraint questions_difficulty_check check (difficulty between 1 and 3);

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
     and q.difficulty between v_game.difficulty_min and v_game.difficulty_max
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

commit;
