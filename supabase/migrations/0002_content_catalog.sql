-- =====================================================================
-- MathQuest 5 · Migración 0002 · Catálogo de contenido
-- =====================================================================
-- Contenido y configuración separados del código (ver ADR-004):
--   regions       4 regiones, una por operación
--   game_modes    5 tipos de juego y su configuración (tiempo, vidas...)
--   region_games  qué juegos se pueden jugar en cada región
--   questions     banco completo de hechos de 1 cifra (~735 preguntas)
--
-- Lectura: cualquier usuario con sesión (estudiantes anónimos y docentes).
-- Escritura: solo el administrador desde el SQL Editor.
-- Requiere: 0001 ejecutada (no depende de sus tablas, pero sí del orden).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

create table public.regions (
  id          text primary key,
  name        text not null,
  operation   text not null check (operation in ('add', 'sub', 'mul', 'div')),
  description text not null,
  sort_order  smallint not null unique,
  required_xp integer not null default 0 check (required_xp >= 0),
  is_active   boolean not null default true
);

-- Los ids coinciden con el tipo GameMode del frontend.
create table public.game_modes (
  id                   text primary key,
  name                 text not null,
  description          text not null,
  question_kinds       text[] not null
                       check (cardinality(question_kinds) >= 1
                              and question_kinds <@ array['direct', 'missing_first', 'missing_second']::text[]),
  questions_per_round  smallint not null default 5  check (questions_per_round between 3 and 20),
  seconds_per_question smallint not null default 12 check (seconds_per_question between 5 and 60),
  lives                smallint not null default 3  check (lives between 1 and 5),
  sort_order           smallint not null unique,
  is_active            boolean not null default true
);

create table public.region_games (
  region_id    text not null references public.regions (id) on delete cascade,
  game_mode_id text not null references public.game_modes (id) on delete cascade,
  primary key (region_id, game_mode_id)
);

-- Cada pregunta es un hecho  operand_a  <op>  operand_b  =  result.
--   direct         a ? b = [?]      responde el resultado
--   missing_first  [?] op b = r     responde operand_a
--   missing_second a op [?] = r     responde operand_b
-- difficulty 1 = resultado de 1 cifra; 2 y 3 = resultados mayores.
create table public.questions (
  id             bigint generated always as identity primary key,
  region_id      text not null references public.regions (id) on delete cascade,
  kind           text not null check (kind in ('direct', 'missing_first', 'missing_second')),
  operand_a      integer not null,
  operand_b      integer not null,
  result         integer not null,
  prompt         text not null,
  correct_answer integer not null,
  distractors    integer[] not null check (cardinality(distractors) >= 3),
  difficulty     smallint not null check (difficulty between 1 and 3),
  explanation    text not null,
  is_active      boolean not null default true,
  unique (region_id, kind, operand_a, operand_b),
  check (not (correct_answer = any (distractors)))
);
create index questions_pick_idx on public.questions (region_id, difficulty, kind) where is_active;

-- ---------------------------------------------------------------------
-- 2. Datos iniciales (valores provisionales: se recalibran en Progression)
-- ---------------------------------------------------------------------

insert into public.regions (id, name, operation, description, sort_order, required_xp) values
  ('bosque',   'Bosque de la Suma',           'add', 'Suma números de una cifra.',            1,   0),
  ('montana',  'Montaña de la Resta',         'sub', 'Resta números de una cifra.',           2,  50),
  ('ciudad',   'Ciudad de la Multiplicación', 'mul', 'Multiplica con las tablas.',           3, 150),
  ('castillo', 'Castillo de la División',     'div', 'Reparte en partes iguales.',            4, 300);

insert into public.game_modes
  (id, name, description, question_kinds, questions_per_round, seconds_per_question, lives, sort_order) values
  ('race',      'Carrera Matemática',  'Responde rápido para avanzar por la pista.',
     array['direct'],                                5, 10, 3, 1),
  ('battle',    'Batalla Matemática',  'Cada acierto es un ataque al enemigo.',
     array['direct'],                                5, 12, 3, 2),
  ('shop',      'Tienda Matemática',   'Resuelve las cuentas de las compras.',
     array['direct'],                                5, 12, 3, 3),
  ('bridge',    'Construye el Puente', 'Cada acierto coloca una pieza del puente.',
     array['direct'],                                5, 15, 3, 4),
  ('detective', 'Detective Matemático','Encuentra el número misterioso para resolver el caso.',
     array['missing_first', 'missing_second'],       5, 20, 3, 5);

-- Por defecto los 5 juegos están disponibles en las 4 regiones.
insert into public.region_games (region_id, game_mode_id)
select r.id, g.id from public.regions r cross join public.game_modes g;

-- ---------------------------------------------------------------------
-- 3. Banco de preguntas (generado; función temporal, se elimina al final)
-- ---------------------------------------------------------------------

-- Respuestas incorrectas plausibles, de más a menos probable (máx. 6).
create function public.tmp_mk_distractors(
  p_op text, p_kind text, p_a int, p_b int, p_r int, p_ans int
)
returns int[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  cand   int[] := array[p_ans + 1, p_ans - 1, p_ans + 2, p_ans - 2];
  picked int[] := '{}';
  v      int;
  extra  int := 3;
begin
  if p_kind = 'direct' then
    if    p_op = 'add' then cand := cand || abs(p_a - p_b);
    elsif p_op = 'sub' then cand := cand || (p_a + p_b);
    elsif p_op = 'mul' then cand := cand || array[p_ans + p_a, p_ans - p_a, p_ans + p_b, p_ans - p_b, p_a + p_b];
    elsif p_op = 'div' then cand := cand || (p_a - p_b);
    end if;
  else
    cand := cand || p_r;   -- error típico: responder con el resultado
  end if;

  foreach v in array cand loop
    if v >= 1 and v <> p_ans and not (v = any (picked)) then
      picked := picked || v;
    end if;
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
  select 'bosque'::text as region_id, 'add'::text as op, x.a, y.b, x.a + y.b as r
    from generate_series(1, 9) as x(a), generate_series(1, 9) as y(b)
  union all
  select 'montana', 'sub', x.a, y.b, x.a - y.b
    from generate_series(2, 9) as x(a), generate_series(1, 8) as y(b) where y.b < x.a
  union all
  select 'ciudad', 'mul', x.a, y.b, x.a * y.b
    from generate_series(2, 9) as x(a), generate_series(2, 9) as y(b)
  union all
  select 'castillo', 'div', y.b * q.q, y.b, q.q
    from generate_series(2, 9) as y(b), generate_series(2, 9) as q(q)
),
expanded as (
  select f.*, k.kind,
         case f.op when 'add' then '+' when 'sub' then '-' when 'mul' then '×' else '÷' end as sym,
         case k.kind when 'missing_first' then f.a when 'missing_second' then f.b else f.r end as ans
  from facts f
  cross join (values ('direct'), ('missing_first'), ('missing_second')) as k(kind)
)
select
  region_id, kind, a, b, r,
  case kind
    when 'direct'         then a::text || ' ' || sym || ' ' || b::text || ' = ?'
    when 'missing_first'  then '[ ? ] ' || sym || ' ' || b::text || ' = ' || r::text
    else                       a::text || ' ' || sym || ' [ ? ] = ' || r::text
  end,
  ans,
  public.tmp_mk_distractors(op, kind, a, b, r, ans),
  (case op
     when 'add' then case when r <= 9 then 1 else 2 end
     when 'sub' then 1
     when 'mul' then case when r <= 9 then 1 when r <= 25 then 2 else 3 end
     else            case when a <= 9 then 1 when a <= 25 then 2 else 3 end
   end)::smallint,
  case
    when kind <> 'direct' then
      'El número misterioso es ' || ans::text || ', porque ' || a::text || ' ' || sym || ' ' || b::text || ' = ' || r::text || '.'
    when op = 'add' then a::text || ' más ' || b::text || ' es igual a ' || r::text || '.'
    when op = 'sub' then 'Si a ' || a::text || ' le quitas ' || b::text || ', te quedan ' || r::text
                         || '. ¡Porque ' || r::text || ' + ' || b::text || ' = ' || a::text || '!'
    when op = 'mul' then a::text || ' grupos de ' || b::text || ' son ' || r::text || '.'
    else 'Repartir ' || a::text || ' en ' || b::text || ' partes iguales da ' || r::text
         || ', porque ' || b::text || ' × ' || r::text || ' = ' || a::text || '.'
  end
from expanded;

drop function public.tmp_mk_distractors(text, text, int, int, int, int);

-- ---------------------------------------------------------------------
-- 4. RLS y permisos: lectura para cualquier sesión, escritura solo admin
-- ---------------------------------------------------------------------

alter table public.regions      enable row level security;
alter table public.game_modes   enable row level security;
alter table public.region_games enable row level security;
alter table public.questions    enable row level security;

create policy regions_select_active on public.regions
  for select to authenticated using (is_active);
create policy game_modes_select_active on public.game_modes
  for select to authenticated using (is_active);
create policy region_games_select_all on public.region_games
  for select to authenticated using (true);
create policy questions_select_active on public.questions
  for select to authenticated using (is_active);

revoke all on public.regions, public.game_modes, public.region_games, public.questions
  from anon, authenticated;
grant select on public.regions, public.game_modes, public.region_games, public.questions
  to authenticated;
