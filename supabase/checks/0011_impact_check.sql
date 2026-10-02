-- Corre ESTO en el SQL Editor de Supabase ANTES de aplicar 0011_regions_unlock_in_order.sql.
-- Solo lee (select): no modifica nada. Cada fila es un estudiante al que la 0011 le cerraría una
-- región que hoy tiene abierta por XP. Sus datos no se borran: la región se reabre sola en cuanto
-- complete la isla anterior. 0 filas = la migración no le quita nada a nadie.

-- ¿A quién le cerraría islas la migración 0011? Estudiantes que YA jugaron una región
-- sin haber completado la anterior (la regla vieja por XP se lo permitía).
select c.name as curso, s.first_name, s.last_name, r.id as region_que_se_le_cerraria
from public.students s
join public.courses c on c.id = s.course_id
cross join public.regions r
where r.is_active and r.sort_order > 1
  and exists (select 1 from public.rounds x where x.student_id = s.id and x.region_id = r.id)
  and exists (
    select 1 from public.game_modes g
    where g.is_active and not exists (
      select 1 from public.rounds pr join public.regions p on p.sort_order = r.sort_order - 1
      where pr.student_id = s.id and pr.region_id = p.id and pr.game_mode_id = g.id
        and pr.completed and pr.stars >= 1))
order by c.name, s.first_name, r.sort_order;
