import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router';
import { createMockSupabase } from './mockSupabase';

// user-event no viene instalado por defecto con RTL; si falta, las pruebas que lo usan
// se saltan explícitamente más abajo comprobando su presencia.

let mock: ReturnType<typeof createMockSupabase>;

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.client;
  },
  isSupabaseConfigured: true,
}));

async function importFresh() {
  vi.resetModules();
  const [{ AuthProvider }, { RequireRole }, LandingMod, StudentEntryMod, TeacherAccessMod, TeacherPanelMod] =
    await Promise.all([
      import('../auth/AuthProvider'),
      import('../auth/RequireRole'),
      import('../pages/Landing'),
      import('../pages/StudentEntry'),
      import('../pages/TeacherAccess'),
      import('../pages/TeacherPanel'),
    ]);
  return {
    AuthProvider,
    RequireRole,
    Landing: LandingMod.default,
    StudentEntry: StudentEntryMod.default,
    TeacherAccess: TeacherAccessMod.default,
    TeacherPanel: TeacherPanelMod.default,
  };
}

function Harness({
  mods,
  initialPath = '/',
}: {
  mods: Awaited<ReturnType<typeof importFresh>>;
  initialPath?: string;
}) {
  const { AuthProvider, RequireRole, Landing, StudentEntry, TeacherAccess, TeacherPanel } = mods;
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/estudiante" element={<StudentEntry />} />
          <Route path="/jugar" element={<RequireRole role="student"><div>PANTALLA DE JUEGO</div></RequireRole>} />
          <Route path="/docente" element={<TeacherAccess />} />
          <Route
            path="/docente/panel"
            element={
              <RequireRole role="teacher">
                <TeacherPanel />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mock = createMockSupabase();
});

describe('Landing', () => {
  test('sin sesión: muestra las dos opciones', async () => {
    const mods = await importFresh();
    render(<Harness mods={mods} />);
    expect(await screen.findByText('Soy estudiante')).toBeInTheDocument();
    expect(screen.getByText('Soy docente')).toBeInTheDocument();
  });

  test('con sesión de estudiante: redirige a /jugar', async () => {
    mock.setSession({ user: { id: 's1', is_anonymous: true } });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'student', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} />);
    expect(await screen.findByText('PANTALLA DE JUEGO')).toBeInTheDocument();
  });

  test('con sesión de docente: redirige al panel', async () => {
    mock.setSession({ user: { id: 't1', is_anonymous: false } });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'teacher', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} />);
    await waitFor(() => expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument());
    expect(await screen.findByText(/Tus cursos y estudiantes/)).toBeInTheDocument();
  });

  test('error al leer el rol: muestra pantalla de error con reintentar', async () => {
    mock.setSession({ user: { id: 't1', is_anonymous: false } });
    mock.client.rpc.mockImplementation(async () => ({ data: null, error: { message: 'boom' } }));
    const mods = await importFresh();
    render(<Harness mods={mods} />);
    expect(await screen.findByText('No pudimos cargar tus datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('StudentEntry', () => {
  test('valida los campos antes de enviar', async () => {
    const user = userEvent.setup();
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/estudiante" />);
    await user.click(await screen.findByRole('button', { name: /Entrar a jugar/i }));
    expect(await screen.findByText(/código del curso tiene 5/i)).toBeInTheDocument();
    expect(screen.getByText('Escribe tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu apellido.')).toBeInTheDocument();
    expect(mock.client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  test('código inválido: no crea sesión y muestra error del servidor', async () => {
    const user = userEvent.setup();
    mock.client.rpc.mockImplementation(async () => ({ data: null, error: { message: 'invalid_course_code' } }));
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/estudiante" />);
    await user.type(await screen.findByLabelText('Código de tu curso'), 'ZZZZZ');
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Apellido'), 'López');
    await user.click(screen.getByRole('button', { name: /Entrar a jugar/i }));
    expect(await screen.findByText(/Ese código de curso no existe/)).toBeInTheDocument();
  });

  test('registro correcto: crea sesión anónima y llega al juego', async () => {
    const user = userEvent.setup();
    mock.client.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'register_student') return { data: [{}], error: null };
      if (fn === 'get_my_role') return { data: 'student', error: null };
      if (fn === 'get_my_student')
        return { data: [{ student_id: '1', first_name: 'Ana', last_name: 'López', course_id: 'c1', course_name: '3-A' }], error: null };
      return { data: null, error: null };
    });
    mock.client.auth.signInAnonymously.mockImplementation(async () => {
      mock.setSession({ user: { id: 's1', is_anonymous: true } });
      return { data: {}, error: null };
    });
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/estudiante" />);
    await user.type(await screen.findByLabelText('Código de tu curso'), 'ab3xk');
    await user.type(screen.getByLabelText('Nombre'), '  Ana ');
    await user.type(screen.getByLabelText('Apellido'), 'López');
    await user.click(screen.getByRole('button', { name: /Entrar a jugar/i }));
    expect(await screen.findByText('PANTALLA DE JUEGO')).toBeInTheDocument();
    expect(mock.client.rpc).toHaveBeenCalledWith(
      'register_student',
      expect.objectContaining({ p_join_code: 'AB3XK', p_first_name: 'Ana', p_last_name: 'López' }),
    );
  });

  test('sesión de docente activa: pide cerrarla antes de jugar', async () => {
    mock.setSession({ user: { id: 't1', is_anonymous: false } });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'teacher', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/estudiante" />);
    expect(await screen.findByText(/sesión de docente abierta/i)).toBeInTheDocument();
  });
});

describe('TeacherAccess', () => {
  test('login: credenciales incorrectas muestra error en español', async () => {
    const user = userEvent.setup();
    mock.client.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/docente" />);
    await user.type(await screen.findByLabelText('Correo'), 'doc@escuela.com');
    await user.type(screen.getByLabelText('Contraseña'), 'algosecreto');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  });

  test('crear cuenta: valida el código de docentes como obligatorio', async () => {
    const user = userEvent.setup();
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/docente" />);
    await user.click(await screen.findByRole('tab', { name: 'Crear cuenta' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Cristhian Gómez');
    await user.type(screen.getByLabelText('Correo'), 'doc@escuela.com');
    await user.type(screen.getByLabelText('Contraseña'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    expect(await screen.findByText('Escribe el código de docentes.')).toBeInTheDocument();
    expect(mock.client.auth.signUp).not.toHaveBeenCalled();
  });

  test('crear cuenta con código correcto: registra y llega al panel', async () => {
    const user = userEvent.setup();
    mock.client.auth.signUp.mockImplementation(async () => {
      mock.setSession({ user: { id: 't1', is_anonymous: false } });
      return { data: { session: {} }, error: null };
    });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'teacher', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/docente" />);
    await user.click(await screen.findByRole('tab', { name: 'Crear cuenta' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Cristhian Gómez');
    await user.type(screen.getByLabelText('Correo'), 'doc@escuela.com');
    await user.type(screen.getByLabelText('Contraseña'), '12345678');
    await user.type(screen.getByLabelText('Código de docentes'), 'MQ5-Docentes-26');
    await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(mock.client.rpc).toHaveBeenCalledWith('become_teacher', expect.anything()));
    expect(await screen.findByText(/Tus cursos y estudiantes/)).toBeInTheDocument();
  });
});

describe('TeacherPanel', () => {
  test('sin cursos: muestra el estado vacío', async () => {
    mock.setSession({ user: { id: 't1', is_anonymous: false } });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'teacher', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/docente/panel" />);
    expect(await screen.findByText('Todavía no tienes cursos.')).toBeInTheDocument();
  });

  test('crear curso: falla del servidor se muestra sin romper la pantalla', async () => {
    const user = userEvent.setup();
    mock.setSession({ user: { id: 't1', is_anonymous: false } });
    mock.client.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_role' ? { data: 'teacher', error: null } : { data: [], error: null },
    );
    const mods = await importFresh();
    render(<Harness mods={mods} initialPath="/docente/panel" />);
    await screen.findByText('Todavía no tienes cursos.');

    mock.client.from.mockClear();
    const insertBuilder = mock.client.from('courses');
    (insertBuilder.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: { message: 'network fail' },
    });
    mock.client.from.mockReturnValue(insertBuilder);

    await user.type(screen.getByLabelText('Nombre del curso'), '3-A');
    await user.click(screen.getByRole('button', { name: /Crear curso/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/conectar|Algo salió mal/);
  });
});
