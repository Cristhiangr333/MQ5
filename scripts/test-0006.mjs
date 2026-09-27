// Prueba de humo para 0006_teacher_progress.sql con Postgres simulado (PGlite).
// Corre las 6 migraciones desde cero, mete datos de 2 docentes/cursos/estudiantes,
// y confirma el caso normal + intentos de ver datos de otro docente.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const db = new PGlite();

function migrationSql(n) {
  const files = {
    1: 'supabase/migrations/0001_identity_and_courses.sql',
    2: 'supabase/migrations/0002_content_catalog.sql',
    3: 'supabase/migrations/0003_teacher_signup.sql',
    4: 'supabase/migrations/0004_recalibrate_levels.sql',
    5: 'supabase/migrations/0005_attempts_and_progress.sql',
    6: 'supabase/migrations/0006_teacher_progress.sql',
  };
  return readFileSync(files[n], 'utf8');
}

async function asUser(uid, fn) {
  await db.query(`select set_config('app.current_uid', $1, false)`, [uid ?? '']);
  await db.query(`select set_config('app.current_is_anon', $1, false)`, ['false']);
  // Sin esto, todo corre como el rol por defecto de PGlite (superusuario), que
  // se salta RLS por completo -- las funciones security definer (submit_round,
  // etc.) seguirían "pasando" igual porque revisan el dueño por dentro, pero un
  // `delete`/`select` directo sobre una tabla con RLS no se probaría de verdad.
  await db.query(`set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.query(`reset role;`);
  }
}

async function main() {
  console.log('--- Stub del esquema auth (PGlite no trae Supabase Auth) ---');
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end $$;
  `);
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.current_uid', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('is_anonymous', current_setting('app.current_is_anon', true)::boolean)
    $$;
  `);

  for (const n of [1, 2, 3, 4, 5, 6]) {
    console.log(`--- Aplicando migración 000${n} ---`);
    await db.exec(migrationSql(n));
  }
  console.log('OK: las 6 migraciones corrieron sin errores.\n');

  // --- Datos de prueba: 2 docentes, cada uno con su curso y un estudiante ---
  const teacherA = randomUUID();
  const teacherB = randomUUID();
  const studentA = randomUUID();

  await db.query(`insert into auth.users (id) values ($1), ($2), ($3)`, [teacherA, teacherB, studentA]);
  await db.query(`insert into public.teachers (id, full_name) values ($1, 'Docente A'), ($2, 'Docente B')`, [teacherA, teacherB]);

  const courseA = (
    await db.query(`insert into public.courses (teacher_id, name) values ($1, '3-A') returning id`, [teacherA])
  ).rows[0].id;
  await db.query(`insert into public.courses (teacher_id, name) values ($1, '3-B')`, [teacherB]);

  await db.query(
    `insert into public.students (id, auth_user_id, course_id, first_name, last_name) values ($1, $1, $2, 'Ana', 'López')`,
    [studentA, courseA],
  );

  // La estudiante juega y gana una ronda del nivel 1 (race) del bosque, perfecta.
  const q = await db.query(
    `select id, correct_answer from public.questions where region_id='bosque' and kind='direct' order by id limit 5`,
  );
  const answers = q.rows.map((r) => ({ question_id: r.id, answer: r.correct_answer }));

  await asUser(studentA, async () => {
    const res = await db.query(`select * from public.submit_round('bosque', 'race', $1::jsonb)`, [
      JSON.stringify(answers),
    ]);
    console.log('submit_round (estudiante) ->', res.rows[0]);
  });

  // --- Caso normal: el docente A ve el progreso de SU curso ---
  await asUser(teacherA, async () => {
    const summary = await db.query(`select * from public.get_course_progress_summary($1)`, [courseA]);
    console.log('\nget_course_progress_summary (docente A, su curso):');
    console.table(summary.rows);
    if (summary.rows.length !== 1 || summary.rows[0].total_xp <= 0) {
      throw new Error('FALLO: se esperaba 1 estudiante con XP > 0');
    }

    const detail = await db.query(`select * from public.get_student_level_detail($1)`, [studentA]);
    console.log(`get_student_level_detail (docente A, su estudiante): ${detail.rows.length} filas (se esperan 20)`);
    const raceRow = detail.rows.find((r) => r.region_id === 'bosque' && r.game_mode_id === 'race');
    console.log('  nivel bosque/race:', raceRow);
    if (detail.rows.length !== 20) throw new Error('FALLO: se esperaban 20 filas (4 regiones × 5 niveles)');
    if (!raceRow.best_stars || raceRow.best_stars < 1) throw new Error('FALLO: bosque/race debería tener estrellas');

    const battleRow = detail.rows.find((r) => r.region_id === 'bosque' && r.game_mode_id === 'battle');
    if (!battleRow.unlocked) throw new Error('FALLO: bosque/battle debería estar desbloqueado tras pasar race');
  });
  console.log('OK: el docente A ve el progreso real de su estudiante.\n');

  // --- Intento de trampa: el docente B trata de ver el curso/estudiante del docente A ---
  await asUser(teacherB, async () => {
    try {
      await db.query(`select * from public.get_course_progress_summary($1)`, [courseA]);
      throw new Error('FALLO DE SEGURIDAD: el docente B pudo leer el curso del docente A');
    } catch (e) {
      if (!String(e.message).includes('not_your_course')) throw e;
      console.log('OK: get_course_progress_summary rechazó al docente B con "not_your_course".');
    }

    try {
      await db.query(`select * from public.get_student_level_detail($1)`, [studentA]);
      throw new Error('FALLO DE SEGURIDAD: el docente B pudo leer el detalle del estudiante del docente A');
    } catch (e) {
      if (!String(e.message).includes('not_your_student')) throw e;
      console.log('OK: get_student_level_detail rechazó al docente B con "not_your_student".');
    }
  });

  // --- Estudiante sin rondas jugadas: debe salir con ceros, no reventar ---
  const studentB = randomUUID();
  await db.query(`insert into auth.users (id) values ($1)`, [studentB]);
  const courseB = (await db.query(`select id from public.courses where teacher_id = $1`, [teacherB])).rows[0].id;
  await db.query(
    `insert into public.students (id, auth_user_id, course_id, first_name, last_name) values ($1, $1, $2, 'Sin', 'Rondas')`,
    [studentB, courseB],
  );
  await asUser(teacherB, async () => {
    const summary = await db.query(`select * from public.get_course_progress_summary($1)`, [courseB]);
    console.log('\nEstudiante sin rondas jugadas:', summary.rows[0]);
    if (summary.rows[0].total_xp !== 0 || summary.rows[0].rounds_played !== 0) {
      throw new Error('FALLO: se esperaban ceros para un estudiante sin rondas');
    }
  });
  console.log('OK: un estudiante sin rondas no revienta la consulta (todo en cero).\n');

  // --- Borrado permanente de curso (TeacherPanel "Borrar para siempre"):
  // confirma el cascade real courses -> students -> rounds -> attempts, y
  // que el docente B no puede borrar el curso del docente A. ---
  const roundsBefore = (
    await db.query(`select count(*)::int as n from public.rounds where student_id = $1`, [studentA])
  ).rows[0].n;
  if (roundsBefore < 1) throw new Error('FALLO: se esperaba al menos 1 ronda ya jugada por studentA antes de borrar');

  await asUser(teacherB, async () => {
    // RLS no lanza excepción cuando no hay fila que coincida con `using` --
    // el DELETE simplemente afecta 0 filas. La prueba real es que el curso
    // siga existiendo después, no que esto truene.
    await db.query(`delete from public.courses where id = $1`, [courseA]);
  });
  const stillThere = await db.query(`select 1 from public.courses where id = $1`, [courseA]);
  if (stillThere.rows.length !== 1) throw new Error('FALLO DE SEGURIDAD: el curso del docente A desapareció sin que su dueño lo borrara');
  console.log('OK: el docente B no puede borrar el curso del docente A (RLS lo bloquea).');

  await asUser(teacherA, async () => {
    await db.query(`delete from public.courses where id = $1`, [courseA]);
  });
  const courseGone = await db.query(`select 1 from public.courses where id = $1`, [courseA]);
  const studentGone = await db.query(`select 1 from public.students where id = $1`, [studentA]);
  const roundsGone = await db.query(`select count(*)::int as n from public.rounds where student_id = $1`, [studentA]);
  if (courseGone.rows.length !== 0) throw new Error('FALLO: el curso siguió existiendo después de borrarlo');
  if (studentGone.rows.length !== 0) throw new Error('FALLO: el cascade no borró a la estudiante del curso');
  if (roundsGone.rows[0].n !== 0) throw new Error(`FALLO: el cascade no borró sus ${roundsBefore} ronda(s) jugada(s)`);
  console.log(`OK: el docente A borró su curso y el cascade se llevó a la estudiante y sus ${roundsBefore} ronda(s) con ella.\n`);

  console.log('✅ TODAS LAS PRUEBAS DE 0006 PASARON');
}

main()
  .catch((e) => {
    console.error('\n❌ FALLÓ LA PRUEBA:', e);
    process.exit(1);
  })
  .finally(() => db.close());
