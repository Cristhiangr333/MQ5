import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from './errors.ts';
import {
  normalizeCourseCode,
  cleanName,
  validateStudentForm,
  validateTeacherForm,
} from './validation.ts';

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
