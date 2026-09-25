# Supabase

Las migraciones se ejecutan **a mano** en el panel de Supabase: **SQL Editor → New query**, pegar el archivo, **Run**. Ejecutarlas en orden numérico.

| Migración | Contenido |
|---|---|
| `0001_identity_and_courses.sql` | Docentes, cursos, estudiantes, RLS y funciones de registro |
| `0002_content_catalog.sql` | Regiones, juegos, combinaciones y banco de 735 preguntas |
| `0003_teacher_signup.sql` | Registro de docentes con código de institución |
| `0004_recalibrate_levels.sql` | Progresión de los 5 niveles y ampliación del banco de Resta |
| `0005_attempts_and_progress.sql` | Rondas, intentos, estrellas, XP y desbloqueo — todo calculado en el servidor |
| `0006_teacher_progress.sql` | Progreso real por estudiante (XP, niveles, aciertos) para el panel docente |
| `0007_expand_low_difficulty_mult_div.sql` | Amplía Multiplicación/División en dificultad 1 (tabla del 1) |
| `0008_prevent_duplicate_students.sql` | `register_student()`: mismo nombre en el curso → continúa el progreso en vez de duplicar |
| `0009_restrict_question_bank_access.sql` | Cierra el acceso directo a `questions`: ya solo se lee a través de `get_round_questions()` |

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

## Verificación de la 0005
```sql
-- Debe devolver 4 filas: rounds y attempts con rowsecurity=true, y 4 políticas en total
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('rounds','attempts');
select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('rounds','attempts') order by 1,2;
```
Para probarla de verdad, juega una ronda desde la app una vez esté conectada (Fase 2) y confirma en Table Editor que aparecen filas en `rounds` y `attempts`.

## Variables del frontend
Solo la URL y la clave pública (`anon` / *publishable*). **Nunca** la `service_role`. Ver `.env.example`.

## Verificación de la 0007
Motivo: Carrera Matemática (dificultad fija 1) en Ciudad y Castillo solo tenía 6
preguntas disponibles para una ronda de 5 — ver auditoría de funcionalidad en
`docs/DECISIONS.md`.
```sql
-- Debe devolver 1674 (1572 antes de la 0007 + 102 nuevas)
select count(*) from public.questions;

-- Debe devolver 23 en las 2 filas de "Carrera Matemática" (antes: 6)
select
  r.name as region, gm.name as juego,
  count(q.id) as preguntas_disponibles, gm.questions_per_round
from public.regions r
cross join public.game_modes gm
left join public.questions q
  on q.region_id = r.id and q.is_active = true
  and q.kind = any(gm.question_kinds)
  and q.difficulty between gm.difficulty_min and gm.difficulty_max
where r.id in ('ciudad','castillo')
group by r.name, r.sort_order, gm.name, gm.sort_order, gm.questions_per_round
order by r.sort_order, gm.sort_order;
```

## Verificación de la 0008
Motivo: un mismo estudiante podía quedar duplicado en el panel docente si
jugaba desde más de un dispositivo (o borraba el caché) — ver ADR-009 en
`docs/DECISIONS.md`. Después de correrla, revisa que no queden duplicados
**de antes** del arreglo (la migración no los fusiona retroactivamente, solo
evita que se creen nuevos):
```sql
-- Si aparece alguna fila aquí, son estudiantes duplicados de ANTES de la
-- 0008 (mismo nombre, mismo curso) que conviene fusionar a mano en Supabase
-- (decidir cuál fila se queda, mover sus attempts/rounds si hace falta, y
-- borrar la otra).
select course_id, lower(first_name) as nombre, lower(last_name) as apellido, count(*)
from public.students
group by 1,2,3
having count(*) > 1;
```

## Verificación de la 0009
Motivo: cualquier sesión de estudiante podía leer el banco completo de
preguntas (con las respuestas correctas) directamente, no solo las de su
ronda — ver ADR-010 en `docs/DECISIONS.md`.
```sql
-- Debe devolver `false`: ya nadie con sesión normal puede leer questions directo
select has_table_privilege('authenticated', 'public.questions', 'select');

-- Debe devolver 5 filas con su correct_answer (así sigue jugando el estudiante,
-- solo que ahora por esta función en vez de la tabla directa)
select * from public.get_round_questions('bosque', 'race');
```
Después de correrla, juega una ronda desde la app (o pide a un estudiante de
prueba que lo haga) para confirmar que el juego sigue funcionando igual que
antes — este cambio no debería notarse desde afuera.
