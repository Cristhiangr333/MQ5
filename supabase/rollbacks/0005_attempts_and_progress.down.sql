-- Deshace 0005. ATENCIÓN: borra todo el historial de rondas e intentos.
drop function if exists public.get_my_progress();
drop function if exists public.get_my_total_xp();
drop function if exists public.submit_round(text, text, jsonb);
drop table if exists public.attempts;
drop table if exists public.rounds;
