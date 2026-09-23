# Supabase

Las migraciones se ejecutan **a mano** en el panel de Supabase: **SQL Editor → New query**, pegar el archivo, **Run**. Ejecutarlas en orden numérico.

| Migración | Contenido |
|---|---|
| `0001_identity_and_courses.sql` | Docentes, cursos, estudiantes, RLS y funciones de registro |
| `0002_content_catalog.sql` | Regiones, juegos, combinaciones y banco de 735 preguntas |
| `0003_teacher_signup.sql` | Registro de docentes con código de institución |
| `0004_recalibrate_levels.sql` | Progresión de los 5 niveles y ampliación del banco de Resta |
| `0005_attempts_and_progress.sql` | Rondas, intentos, `submit_round()`, `get_my_progress()`: XP y desbloqueo reales |

Cada migración tiene su deshacer en `rollbacks/`.

## Antes de la 0001
En **Authentication** del panel:
1. *Sign In / Providers* → **Allow anonymous sign-ins**: activado.
2. *Rate Limits* → **Anonymous users**: subir el límite por hora (por defecto 30 por IP).

## Verificación de la 0001
```sql
-- Debe devolver 3 filas con rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('teachers','courses','students')
order by 1;

-- Debe devolver 9 filas
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' order by 1, 2;
```

## Verificación de la 0002
```sql
-- Debe devolver: preguntas 735, regiones 4, juegos 5, combinaciones 20
select (select count(*) from public.questions)    as preguntas,
       (select count(*) from public.regions)      as regiones,
       (select count(*) from public.game_modes)   as juegos,
       (select count(*) from public.region_games) as combinaciones;

-- Debe devolver 7 filas con rowsecurity = true (las 3 de la 0001 + las 4 nuevas)
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by 1;
```

## Configurar el registro de docentes (0003)
1. Authentication → Sign In / Providers (User Signups): **Confirm email → apagado**, y *Save changes* (ver ADR-005).
2. Define el código que darás a los docentes (elige uno largo y propio):
```sql
insert into public.app_settings (key, value)
values ('teacher_signup_code', 'ESCRIBE-TU-CODIGO')
on conflict (key) do update set value = excluded.value;
```
3. Para cerrar el registro de nuevos docentes: `delete from public.app_settings where key = 'teacher_signup_code';`

## Verificación de la 0004
```sql
-- Debe devolver los 5 niveles en orden 1-5: race, battle, bridge, shop, detective
select sort_order, id, questions_per_round, seconds_per_question, lives, difficulty_min, difficulty_max
from public.game_modes order by sort_order;

-- Debe devolver 1572 (735 originales + 837 nuevas de resta)
select count(*) from public.questions;
```

## Verificación de la 0005 (ya aplicada en producción)
Consultas para confirmar que quedó bien, si quieres volver a revisarlo desde el SQL Editor de Supabase:
```sql
-- Debe devolver 2 filas con rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('rounds','attempts')
order by 1;

-- Debe fallar con "not_a_student" si lo ejecutas desde el SQL Editor (no hay sesión de estudiante)
select public.submit_round('bosque', 'race', '[{"question_id": 1, "answer": 1}]'::jsonb);
```
Desde la app, tras jugar una ronda de prueba como estudiante:
```sql
-- Debe devolver la ronda recién jugada
select * from public.rounds order by created_at desc limit 1;

-- Debe devolver 4 regiones × 5 niveles = 20 filas, con el desbloqueo correcto
select * from public.get_my_progress();
```

## Variables del frontend
Solo la URL y la clave pública (`anon` / *publishable*). **Nunca** la `service_role`. Ver `.env.example`.
