import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from './errors.ts';
import {
  normalizeCourseCode,
  cleanName,
  validateStudentForm,
  validateTeacherForm,
} from './validation.ts';
import {
  buildCourseCsv,
  csvCell,
  csvFileName,
  hasLowAccuracy,
  needsAttention,
  sortStudents,
  summarizeCourse,
  timeAgo,
} from './teacherPanelUtils.ts';
import type { StudentProgressSummary, StudentRow } from './types.ts';

test('normalizeCourseCode: mayúsculas, sin símbolos, máx. 5', () => {
  assert.equal(normalizeCourseCode('ab-c d2'), 'ABCD2');
  assert.equal(normalizeCourseCode('abcdefgh'), 'ABCDE');
  assert.equal(normalizeCourseCode('  x y '), 'XY');
  assert.equal(normalizeCourseCode(''), '');
});

test('cleanName: recorta y colapsa espacios', () => {
  assert.equal(cleanName('  Ana   María '), 'Ana María');
});

test('validateStudentForm: caso válido y casos inválidos', () => {
  assert.deepEqual(validateStudentForm({ code: 'ab3xk', firstName: 'Ana', lastName: 'López' }), {});
  const bad = validateStudentForm({ code: 'AB', firstName: '  ', lastName: 'x'.repeat(51) });
  assert.deepEqual(Object.keys(bad).sort(), ['code', 'firstName', 'lastName']);
});

test('validateTeacherForm: valida solo los campos pedidos', () => {
  assert.deepEqual(validateTeacherForm({ email: 'a@b.co', password: '12345678' }, ['email', 'password']), {});
  const e = validateTeacherForm({ email: 'mal', password: '123' }, ['email', 'password', 'accessCode']);
  assert.deepEqual(Object.keys(e).sort(), ['accessCode', 'email', 'password']);
  assert.deepEqual(validateTeacherForm({}, ['email']), { email: 'Escribe un correo válido.' });
});

test('friendlyError: mensajes de nuestras funciones SQL', () => {
  assert.match(friendlyError({ message: 'invalid_course_code' }), /código de curso/);
  assert.match(friendlyError({ message: 'invalid_access_code' }), /código de docentes/);
  assert.match(friendlyError({ message: 'signup_closed' }), /cerrado/);
  assert.match(friendlyError({ message: 'anonymous_only' }), /sesión de docente/);
});

test('friendlyError: errores de Auth y límites', () => {
  assert.match(friendlyError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), /incorrectos/);
  assert.match(friendlyError({ code: 'user_already_exists' }), /Ya existe/);
  assert.match(friendlyError({ status: 429, message: 'x' }), /muchas personas/);
  assert.match(friendlyError({ code: 'over_request_rate_limit' }), /muchas personas/);
  assert.match(friendlyError({ code: 'anonymous_provider_disabled' }), /no está activado|todavía no/);
});

test('friendlyError: red, desconocidos y valores raros', () => {
  assert.match(friendlyError(new TypeError('Failed to fetch')), /conectar/);
  assert.equal(friendlyError(null), 'Algo salió mal. Inténtalo de nuevo.');
  assert.equal(friendlyError('texto'), 'Algo salió mal. Inténtalo de nuevo.');
  assert.doesNotMatch(friendlyError({ message: 'duplicate key value violates unique constraint' }), /duplicate|constraint/);
});

// ---------------------------------------------------------------------
// Panel docente: lógica pura (teacherPanelUtils)
// ---------------------------------------------------------------------

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function student(id: string, first: string, last = 'X'): StudentRow {
  return { id, first_name: first, last_name: last, course_id: 'c1', created_at: ago(30) };
}

function prog(id: string, over: Partial<StudentProgressSummary> = {}): StudentProgressSummary {
  return {
    student_id: id, first_name: 'N', last_name: 'A', total_xp: 100, regions_unlocked: 2,
    levels_passed: 5, rounds_played: 6, overall_accuracy: 80, last_played_at: ago(1), ...over,
  };
}

test('csvCell: escapa comillas, comas y saltos de línea', () => {
  assert.equal(csvCell('Ana'), 'Ana');
  assert.equal(csvCell('López, Ana'), '"López, Ana"');
  assert.equal(csvCell('di "hola"'), '"di ""hola"""');
  assert.equal(csvCell('a\nb'), '"a\nb"');
});

test('csvCell: neutraliza fórmulas en texto (= + - @) pero no toca números', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","clic")'), '"\'=HYPERLINK(""http://x"",""clic"")"');
  assert.equal(csvCell('+1+1'), "'+1+1");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(-5), '-5'); // número real: sin apóstrofo
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell('Ana-María'), 'Ana-María'); // el guion en medio es normal
});

test('buildCourseCsv: una fila por estudiante, ordenados por nombre, con y sin datos', () => {
  const csv = buildCourseCsv(
    [student('s2', 'Beto', 'Ruiz'), student('s1', 'Ana', 'López'), student('s3', '=cmd', 'Mal')],
    [prog('s1', { total_xp: 120, levels_passed: 7, rounds_played: 9, overall_accuracy: 85, last_played_at: null })],
    20,
  );
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Nombre,Apellido,XP total,Regiones desbloqueadas,Niveles pasados (de 20),Precisión (%),Rondas jugadas,Última vez que jugó');
  assert.equal(lines.length, 4);
  assert.equal(lines[1], "'=cmd,Mal,0,0,0,,0,Nunca ha jugado"); // "=" < "A": va primero; fórmula neutralizada
  assert.equal(lines[2], 'Ana,López,120,2,7,85,9,Nunca ha jugado');
  assert.equal(lines[3], 'Beto,Ruiz,0,0,0,,0,Nunca ha jugado');
});

test('csvFileName: sin caracteres peligrosos', () => {
  assert.equal(csvFileName('3-A'), '3_A_progreso.csv');
  assert.equal(csvFileName('Quinto Ñandú/B'), 'Quinto_Ñandú_B_progreso.csv');
});

test('timeAgo: hoy, ayer, días, meses y nunca', () => {
  assert.equal(timeAgo(null, NOW), 'Nunca ha jugado');
  assert.equal(timeAgo(ago(0), NOW), 'Jugó hoy');
  assert.equal(timeAgo(ago(1), NOW), 'Jugó ayer');
  assert.equal(timeAgo(ago(5), NOW), 'Jugó hace 5 días');
  assert.equal(timeAgo(ago(30), NOW), 'Jugó hace 1 mes');
  assert.equal(timeAgo(ago(65), NOW), 'Jugó hace 2 meses');
});

test('needsAttention: nunca jugó o 14+ días sin jugar', () => {
  assert.equal(needsAttention(undefined, NOW), false); // sin datos: no se afirma nada
  assert.equal(needsAttention(prog('a', { rounds_played: 0, last_played_at: null }), NOW), true);
  assert.equal(needsAttention(prog('a', { last_played_at: null }), NOW), true);
  assert.equal(needsAttention(prog('a', { last_played_at: ago(13) }), NOW), false);
  assert.equal(needsAttention(prog('a', { last_played_at: ago(14) }), NOW), true);
});

test('hasLowAccuracy: solo con muestra suficiente y menos de 50%', () => {
  assert.equal(hasLowAccuracy(undefined), false);
  assert.equal(hasLowAccuracy(prog('a', { overall_accuracy: null, rounds_played: 0 })), false);
  assert.equal(hasLowAccuracy(prog('a', { overall_accuracy: 20, rounds_played: 1 })), false); // 1 ronda: azar
  assert.equal(hasLowAccuracy(prog('a', { overall_accuracy: 49, rounds_played: 2 })), true);
  assert.equal(hasLowAccuracy(prog('a', { overall_accuracy: 50, rounds_played: 5 })), false);
});

test('sortStudents: por nombre no cambia; atrás primero; inactivos primero; sin datos al final', () => {
  const list = [student('a', 'Ana'), student('b', 'Beto'), student('c', 'Carla'), student('d', 'Dani')];
  const rows = [
    prog('a', { levels_passed: 9, last_played_at: ago(0) }),
    prog('b', { levels_passed: 2, last_played_at: ago(20) }),
    prog('c', { levels_passed: 2, total_xp: 10, last_played_at: null, rounds_played: 0 }),
    // 'd' sin fila de progreso
  ];
  const ids = (l: StudentRow[]) => l.map((s) => s.id).join('');
  assert.equal(ids(sortStudents(list, rows, 'name')), 'abcd');
  // atrás primero: c (2 niveles, 10 XP) antes que b (2 niveles, 100 XP); luego a; d al final
  assert.equal(ids(sortStudents(list, rows, 'least_progress')), 'cbad');
  // inactivos: nunca jugó (c), luego el más antiguo (b), luego a; d al final
  assert.equal(ids(sortStudents(list, rows, 'inactive')), 'cbad');
  // no muta la lista original
  assert.equal(ids(list), 'abcd');
});

test('sortStudents: dos que nunca jugaron no producen un orden inestable (NaN)', () => {
  const list = [student('a', 'Ana'), student('b', 'Beto')];
  const rows = [
    prog('a', { last_played_at: null, rounds_played: 0 }),
    prog('b', { last_played_at: null, rounds_played: 0 }),
  ];
  assert.deepEqual(sortStudents(list, rows, 'inactive').map((s) => s.id), ['a', 'b']);
});

test('summarizeCourse: promedio, inactivos y baja precisión', () => {
  const list = [student('a', 'Ana'), student('b', 'Beto'), student('c', 'Carla'), student('d', 'Dani')];
  const rows = [
    prog('a', { overall_accuracy: 90 }),
    prog('b', { overall_accuracy: 30, rounds_played: 4 }),
    prog('c', { rounds_played: 0, overall_accuracy: null, last_played_at: null }),
  ];
  const sum = summarizeCourse(list, rows, NOW);
  assert.deepEqual(sum, { students: 4, played: 2, avgAccuracy: 60, inactive: 1, lowAccuracy: 1 });
});

test('summarizeCourse: curso sin datos no inventa promedio', () => {
  assert.deepEqual(summarizeCourse([student('a', 'Ana')], [], NOW), {
    students: 1, played: 0, avgAccuracy: null, inactive: 0, lowAccuracy: 0,
  });
});
