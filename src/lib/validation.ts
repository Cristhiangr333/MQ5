export const COURSE_CODE_LENGTH = 5;
export const MIN_PASSWORD_LENGTH = 8;

/** Mayúsculas, solo letras y números, máximo 5 caracteres. */
export function normalizeCourseCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, COURSE_CODE_LENGTH);
}

/** Recorta y colapsa espacios repetidos. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export type FieldErrors = Record<string, string>;

export function validateStudentForm(input: {
  code: string;
  firstName: string;
  lastName: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (normalizeCourseCode(input.code).length !== COURSE_CODE_LENGTH) {
    errors.code = `El código del curso tiene ${COURSE_CODE_LENGTH} letras o números.`;
  }
  const first = cleanName(input.firstName);
  if (first.length === 0) errors.firstName = 'Escribe tu nombre.';
  else if (first.length > 50) errors.firstName = 'Tu nombre es demasiado largo.';
  const last = cleanName(input.lastName);
  if (last.length === 0) errors.lastName = 'Escribe tu apellido.';
  else if (last.length > 50) errors.lastName = 'Tu apellido es demasiado largo.';
  return errors;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateTeacherForm(
  input: { fullName?: string; email?: string; password?: string; accessCode?: string },
  fields: Array<'fullName' | 'email' | 'password' | 'accessCode'>,
): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.includes('fullName')) {
    const n = cleanName(input.fullName ?? '');
    if (n.length < 2) errors.fullName = 'Escribe tu nombre completo.';
    else if (n.length > 100) errors.fullName = 'El nombre es demasiado largo.';
  }
  if (fields.includes('email') && !EMAIL_RE.test((input.email ?? '').trim())) {
    errors.email = 'Escribe un correo válido.';
  }
  if (fields.includes('password') && (input.password ?? '').length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (fields.includes('accessCode') && (input.accessCode ?? '').trim().length === 0) {
    errors.accessCode = 'Escribe el código de docentes.';
  }
  return errors;
}
