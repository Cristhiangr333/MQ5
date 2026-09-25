-- =====================================================================
-- MathQuest 5 · Migración 0007 · Amplía Multiplicación/División (dif. 1)
-- =====================================================================
-- Motivo (ver docs/DECISIONS.md, hallazgo de auditoría de funcionalidad):
-- la 0002 generó "ciudad" (mul) y "castillo" (div) solo con AMBOS
-- operandos en [2,9]. Como dificultad 1 = resultado de una cifra (≤9),
-- eso deja apenas 6 combinaciones posibles en cada región para esa
-- dificultad (ej. mul: 2×2, 2×3, 2×4, 3×2, 3×3, 4×2). Carrera Matemática
-- (dificultad fija 1, 5 preguntas por ronda) en esas dos regiones tenía
-- solo 6 preguntas disponibles — un estudiante que repite el nivel ve
-- casi siempre las mismas.
--
-- Esta migración agrega los hechos con un operando = 1 (×1 y ÷1), que
-- son válidos y apropiados para dificultad 1 y no rompen ninguna regla
-- existente (mismo unique(region_id, kind, operand_a, operand_b); como
-- la 0002 exigía AMBOS operandos ≥2, no hay ninguna fila que pueda
-- chocar con esta). Quedan 23 combinaciones por región (17 nuevas + 6
-- que ya había) × 3 kinds = un banco mucho más sano para dificultad 1,
-- y de paso también ayuda un poco a Batalla/Tienda/Detective, que
-- también leen de ese rango de dificultad.
--
-- Requiere: 0001-0006 ya ejecutadas.
-- =====================================================================

-- Misma función de distractores que usó la 0002 (se elimina al final).
create function public.tmp_mk_distractors_0007(
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
    if    p_op = 'mul' then cand := cand || array[p_ans + p_a, p_ans - p_a, p_ans + p_b, p_ans - p_b, p_a + p_b];
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
  -- Tabla del 1 de multiplicación: al menos un operando es 1, el otro 1-9.
  -- (La 0002 solo cubrió ambos operandos en [2,9], así que no hay choque.)
  select 'ciudad'::text as region_id, 'mul'::text as op, x.a, y.b, x.a * y.b as r
    from generate_series(1, 9) as x(a), generate_series(1, 9) as y(b)
    where x.a = 1 or y.b = 1
  union all
  -- Dividir por 1, y dividir un número entre sí mismo (resultado 1).
  select 'castillo', 'div', y.b * q.q, y.b, q.q
    from generate_series(1, 9) as y(b), generate_series(1, 9) as q(q)
    where y.b = 1 or q.q = 1
),
expanded as (
  select f.*, k.kind,
         case f.op when 'mul' then '×' else '÷' end as sym,
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
  public.tmp_mk_distractors_0007(op, kind, a, b, r, ans),
  1::smallint,  -- toda esta tanda es, por diseño, dificultad 1 (resultado siempre ≤ 9)
  case
    when kind <> 'direct' then
      'El número misterioso es ' || ans::text || ', porque ' || a::text || ' ' || sym || ' ' || b::text || ' = ' || r::text || '.'
    when op = 'mul' then a::text || ' grupos de ' || b::text || ' son ' || r::text || '.'
    else 'Repartir ' || a::text || ' en ' || b::text || ' partes iguales da ' || r::text
         || ', porque ' || b::text || ' × ' || r::text || ' = ' || a::text || '.'
  end
from expanded;

drop function public.tmp_mk_distractors_0007(text, text, int, int, int, int);
