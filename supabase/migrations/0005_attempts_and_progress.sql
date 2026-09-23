-- =====================================================================
-- MathQuest 5 · Migración 0005 · Intentos, estrellas, XP y desbloqueo
-- =====================================================================
-- Reemplaza el XP y las estrellas "de mentira" del prototipo (ver
-- ADR-004 y ADR-006). Toda esta migración gira alrededor de UNA función:
--
--   submit_round(region_id, game_mode_id, answers)
--
-- El cliente nunca declara si acertó ni cuánto XP ganó: solo manda qué
-- respondió a cada pregunta. El servidor recalcula todo desde
-- questions.correct_answer y decide estrellas, XP y si el nivel quedó
-- aprobado. Así, aunque alguien manipule el navegador, no puede
-- inflar su progreso (compromiso conocido: sigue pudiendo VER la
-- respuesta correcta antes de responder; ver ADR-004).
--
-- Reglas (ver ADR-007):
--   * Los 5 niveles de un mundo se desbloquean en orden. El nivel N+1
--     requiere una ronda COMPLETA y con al menos 1 estrella en el N.
--   * Estrellas: 3 si acertó el 100%, 2 si acertó 70%+, 1 si terminó la
--     ronda con menos de 70%, 0 si no la terminó (se quedó sin vidas).
--   * XP: 10 por acierto en una ronda completa, más un bono de 30/15/0
--     según las estrellas. Ronda incompleta: 5 por acierto, sin bono
--     (para no dejar sin nada el esfuerzo, pero sin premiar abandonar).
--   * Una región se desbloquea cuando el XP acumulado del estudiante
--     (en cualquier región) llega a su `regions.required_xp`.
-- =====================================================================

create table public.rounds (
  id             bigint generated always as identity primary key,
  student_id     uuid not null references public.students (id) on delete cascade,
  region_id      text not null references public.regions (id) on delete restrict,
  game_mode_id   text not null references public.game_modes (id) on delete restrict,
  questions_total smallint not null check (questions_total > 0),
  correct_count  smallint not null check (correct_count between 0 and questions_total),
  completed      boolean not null,
  stars          smallint not null check (stars between 0 and 3),
  xp_earned      integer not null check (xp_earned >= 0),
  created_at     timestamptz not null default now()
);
create index rounds_progress_idx on public.rounds (student_id, region_id, game_mode_id, created_at desc);

create table public.attempts (
  id           bigint generated always as identity primary key,
  round_id     bigint not null references public.rounds (id) on delete cascade,
  question_id  bigint not null references public.questions (id) on delete restrict,
  given_answer integer not null,
  is_correct   boolean not null,
  created_at   timestamptz not null default now()
);
create index attempts_round_idx on public.attempts (round_id);
create index attempts_question_idx on public.attempts (question_id);

-- ---------------------------------------------------------------------
-- submit_round: única puerta de entrada para registrar una ronda.
-- ---------------------------------------------------------------------

create function public.submit_round(
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

-- ---------------------------------------------------------------------
-- Lecturas para el frontend del estudiante (mapa de niveles y XP).
-- ---------------------------------------------------------------------

create function public.get_my_total_xp()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.xp_earned), 0)::integer
  from public.rounds r
  join public.students s on s.id = r.student_id
  where s.auth_user_id = (select auth.uid());
$$;

create function public.get_my_progress()
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
$$;

-- ---------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------

alter table public.rounds   enable row level security;
alter table public.attempts enable row level security;

create policy rounds_select_self on public.rounds
  for select to authenticated
  using (student_id in (select id from public.students where auth_user_id = (select auth.uid())));

create policy rounds_select_teacher on public.rounds
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = rounds.student_id and public.teacher_owns_course(s.course_id)
  ));

create policy attempts_select_self on public.attempts
  for select to authenticated
  using (round_id in (
    select r.id from public.rounds r
    join public.students s on s.id = r.student_id
    where s.auth_user_id = (select auth.uid())
  ));

create policy attempts_select_teacher on public.attempts
  for select to authenticated
  using (exists (
    select 1 from public.rounds r
    join public.students s on s.id = r.student_id
    where r.id = attempts.round_id and public.teacher_owns_course(s.course_id)
  ));

-- Sin insert/update/delete directos: todo pasa por submit_round().
revoke all on public.rounds, public.attempts from anon, authenticated;
grant select on public.rounds, public.attempts to authenticated;

revoke execute on function
  public.submit_round(text, text, jsonb), public.get_my_total_xp(), public.get_my_progress()
from public, anon;
grant execute on function
  public.submit_round(text, text, jsonb), public.get_my_total_xp(), public.get_my_progress()
to authenticated;
