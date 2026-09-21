-- =====================================================================
-- MathQuest 5 · Migración 0003 · Registro de docentes (autoservicio)
-- =====================================================================
-- Reemplaza la creación manual de docentes de la 0001 (ver ADR-005).
--
-- Flujo: el docente se registra con correo y contraseña (Supabase Auth)
-- y luego la app llama a become_teacher(nombre, código). La función lo
-- convierte en docente solo si el código coincide con el que el
-- administrador configuró. Sin código configurado, el registro está
-- CERRADO (seguro por defecto).
--
-- Un docente solo ve sus propios cursos y estudiantes (RLS de la 0001),
-- así que registrarse no da acceso a datos de nadie más.
-- =====================================================================

-- Configuración privada de la aplicación. Sin políticas RLS: la app no
-- puede leerla ni escribirla; solo el administrador desde el SQL Editor.
create table public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- Convierte al usuario actual (con correo y contraseña) en docente.
-- Es idempotente: si ya es docente, devuelve su fila sin pedir el código.
create function public.become_teacher(
  p_full_name   text,
  p_access_code text default null
)
returns public.teachers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_required text;
  v_teacher  public.teachers;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_not_allowed';
  end if;

  select * into v_teacher from public.teachers where id = v_uid;
  if found then
    return v_teacher;
  end if;

  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 100 then
    raise exception 'invalid_name';
  end if;

  select btrim(value) into v_required
  from public.app_settings where key = 'teacher_signup_code';

  if v_required is null or v_required = '' then
    raise exception 'signup_closed';
  end if;

  if upper(btrim(coalesce(p_access_code, ''))) <> upper(v_required) then
    raise exception 'invalid_access_code';
  end if;

  insert into public.teachers (id, full_name)
  values (v_uid, btrim(p_full_name))
  returning * into v_teacher;

  return v_teacher;
end;
$$;

-- Rol del usuario actual, para que la app decida a qué pantalla enviarlo.
create function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.teachers t where t.id = (select auth.uid())) then 'teacher'
    when exists (select 1 from public.students s where s.auth_user_id = (select auth.uid())) then 'student'
    else 'none'
  end;
$$;

revoke execute on function public.become_teacher(text, text), public.get_my_role()
  from public, anon;
grant execute on function public.become_teacher(text, text), public.get_my_role()
  to authenticated;

-- =====================================================================
-- CONFIGURAR EL CÓDIGO DE REGISTRO DOCENTE (una vez, y cuando quieras
-- cambiarlo). Elige un código que solo conozcan los docentes:
--
--   insert into public.app_settings (key, value)
--   values ('teacher_signup_code', 'ESCRIBE-TU-CODIGO')
--   on conflict (key) do update set value = excluded.value;
--
-- Para CERRAR el registro de nuevos docentes:
--   delete from public.app_settings where key = 'teacher_signup_code';
-- =====================================================================
