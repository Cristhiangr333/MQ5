// Prueba de la migración 0012 (divisiones largas del Castillo) con Postgres simulado (PGlite).
// Corre 0001..0012 desde cero y comprueba: banco nuevo (exacto, <=200 por tanda, 4/5/6),
// que las otras regiones y la dificultad 1-3 NO cambian, y que submit_round valida con el
// rango efectivo (override en castillo, rango del modo en el resto).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
const ok = (m) => console.log('OK:', m);
const fail = (m) => { throw new Error('FALLO: ' + m); };
const assert = (c, m) => (c ? ok(m) : fail(m));

async function asUser(uid, fn) {
  await db.query(`select set_config('app.current_uid', $1, false)`, [uid]);
  await db.query(`select set_config('app.current_is_anon', 'false', false)`);
  await db.query(`set role authenticated;`);
  try { return await fn(); } finally { await db.query(`reset role;`); }
}
async function rejects(fn, text, msg) {
  try { await fn(); } catch (e) { if (String(e.message).includes(text)) return ok(msg); throw e; }
  fail(msg + ' (no se rechazó)');
}

await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  end $$;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous', current_setting('app.current_is_anon', true)::boolean) $$;
`);

const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
let before = null;
for (const f of files) {
  if (f.startsWith('0012')) {
    before = (await db.query(`select region_id, difficulty, kind, count(*)::int n from public.questions group by 1,2,3 order by 1,2,3`)).rows;
    // submit_round de 0005 "antes": su definición se compara abajo con la nueva
  }
  await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
}
ok(`${files.length} migraciones corrieron sin errores (incluida la 0012)`);

// --- Banco nuevo ---------------------------------------------------------
const after = (await db.query(`select region_id, difficulty, kind, count(*)::int n from public.questions where difficulty <= 3 group by 1,2,3 order by 1,2,3`)).rows;
assert(JSON.stringify(before) === JSON.stringify(after), 'las preguntas existentes (dificultad 1-3, todas las regiones) quedaron idénticas');

const tiers = (await db.query(`select difficulty, count(*)::int n, min(operand_a) amin, max(operand_a) amax, min(operand_b) bmin, max(operand_b) bmax,
  count(*) filter (where region_id <> 'castillo' or kind <> 'direct')::int bad,
  count(*) filter (where operand_a <> operand_b * correct_answer)::int inexact,
  count(*) filter (where cardinality(distractors) < 3 or correct_answer = any(distractors))::int baddist
  from public.questions where difficulty >= 4 group by 1 order by 1`)).rows;
console.table(tiers);
assert(tiers.length === 3 && tiers.every((t) => t.n >= 150 && t.n <= 200), 'tandas 4/5/6 existen y cada una tiene entre 150 y 200 preguntas');
assert(tiers.every((t) => t.bad === 0 && t.inexact === 0 && t.baddist === 0), 'todas son castillo/direct, exactas y con distractores válidos');
assert(tiers[0].amin >= 100 && tiers[0].amax <= 999 && tiers[0].bmin >= 2 && tiers[0].bmax <= 9, 'nivel 4: 3 cifras ÷ 1 cifra');
assert(tiers[1].amin >= 100 && tiers[1].amax <= 999 && tiers[1].bmin >= 11 && tiers[1].bmax <= 25, 'nivel 5: 3 cifras ÷ 2 cifras');
assert(tiers[2].amin >= 1000 && tiers[2].amax <= 9999 && tiers[2].bmin >= 11 && tiers[2].bmax <= 25, 'nivel 6: 4 cifras ÷ 2 cifras');
const sample = (await db.query(`select prompt, correct_answer, distractors[1:2] d from public.questions where difficulty >= 4 order by random() limit 4`)).rows;
console.log('muestra:', JSON.stringify(sample));

// --- Overrides: solo castillo ------------------------------------------
const ov = (await db.query(`select region_id, game_mode_id, difficulty_min a, difficulty_max b, seconds_per_question s from public.region_games where difficulty_min is not null or seconds_per_question is not null order by 2`)).rows;
console.table(ov);
assert(ov.length === 3 && ov.every((r) => r.region_id === 'castillo'), 'solo 3 filas con override y todas son del castillo');

// --- submit_round --------------------------------------------------------
const teacher = randomUUID(), s1 = randomUUID();
await db.query(`insert into auth.users (id) values ($1), ($2)`, [teacher, s1]);
await db.query(`insert into public.teachers (id, full_name) values ($1, 'Doc')`, [teacher]);
const course = (await db.query(`insert into public.courses (teacher_id, name) values ($1, '3-A') returning id`, [teacher])).rows[0].id;
await db.query(`insert into public.students (id, auth_user_id, course_id, first_name, last_name) values ($1, $1, $2, 'Ana', 'López')`, [s1, course]);

const pick = async (region, kind, dmin, dmax, n) => (await db.query(
  `select id, correct_answer from public.questions where region_id=$1 and kind=any($2) and difficulty between $3 and $4 order by random() limit $5`,
  [region, kind, dmin, dmax, n])).rows;
const play = (rows, wrong = 0) => JSON.stringify(rows.map((r, i) => ({ question_id: r.id, answer: i < wrong ? r.correct_answer + 1000 : r.correct_answer })));
const submit = (region, mode, payload) => asUser(s1, () => db.query(`select * from public.submit_round($1,$2,$3::jsonb)`, [region, mode, payload]));

// Castillo nivel 1 (race, 5 preguntas, dificultad 1 normal) -> pasa
let r = await submit('castillo', 'race', play(await pick('castillo', ['direct'], 1, 1, 5)));
assert(r.rows[0].completed && r.rows[0].stars === 3, 'castillo/race (normal, dif 1) se juega y guarda igual que antes');

// Castillo battle: con preguntas normales (dif 1-2) ahora se RECHAZA; con dif 4 se acepta
await rejects(async () => submit('castillo', 'battle', play(await pick('castillo', ['direct'], 1, 2, 5))), 'invalid_question', 'castillo/battle rechaza preguntas normales (ya no son de su nivel)');
r = await submit('castillo', 'battle', play(await pick('castillo', ['direct'], 4, 4, 5)));
assert(r.rows[0].completed && r.rows[0].correct_count === 5, 'castillo/battle acepta divisiones 3 cifras ÷ 1 (dif 4)');
await rejects(async () => submit('castillo', 'bridge', play(await pick('castillo', ['direct'], 4, 4, 6))), 'invalid_question', 'castillo/bridge rechaza preguntas del nivel 4 (cada nivel su tanda)');
r = await submit('castillo', 'bridge', play(await pick('castillo', ['direct'], 5, 5, 6)));
assert(r.rows[0].completed, 'castillo/bridge acepta 3 cifras ÷ 2 (dif 5)');
r = await submit('castillo', 'shop', play(await pick('castillo', ['direct'], 6, 6, 6)));
assert(r.rows[0].completed, 'castillo/shop acepta 4 cifras ÷ 2 (dif 6)');

// Otras regiones: comportamiento intacto
r = await submit('bosque', 'race', play(await pick('bosque', ['direct'], 1, 1, 5)));
assert(r.rows[0].completed, 'bosque/race sin cambios');
await rejects(async () => submit('bosque', 'battle', play(await pick('castillo', ['direct'], 4, 4, 5))), 'invalid_question', 'bosque/battle rechaza preguntas de otra región');
r = await submit('bosque', 'battle', play(await pick('bosque', ['direct'], 1, 2, 5)));
assert(r.rows[0].completed, 'bosque/battle sigue usando el rango del modo (1-2)');

// Anti-trampa de siempre: duplicados
const dup = await pick('bosque', ['direct'], 2, 2, 1);
await rejects(async () => submit('bosque', 'bridge', JSON.stringify([...Array(2)].map(() => ({ question_id: dup[0].id, answer: dup[0].correct_answer })))), 'duplicate_question', 'sigue rechazando preguntas repetidas');

// Panel docente: el desglose por dificultad incluye 4-6 sin reventar
await asUser(teacher, async () => {
  const d = await db.query(`select * from public.get_student_difficulty_breakdown($1)`, [s1]);
  assert(d.rows.some((x) => x.region_id === 'castillo' && x.difficulty === 6), 'get_student_difficulty_breakdown reporta la dificultad 6 del castillo');
});

// Rollback
await db.exec(readFileSync('supabase/rollbacks/0012_division_long_levels.down.sql', 'utf8'));
const left = (await db.query(`select count(*)::int n from public.questions where difficulty >= 4`)).rows[0].n;
const cols = (await db.query(`select count(*)::int n from information_schema.columns where table_name='region_games' and column_name='difficulty_min'`)).rows[0].n;
assert(left === 0 && cols === 0, 'el rollback 0012 elimina preguntas 4-6 y las columnas nuevas');
const back = (await db.query(`select region_id, difficulty, kind, count(*)::int n from public.questions group by 1,2,3 order by 1,2,3`)).rows;
assert(JSON.stringify(back) === JSON.stringify(before), 'tras el rollback el banco queda como antes de la 0012');
console.log('\nTODAS LAS PRUEBAS DE 0012 PASARON');
