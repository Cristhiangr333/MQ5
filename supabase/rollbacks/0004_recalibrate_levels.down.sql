-- Deshace 0004: vuelve a los valores provisionales de la 0002, quita
-- las columnas de rango de dificultad y las preguntas de resta añadidas.
delete from public.questions where region_id = 'montana' and operand_a > 9;

alter table public.game_modes
  drop constraint if exists game_modes_difficulty_range_chk,
  drop column if exists difficulty_min,
  drop column if exists difficulty_max;

-- sort_order es único: se reordena en dos pasos para no chocar a mitad de camino.
update public.game_modes set sort_order = -sort_order;
update public.game_modes set questions_per_round=5, seconds_per_question=10, lives=3, sort_order=1 where id='race';
update public.game_modes set questions_per_round=5, seconds_per_question=12, lives=3, sort_order=2 where id='battle';
update public.game_modes set questions_per_round=5, seconds_per_question=12, lives=3, sort_order=3 where id='shop';
update public.game_modes set questions_per_round=5, seconds_per_question=15, lives=3, sort_order=4 where id='bridge';
update public.game_modes set questions_per_round=5, seconds_per_question=20, lives=3, sort_order=5 where id='detective';
