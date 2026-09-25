-- Deshace 0009: vuelve a dar select directo sobre `questions` a
-- `authenticated` (comportamiento original de la 0002) y quita la
-- función `get_round_questions`. Ojo: esto reabre la fuga que la 0009
-- cerraba (cualquier sesión podría volver a leer el banco completo con
-- respuestas incluidas) -- solo usar si hay una razón real para
-- revertir, no como parte de un ciclo normal.

grant select on public.questions to authenticated;

drop function if exists public.get_round_questions(text, text);
