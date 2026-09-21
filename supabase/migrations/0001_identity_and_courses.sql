-- =====================================================================
-- MathQuest 5 · Migración 0001 · Identidad y cursos
-- =====================================================================
-- Modelo de acceso (ver docs/DECISIONS.md, ADR-002):
--   * Estudiantes: sin cuenta ni contraseña. Usan una sesión ANÓNIMA de
--     Supabase Auth (identificador invisible) y se registran con su
--     nombre, apellido y el código de su curso.
--   * Docentes: correo y contraseña. Los crea el administrador a mano;
--     nadie puede convertirse en docente por su cuenta.
--   * Todo pasa por RLS. Los estudiantes solo se registran con la
--     función register_student().
--
-- Antes de ejecutar (panel de Supabase → Authentication):
--   1. Sign In / Providers → "Allow anonymous sign-ins": ACTIVADO.
--   2. Rate Limits → "Anonymous users": subirlo (por defecto 30/hora
--      por IP; un salón entero comparte la IP del colegio).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

-- Docentes (se llena a mano; ver instrucciones al final del archivo).
create table public.teachers (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 100),
  created_at timestamptz not null default now()
);

-- Generador de códigos de curso: 5 caracteres, sin 0/O/1/I para evitar
-- confusiones. SECURITY DEFINER para verificar unicidad contra TODOS los
-- cursos (un docente con RLS solo vería los suyos).
create function public.generate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.courses where join_code = code);
  end loop;
  return code;
end;
$$;

-- Cursos de cada docente. El estudiante entra con join_code.
create table public.courses (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  name       text not null check (char_length(btrim(name)) between 1 and 50),
  join_code  text not null unique default public.generate_join_code()
             check (join_code ~ '^[A-Z0-9]{5}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index courses_teacher_id_idx on public.courses (teacher_id);

-- Estudiantes: una fila por identidad anónima.
create table public.students (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  first_name   text not null check (char_length(btrim(first_name)) between 1 and 50),
  last_name    text not null check (char_length(btrim(last_name)) between 1 and 50),
  created_at   timestamptz not null default now()
);
create index students_course_id_idx on public.students (course_id);

-- ---------------------------------------------------------------------
-- 2. Funciones auxiliares (evitan recursión entre políticas RLS)
-- ---------------------------------------------------------------------

create function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.teachers t where t.id = (select auth.uid()));
$$;

create function public.teacher_owns_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.teacher_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Funciones para el estudiante (única vía de registro y lectura propia)
-- ---------------------------------------------------------------------

-- Registra al estudiante anónimo actual en el curso con ese código.
-- Es idempotente: si ya estaba registrado, devuelve su fila sin cambios.
create function public.register_student(
  p_join_code  text,
  p_first_name text,
  p_last_name  text
)
returns public.students
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_course  public.courses;
  v_student public.students;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_only';
  end if;

  select * into v_student from public.students where auth_user_id = v_uid;
  if found then
    return v_student;
  end if;

  select * into v_course
  from public.courses
  where join_code = upper(btrim(p_join_code)) and is_active;
  if not found then
    raise exception 'invalid_course_code';
  end if;

  insert into public.students (auth_user_id, course_id, first_name, last_name)
  values (v_uid, v_course.id, btrim(p_first_name), btrim(p_last_name))
  returning * into v_student;

  return v_student;
end;
$$;

-- Perfil del estudiante actual con el nombre de su curso (0 filas si
-- todavía no se registró).
create function public.get_my_student()
returns table (
  student_id  uuid,
  first_name  text,
  last_name   text,
  course_id   uuid,
  course_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.first_name, s.last_name, c.id, c.name
  from public.students s
  join public.courses c on c.id = s.course_id
  where s.auth_user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------

alter table public.teachers enable row level security;
alter table public.courses  enable row level security;
alter table public.students enable row level security;

-- teachers: cada docente solo se ve a sí mismo. Sin insert/update/delete
-- desde la app: solo el administrador desde el SQL Editor.
create policy teachers_select_self on public.teachers
  for select to authenticated
  using (id = (select auth.uid()));

-- courses: cada docente gestiona únicamente sus cursos.
create policy courses_select_own on public.courses
  for select to authenticated
  using (teacher_id = (select auth.uid()));

create policy courses_insert_own on public.courses
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.is_teacher());

create policy courses_update_own on public.courses
  for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create policy courses_delete_own on public.courses
  for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- students: el estudiante ve solo su fila; el docente ve y corrige los
-- de sus cursos. Nadie inserta directamente (solo register_student()).
create policy students_select_self on public.students
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy students_select_teacher on public.students
  for select to authenticated
  using (public.teacher_owns_course(course_id));

create policy students_update_teacher on public.students
  for update to authenticated
  using (public.teacher_owns_course(course_id))
  with check (public.teacher_owns_course(course_id));

create policy students_delete_teacher on public.students
  for delete to authenticated
  using (public.teacher_owns_course(course_id));

-- ---------------------------------------------------------------------
-- 5. Permisos (defensa en profundidad: además de RLS)
-- ---------------------------------------------------------------------

revoke all on public.teachers, public.courses, public.students from anon, authenticated;

grant select on public.teachers to authenticated;
grant select, insert, delete on public.courses to authenticated;
grant update (name, is_active) on public.courses to authenticated;
grant select, delete on public.students to authenticated;
grant update (first_name, last_name, course_id) on public.students to authenticated;

revoke execute on function
  public.generate_join_code(),
  public.is_teacher(),
  public.teacher_owns_course(uuid),
  public.register_student(text, text, text),
  public.get_my_student()
from public, anon;

grant execute on function
  public.generate_join_code(),
  public.is_teacher(),
  public.teacher_owns_course(uuid),
  public.register_student(text, text, text),
  public.get_my_student()
to authenticated;

-- =====================================================================
-- CÓMO CREAR UN DOCENTE (manual, una vez por docente)
-- 1. Authentication → Users → Add user → correo + contraseña
--    (marca "Auto Confirm User"). Copia el UUID del usuario creado.
-- 2. Ejecuta, con ese UUID:
--
--   insert into public.teachers (id, full_name)
--   values ('PEGA-AQUI-EL-UUID', 'Nombre del docente');
--
-- El docente ya puede iniciar sesión y crear cursos; cada curso recibe
-- su código automáticamente.
-- =====================================================================
