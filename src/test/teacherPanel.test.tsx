import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createMockSupabase } from './mockSupabase';

/**
 * Pruebas del panel docente con datos reales (el mock compartido solo devuelve
 * listas vacías). Cubren: lista de cursos/estudiantes, progreso, orden, exportar CSV,
 * renombrar/borrar estudiante, archivar y borrar cursos archivados.
 */

let mock: ReturnType<typeof createMockSupabase>;

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mock.client;
  },
  isSupabaseConfigured: true,
}));

interface Db {
  courses: Array<{ id: string; name: string; join_code: string; is_active: boolean; created_at: string }>;
  students: Array<{ id: string; first_name: string; last_name: string; course_id: string; created_at: string }>;
}

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function seedDb(): Db {
  return {
    courses: [
      { id: 'c1', name: '3-A', join_code: 'AB3XK', is_active: true, created_at: daysAgo(10) },
      { id: 'c2', name: '2-B', join_code: 'ZZ9QQ', is_active: false, created_at: daysAgo(40) },
    ],
    students: [
      { id: 's1', first_name: 'Ana', last_name: 'López', course_id: 'c1', created_at: daysAgo(9) },
      { id: 's2', first_name: 'Beto', last_name: 'Ruiz', course_id: 'c1', created_at: daysAgo(9) },
      { id: 's3', first_name: 'Carla', last_name: 'Mesa', course_id: 'c2', created_at: daysAgo(39) },
    ],
  };
}

const PROGRESS: Record<string, unknown[]> = {
  c1: [
    {
      student_id: 's1', first_name: 'Ana', last_name: 'López', total_xp: 120, regions_unlocked: 2,
      levels_passed: 7, rounds_played: 9, overall_accuracy: 85, last_played_at: daysAgo(0),
    },
    {
      student_id: 's2', first_name: 'Beto', last_name: 'Ruiz', total_xp: 0, regions_unlocked: 1,
      levels_passed: 0, rounds_played: 0, overall_accuracy: null, last_played_at: null,
    },
  ],
  c2: [
    {
      student_id: 's3', first_name: 'Carla', last_name: 'Mesa', total_xp: 340, regions_unlocked: 4,
      levels_passed: 12, rounds_played: 20, overall_accuracy: 70, last_played_at: daysAgo(3),
    },
  ],
};

/** Conecta el mock de Supabase con una "base" en memoria para las tablas que usa el panel. */
function wireSupabase(
  db: Db,
  opts: { progressError?: boolean; progress?: Record<string, unknown[]>; levelRows?: unknown[] } = {},
) {
  mock.setSession({ user: { id: 't1', is_anonymous: false } });
  mock.client.rpc.mockImplementation(async (fn: string, params?: Record<string, unknown>) => {
    if (fn === 'get_my_role') return { data: 'teacher', error: null };
    if (fn === 'get_course_progress_summary') {
      if (opts.progressError) return { data: null, error: { message: 'boom' } };
      return { data: (opts.progress ?? PROGRESS)[String(params?.p_course_id)] ?? [], error: null };
    }
    if (fn === 'get_student_level_detail') return { data: opts.levelRows ?? [], error: null };
    return { data: [], error: null };
  });

  const writes: Array<{ table: string; op: 'update' | 'delete'; values?: unknown; id: string }> = [];

  mock.client.from.mockImplementation(((table: string) => {
    const rows = (db as unknown as Record<string, unknown[]>)[table] ?? [];
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    let pending: { op: 'update' | 'delete'; values?: unknown } | null = null;
    builder.select = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.maybeSingle = vi.fn(async () => ({ data: table === 'teachers' ? { full_name: 'Marta' } : null, error: null }));
    builder.update = vi.fn((values: unknown) => {
      pending = { op: 'update', values };
      return builder;
    });
    builder.delete = vi.fn(() => {
      pending = { op: 'delete' };
      return builder;
    });
    builder.eq = vi.fn(async (_col: string, id: string) => {
      if (pending) writes.push({ table, op: pending.op, values: pending.values, id });
      return { data: null, error: null };
    });
    builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return builder;
  }) as never);

  return { writes };
}

async function renderPanel() {
  vi.resetModules();
  const [{ AuthProvider }, { RequireRole }, { default: TeacherPanel }] = await Promise.all([
    import('../auth/AuthProvider'),
    import('../auth/RequireRole'),
    import('../pages/TeacherPanel'),
  ]);
  render(
    <MemoryRouter initialEntries={['/docente/panel']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/docente/panel"
            element={
              <RequireRole role="teacher">
                <TeacherPanel />
              </RequireRole>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText(/Tus cursos y estudiantes/);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mock = createMockSupabase();
});

afterEach(() => {
  vi.useRealTimers();
});

/** jsdom no implementa Blob.text()/Response(blob): se lee con FileReader. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function openCourseDetails(user: ReturnType<typeof userEvent.setup>, label = /Ver estudiantes y su progreso/) {
  await user.click(await screen.findByText(label));
}

describe('TeacherPanel con datos', () => {
  test('lista el curso activo con su código y cantidad de estudiantes; el archivado queda oculto', async () => {
    wireSupabase(seedDb());
    await renderPanel();
    expect(screen.getByText('Hola, Marta 👋')).toBeInTheDocument();
    expect(screen.getByText('3-A')).toBeInTheDocument();
    expect(screen.getByText('AB3XK')).toBeInTheDocument();
    expect(screen.getByText('2 estudiantes')).toBeInTheDocument();
    expect(screen.queryByText('2-B')).not.toBeInTheDocument();
    expect(screen.getByText(/Ver cursos archivados \(1\)/)).toBeInTheDocument();
  });

  test('al abrir el curso muestra XP, niveles y % de aciertos; marca ⚠️ a quien nunca jugó', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb());
    await renderPanel();
    await openCourseDetails(user);

    expect(await screen.findByText(/120 XP/)).toBeInTheDocument();
    expect(screen.getByText(/7\/20 niveles/)).toBeInTheDocument();
    expect(screen.getByText('85% aciertos')).toBeInTheDocument();
    // Beto nunca jugó: lleva la advertencia; Ana no.
    expect(screen.getAllByLabelText('Necesita atención')).toHaveLength(1);
    expect(mock.client.rpc).toHaveBeenCalledWith('get_course_progress_summary', { p_course_id: 'c1' });
  });

  test('si falla el progreso: muestra el error y sigue listando los nombres', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { progressError: true });
    await renderPanel();
    await openCourseDetails(user);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Beto Ruiz')).toBeInTheDocument();
  });

  test('ordenar por "quién va más atrás" pone primero al de menos niveles', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb());
    await renderPanel();
    await openCourseDetails(user);
    await screen.findByText(/120 XP/);

    const namesInOrder = () => screen.getAllByText(/^(Ana López|Beto Ruiz)$/).map((n) => n.textContent);
    expect(namesInOrder()).toEqual(['Ana López', 'Beto Ruiz']);
    await user.selectOptions(screen.getByLabelText(/Ordenar por/), 'least_progress');
    expect(namesInOrder()).toEqual(['Beto Ruiz', 'Ana López']);
  });

  test('renombrar estudiante: guarda en Supabase y actualiza la lista', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    const { writes } = wireSupabase(seedDb());
    await renderPanel();
    await openCourseDetails(user);
    await screen.findByText(/120 XP/);

    await user.click(screen.getByLabelText('Renombrar a Ana López'));
    const first = screen.getByPlaceholderText('Nombre');
    await user.clear(first);
    await user.type(first, 'Anita');
    await user.click(screen.getByLabelText('Guardar'));

    await waitFor(() => expect(screen.getByText('Anita López')).toBeInTheDocument());
    expect(writes).toContainEqual({ table: 'students', op: 'update', values: { first_name: 'Anita', last_name: 'López' }, id: 's1' });
  });

  test('borrar estudiante: pide confirmación y recién entonces borra', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    const { writes } = wireSupabase(seedDb());
    await renderPanel();
    await openCourseDetails(user);
    await screen.findByText(/120 XP/);

    await user.click(screen.getByLabelText('Quitar a Ana López del curso'));
    expect(screen.getByText(/Se pierde para siempre/)).toBeInTheDocument();
    expect(writes.filter((w) => w.op === 'delete')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /Sí, borrar/ }));

    await waitFor(() => expect(screen.queryByText('Ana López')).not.toBeInTheDocument());
    expect(writes).toContainEqual({ table: 'students', op: 'delete', values: undefined, id: 's1' });
  });

  test('archivar un curso lo mueve a la sección de archivados', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    const { writes } = wireSupabase(seedDb());
    await renderPanel();
    await user.click(screen.getByLabelText('Archivar 3-A'));
    await waitFor(() => expect(screen.getByText(/Ver cursos archivados \(2\)/)).toBeInTheDocument());
    expect(writes).toContainEqual({ table: 'courses', op: 'update', values: { is_active: false }, id: 'c1' });
  });

  test('exportar CSV: trae el progreso de cada estudiante', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb());
    let captured: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => {
      captured = b;
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();
    await renderPanel();
    await openCourseDetails(user);
    await screen.findByText(/120 XP/);
    await user.click(screen.getByText('Exportar a Excel/CSV'));

    expect(captured).not.toBeNull();
    const text = await readBlob(captured as unknown as Blob);
    expect(text).toContain('Nombre,Apellido,XP total');
    expect(text).toContain('Ana,López,120,2,7,85,9,');
    expect(text).toContain('Beto,Ruiz,0,1,0,,0,Nunca ha jugado');
  });
});

describe('TeacherPanel · resumen del curso', () => {
  test('muestra cuántos juegan, el promedio de aciertos y quién necesita atención', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb());
    await renderPanel();
    await openCourseDetails(user);

    const strip = await screen.findByRole('group', { name: 'Resumen del curso' });
    expect(within(strip).getByText(/de 2 han jugado/)).toBeInTheDocument();
    expect(within(strip).getByText('85%')).toBeInTheDocument();
    expect(within(strip).getByText(/1 estudiante/)).toBeInTheDocument();
    expect(within(strip).getByText(/sin jugar o inactivo$/)).toBeInTheDocument();
  });

  test('marca con 📉 a quien juega pero acierta poco, y lo cuenta en el resumen', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    const progress = {
      c1: [
        { ...(PROGRESS.c1[0] as object), overall_accuracy: 85 },
        {
          student_id: 's2', first_name: 'Beto', last_name: 'Ruiz', total_xp: 30, regions_unlocked: 1,
          levels_passed: 1, rounds_played: 5, overall_accuracy: 32, last_played_at: daysAgo(1),
        },
      ],
    };
    wireSupabase(seedDb(), { progress });
    await renderPanel();
    await openCourseDetails(user);

    const strip = await screen.findByRole('group', { name: 'Resumen del curso' });
    expect(within(strip).getByText(/con pocos aciertos/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Pocos aciertos')).toHaveLength(1);
    // Ambos juegan hace poco: nadie queda marcado como inactivo.
    expect(screen.queryByLabelText('Necesita atención')).not.toBeInTheDocument();
  });

  test('si el progreso falla no se muestra un resumen inventado', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { progressError: true });
    await renderPanel();
    await openCourseDetails(user);
    await screen.findByRole('alert');
    expect(screen.queryByRole('group', { name: 'Resumen del curso' })).not.toBeInTheDocument();
  });
});

const REGION_IDS = ['bosque', 'montana', 'ciudad', 'castillo'];
const MODE_IDS = ['race', 'battle', 'bridge', 'shop', 'detective'];
const REQUIRED_XP: Record<string, number> = { bosque: 0, montana: 50, ciudad: 150, castillo: 300 };

/**
 * Detalle de Ana (60 XP): pasó la Carrera del Bosque. Con `withRegionCols` incluye las
 * columnas de la migración 0010 (Montaña abierta; Ciudad y Castillo cerradas por XP).
 */
function levelRowsForAna(withRegionCols: boolean) {
  const rows: Array<Record<string, unknown>> = [];
  REGION_IDS.forEach((region, ri) => {
    MODE_IDS.forEach((mode, mi) => {
      const playedHere = region === 'bosque' && mode === 'race';
      const row: Record<string, unknown> = {
        region_id: region, region_sort: ri + 1, game_mode_id: mode, level_sort: mi + 1,
        // Regla "de siempre": nivel 1 abierto; el 2 del Bosque abierto porque pasó el 1.
        unlocked: mi === 0 || (region === 'bosque' && mi === 1),
        best_stars: playedHere ? 3 : 0, rounds_played: playedHere ? 1 : 0,
        correct_count: playedHere ? 5 : 0, questions_total: playedHere ? 5 : 0,
      };
      if (withRegionCols) {
        row.region_unlocked = ri <= 1; // 60 XP: Bosque y Montaña sí; Ciudad y Castillo no
        row.region_required_xp = REQUIRED_XP[region];
      }
      rows.push(row);
    });
  });
  return rows;
}

describe('TeacherPanel · detalle del estudiante', () => {
  async function openAnaDetail(user: ReturnType<typeof userEvent.setup>) {
    await openCourseDetails(user);
    await user.click(await screen.findByText(/120 XP/));
    return screen.findByRole('dialog');
  }

  test('con la migración 0010: las regiones cerradas por XP se ven bloqueadas y dicen cuánto falta', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { levelRows: levelRowsForAna(true) });
    await renderPanel();
    const dialog = await openAnaDetail(user);

    expect(await within(dialog).findByText('Se abre con 150 XP')).toBeInTheDocument();
    expect(within(dialog).getByText('Se abre con 300 XP')).toBeInTheDocument();
    // La Montaña (abierta por XP) NO muestra candado de región.
    expect(within(dialog).queryByText('Se abre con 50 XP')).not.toBeInTheDocument();
    // Bosque: 3 bloqueados (niveles 3-5); Montaña: 4 (niveles 2-5); Ciudad y Castillo: 5 + 5.
    expect(within(dialog).getAllByText('Bloqueado')).toHaveLength(3 + 4 + 5 + 5);
  });

  test('sin la migración 0010 (campos ausentes): se comporta exactamente como antes', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { levelRows: levelRowsForAna(false) });
    await renderPanel();
    const dialog = await openAnaDetail(user);

    await within(dialog).findByText('Bosque de la Suma');
    expect(within(dialog).queryByText(/Se abre con/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Región bloqueada')).not.toBeInTheDocument();
    // Solo la regla vieja: Bosque 3 + Montaña 4 + Ciudad 4 + Castillo 4 bloqueados.
    expect(within(dialog).getAllByText('Bloqueado')).toHaveLength(3 + 4 + 4 + 4);
  });

  test('Escape cierra el detalle y el foco vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { levelRows: levelRowsForAna(true) });
    await renderPanel();
    await openCourseDetails(user);
    const opener = (await screen.findByText(/120 XP/)).closest('button') as HTMLButtonElement;
    await user.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Progreso de Ana López' });
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  test('Tab no saca el foco del detalle', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb(), { levelRows: levelRowsForAna(true) });
    await renderPanel();
    const dialog = await openAnaDetail(user);
    const close = within(dialog).getByRole('button', { name: 'Cerrar' });
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(close).toBeInTheDocument();
  });
});

describe('TeacherPanel · cursos archivados', () => {
  test('la confirmación de borrado muestra el XP real de los estudiantes (no 0)', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    wireSupabase(seedDb());
    await renderPanel();
    await user.click(screen.getByText(/Ver cursos archivados/));
    await user.click(await screen.findByLabelText('Borrar 2-B para siempre'));

    // Carla (curso archivado) tiene 340 XP. Antes de este arreglo decía "0 XP" porque
    // el progreso de los cursos archivados nunca se cargaba.
    expect(await screen.findByText(/340 XP en total/)).toBeInTheDocument();
  });
});

// Evita warnings de "within" sin uso si se reordenan pruebas.
void within;
