interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

/**
 * Convierte errores de Supabase (Auth, PostgREST y nuestras funciones SQL)
 * en mensajes claros en español. Nunca muestra texto técnico al usuario.
 */
export function friendlyError(err: unknown): string {
  const e = (err ?? {}) as ErrorLike;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const code = typeof e.code === 'string' ? e.code.toLowerCase() : '';
  const status = typeof e.status === 'number' ? e.status : 0;

  // Límites de velocidad (p. ej., muchos niños entrando a la vez)
  if (
    status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    msg.includes('rate limit')
  ) {
    return 'Hay muchas personas entrando a la vez. Espera unos segundos e inténtalo otra vez.';
  }

  // Errores de nuestras funciones SQL
  if (msg.includes('invalid_course_code')) return 'Ese código de curso no existe. Pídele el código a tu profe.';
  if (msg.includes('invalid_access_code')) return 'El código de docentes no es correcto.';
  if (msg.includes('signup_closed')) return 'El registro de docentes está cerrado por ahora. Habla con el administrador.';
  if (msg.includes('invalid_name')) return 'Escribe tu nombre completo.';
  if (msg.includes('anonymous_only')) return 'Cierra tu sesión de docente para entrar como estudiante.';
  if (msg.includes('anonymous_not_allowed')) return 'Los estudiantes no pueden crear cuentas de docente.';

  // Supabase Auth
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'Ya existe una cuenta con ese correo. Prueba entrando con tu contraseña.';
  }
  if (code === 'weak_password') return 'Esa contraseña es muy fácil de adivinar. Prueba con otra más larga.';
  if (code === 'email_address_invalid') return 'Ese correo no parece válido.';
  if (code === 'email_not_confirmed') return 'Tu correo todavía no está confirmado.';
  if (code === 'anonymous_provider_disabled') return 'El ingreso de estudiantes todavía no está activado.';
  if (code === 'signup_disabled') return 'Los registros nuevos están desactivados.';

  // Red
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return 'No pudimos conectar. Revisa tu internet e inténtalo otra vez.';
  }

  return 'Algo salió mal. Inténtalo de nuevo.';
}
