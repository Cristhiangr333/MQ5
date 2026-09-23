-- Deshace 0005: quita las funciones de lectura/escritura de progreso y
-- las tablas de intentos y rondas. Es destructivo: borra el historial
-- de rondas jugadas. No ejecutar en producción sin respaldo.

revoke execute on function
  public.submit_round(text, text, jsonb), public.get_my_total_xp(), public.get_my_progress()
from authenticated;

drop function if exists public.get_my_progress();
drop function if exists public.get_my_total_xp();
drop function if exists public.submit_round(text, text, jsonb);

drop table if exists public.attempts;
drop table if exists public.rounds;
