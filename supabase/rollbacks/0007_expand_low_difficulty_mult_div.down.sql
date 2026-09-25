-- Deshace 0007: borra exactamente las preguntas nuevas que agregó y nada
-- más. No toca las combinaciones originales de la 0002 (esas siempre
-- tenían ambos operandos >= 2 y, en división, resultado/cociente >= 2).

delete from public.questions
where (region_id = 'ciudad'   and (operand_a = 1 or operand_b = 1))
   or (region_id = 'castillo' and (operand_b = 1 or result = 1));

drop function if exists public.tmp_mk_distractors_0007(text, text, int, int, int, int);
