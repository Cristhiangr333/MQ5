-- Deshace 0003. Los docentes ya registrados se conservan.
drop function if exists public.get_my_role();
drop function if exists public.become_teacher(text, text);
drop table if exists public.app_settings;
