# Supabase

Las migraciones se ejecutan **a mano** en el panel de Supabase: **SQL Editor → New query**, pegar el archivo, **Run**. Ejecutarlas en orden numérico.

| Migración | Contenido |
|---|---|
| `0001_identity_and_courses.sql` | Docentes, cursos, estudiantes, RLS y funciones de registro |
| `0002_content_catalog.sql` | Regiones, juegos, combinaciones y banco de 735 preguntas |

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

## Variables del frontend
Solo la URL y la clave pública (`anon` / *publishable*). **Nunca** la `service_role`. Ver `.env.example`.
