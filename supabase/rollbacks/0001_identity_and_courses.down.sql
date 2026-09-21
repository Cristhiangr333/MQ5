-- Deshace 0001. ATENCIÓN: borra todos los docentes, cursos y estudiantes.
drop function if exists public.get_my_student();
drop function if exists public.register_student(text, text, text);
drop table if exists public.students;
drop table if exists public.courses;
drop table if exists public.teachers;
drop function if exists public.teacher_owns_course(uuid);
drop function if exists public.is_teacher();
drop function if exists public.generate_join_code();
