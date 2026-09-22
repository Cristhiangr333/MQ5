-- =====================================================================
-- MathQuest 5 · Migración 0004 · Progresión de los 5 niveles
-- =====================================================================
-- Actualiza los valores PROVISIONALES de game_modes que dejó la 0002 con
-- la dificultad progresiva acordada (ver ADR-006). No se edita 0002
-- porque ya se ejecutó en producción: el historial de migraciones debe
-- reflejar lo que realmente corrió, en el orden en que corrió.
--
-- Orden fijo de niveles dentro de CADA mundo (mismo orden en los 4):
--   1 Carrera · 2 Batalla · 3 Puente · 4 Tienda · 5 Detective
--
-- Añade difficulty_min/difficulty_max: el rango de la columna
-- questions.difficulty que debe servirse en ese nivel. La lógica que
-- elige preguntas (Fase 2, frontend) debe respetar este rango.
-- =====================================================================

alter table public.game_modes
  add column difficulty_min smallint,
  add column difficulty_max smallint;

-- sort_order es único: se reordena en dos pasos (a negativos y luego al
-- valor final) para que nunca haya dos filas con el mismo número a la vez.
update public.game_modes set sort_order = -sort_order;

-- Nivel 1 · Carrera · el más suave: solo resultados de 1 cifra.
update public.game_modes set
  sort_order = 1, questions_per_round = 5, seconds_per_question = 12, lives = 3,
  difficulty_min = 1, difficulty_max = 1
where id = 'race';

-- Nivel 2 · Batalla · empieza a mezclar resultados algo mayores.
update public.game_modes set
  sort_order = 2, questions_per_round = 5, seconds_per_question = 11, lives = 3,
  difficulty_min = 1, difficulty_max = 2
where id = 'battle';

-- Nivel 3 · Puente · ronda más larga, ya sin resultados de 1 cifra.
update public.game_modes set
  sort_order = 3, questions_per_round = 6, seconds_per_question = 10, lives = 3,
  difficulty_min = 2, difficulty_max = 2
where id = 'bridge';

-- Nivel 4 · Tienda · menos vidas: exige más precisión.
update public.game_modes set
  sort_order = 4, questions_per_round = 6, seconds_per_question = 10, lives = 2,
  difficulty_min = 2, difficulty_max = 3
where id = 'shop';

-- Nivel 5 · Detective · el reto numérico se mantiene moderado a propósito:
-- la dificultad real de este nivel ya viene del formato "número faltante",
-- no hace falta sumarle también los resultados más grandes.
update public.game_modes set
  sort_order = 5, questions_per_round = 5, seconds_per_question = 15, lives = 2,
  difficulty_min = 1, difficulty_max = 2
where id = 'detective';

alter table public.game_modes
  alter column difficulty_min set not null,
  alter column difficulty_max set not null,
  add constraint game_modes_difficulty_range_chk
    check (difficulty_min between 1 and 3
       and difficulty_max between 1 and 3
       and difficulty_min <= difficulty_max);

-- ---------------------------------------------------------------------
-- Corrección de contenido: la 0002 generó la Resta solo con minuendos de
-- 1 cifra (2 a 9), así que TODA la resta quedó en difficulty=1. Con los
-- rangos de arriba, Puente (nivel 3, dificultad 2) y Tienda (nivel 4,
-- dificultad 2-3) del mundo Montaña se quedarían sin preguntas. Se
-- amplía el banco con minuendos de 2 cifras para esos niveles.
-- ---------------------------------------------------------------------

create function public.tmp_mk_distractors_0004(p_a int, p_b int, p_ans int)
returns int[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  cand int[] := array[p_ans + 1, p_ans - 1, p_ans + 2, p_ans - 2, p_a + p_b];
  picked int[] := '{}';
  v int; extra int := 3;
begin
  foreach v in array cand loop
    if v >= 1 and v <> p_ans and not (v = any (picked)) then picked := picked || v; end if;
  end loop;
  while cardinality(picked) < 3 loop
    v := p_ans + extra;
    if not (v = any (picked)) then picked := picked || v; end if;
    extra := extra + 1;
  end loop;
  return picked[1:6];
end;
$$;

insert into public.questions
  (region_id, kind, operand_a, operand_b, result, prompt, correct_answer, distractors, difficulty, explanation)
with facts as (
  -- Nivel 3 (Puente): minuendo de 2 cifras (10-20) menos 1 cifra.
  select x.a, y.b, x.a - y.b as r, 2::smallint as difficulty
    from generate_series(10, 20) as x(a), generate_series(1, 9) as y(b) where y.b < x.a
  union all
  -- Nivel 4 (Tienda): resta de dos cifras contra dos cifras.
  select x.a, y.b, x.a - y.b, 3::smallint
    from generate_series(21, 40) as x(a), generate_series(11, 19) as y(b) where y.b < x.a
),
expanded as (
  select f.*, k.kind,
         case k.kind when 'missing_first' then f.a when 'missing_second' then f.b else f.r end as ans
  from facts f
  cross join (values ('direct'), ('missing_first'), ('missing_second')) as k(kind)
)
select
  'montana', kind, a, b, r,
  case kind
    when 'direct'        then a::text || ' - ' || b::text || ' = ?'
    when 'missing_first' then '[ ? ] - ' || b::text || ' = ' || r::text
    else                      a::text || ' - [ ? ] = ' || r::text
  end,
  ans,
  public.tmp_mk_distractors_0004(a, b, ans),
  difficulty,
  case
    when kind <> 'direct' then 'El número misterioso es ' || ans::text || ', porque ' || a::text || ' - ' || b::text || ' = ' || r::text || '.'
    else 'Si a ' || a::text || ' le quitas ' || b::text || ', te quedan ' || r::text || '. ¡Porque ' || r::text || ' + ' || b::text || ' = ' || a::text || '!'
  end
from expanded;

drop function public.tmp_mk_distractors_0004(int, int, int);
