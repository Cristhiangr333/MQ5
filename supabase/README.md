# Supabase

Las migraciones se ejecutan **a mano** en el panel de Supabase: **SQL Editor → New query**, pegar el archivo, **Run**. Ejecutarlas en orden numérico.

| Migración | Contenido |
|---|---|
| `0001_identity_and_courses.sql` | Docentes, cursos, estudiantes, RLS y funciones de registro |

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

## Variables del frontend
Solo la URL y la clave pública (`anon` / *publishable*). **Nunca** la `service_role`. Ver `.env.example`.
