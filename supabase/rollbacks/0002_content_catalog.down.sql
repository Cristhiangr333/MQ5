-- Deshace 0002. ATENCIÓN: borra el catálogo (regiones, juegos y preguntas).
-- Si ya existe la 0003 (intentos y progreso), deshazla antes.
drop table if exists public.questions;
drop table if exists public.region_games;
drop table if exists public.game_modes;
drop table if exists public.regions;
