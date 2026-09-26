import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, ArchiveRestore, Check, Copy, Flame, LogOut, Pencil, Plus, RefreshCw, Star, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { cleanName } from '../lib/validation';
import { fetchCourseProgress } from '../lib/teacherProgress';
import type { CourseRow, StudentProgressSummary, StudentRow } from '../lib/types';
import { Button, Card, ErrorBanner, Field, FullScreenError, FullScreenLoader, Screen, Spinner } from '../components/ui';
import { StudentDetailModal } from '../components/StudentDetailModal';

/** "hace 2 días", "hoy", "Nunca ha jugado" a partir de un timestamp o null. */
function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca ha jugado';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'Jugó hoy';
  if (days === 1) return 'Jugó ayer';
  if (days < 30) return `Jugó hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Jugó hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export default function TeacherPanel() {
  const auth = useAuth();
  const userId = auth.session?.user.id;

  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; message: string | null }>({
    status: 'loading',
    message: null,
  });
  const [teacherName, setTeacherName] = useState('');
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [progressByCourse, setProgressByCourse] = useState<
    Record<string, { status: 'loading' | 'ready' | 'error'; rows: StudentProgressSummary[]; message?: string }>
  >({});
  const [openStudent, setOpenStudent] = useState<{ id: string; name: string } | null>(null);

  // Edición en línea de curso (renombrar / archivar) y de estudiante (renombrar / quitar)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [courseRowBusy, setCourseRowBusy] = useState<string | null>(null);
  const [courseRowError, setCourseRowError] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [confirmDeleteStudentId, setConfirmDeleteStudentId] = useState<string | null>(null);
  const [studentRowBusy, setStudentRowBusy] = useState<string | null>(null);
  const [studentRowError, setStudentRowError] = useState<Record<string, string>>({});

  type SortKey = 'name' | 'least_progress' | 'inactive';
  const [sortByCourse, setSortByCourse] = useState<Record<string, SortKey>>({});

  const loadCourseProgress = useCallback(async (courseId: string, force = false) => {
    setProgressByCourse((prev) => {
      if (prev[courseId] && !force) return prev; // ya cargado (y no se pidió forzar): no repetir la consulta
      return { ...prev, [courseId]: { status: 'loading', rows: prev[courseId]?.rows ?? [] } };
    });
    try {
      const rows = await fetchCourseProgress(courseId);
      setProgressByCourse((prev) => ({ ...prev, [courseId]: { status: 'ready', rows } }));
    } catch (err) {
      setProgressByCourse((prev) => ({
        ...prev,
        [courseId]: { status: 'error', rows: [], message: friendlyError(err) },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading', message: null });
    const [c, s, t] = await Promise.all([
      supabase.from('courses').select('id,name,join_code,is_active,created_at').order('created_at', { ascending: false }),
      supabase.from('students').select('id,first_name,last_name,course_id,created_at').order('first_name'),
      supabase.from('teachers').select('full_name').maybeSingle(),
    ]);
    const failure = c.error ?? s.error ?? t.error;
    if (failure) {
      setState({ status: 'error', message: friendlyError(failure) });
      return;
    }
    setCourses((c.data as CourseRow[]) ?? []);
    setStudents((s.data as StudentRow[]) ?? []);
    setTeacherName((t.data as { full_name: string } | null)?.full_name ?? '');
    setState({ status: 'ready', message: null });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const name = cleanName(newName);
    if (name.length === 0) return setNameError('Escribe el nombre del curso, por ejemplo 3-A.');
    if (name.length > 50) return setNameError('El nombre es demasiado largo.');
    setNameError(undefined);
    if (!userId) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('courses')
      .insert({ teacher_id: userId, name })
      .select('id,name,join_code,is_active,created_at')
      .single();
    setCreating(false);
    if (error) return setCreateError(friendlyError(error));
    setCourses((prev) => [data as CourseRow, ...prev]);
    setNewName('');
  }

  async function copyCode(course: CourseRow) {
    try {
      await navigator.clipboard.writeText(course.join_code);
      setCopiedId(course.id);
      window.setTimeout(() => setCopiedId((id) => (id === course.id ? null : id)), 2000);
    } catch {
      // Sin permiso de portapapeles: el código sigue visible para copiarlo a mano.
    }
  }

  function startEditCourse(course: CourseRow) {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setCourseRowError((prev) => ({ ...prev, [course.id]: '' }));
  }

  async function saveCourseName(course: CourseRow) {
    const name = cleanName(editCourseName);
    if (name.length === 0) return setCourseRowError((prev) => ({ ...prev, [course.id]: 'Escribe el nombre del curso.' }));
    if (name.length > 50) return setCourseRowError((prev) => ({ ...prev, [course.id]: 'El nombre es demasiado largo.' }));
    if (name === course.name) return setEditingCourseId(null);

    setCourseRowBusy(course.id);
    const { error } = await supabase.from('courses').update({ name }).eq('id', course.id);
    setCourseRowBusy(null);
    if (error) return setCourseRowError((prev) => ({ ...prev, [course.id]: friendlyError(error) }));
    setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, name } : c)));
    setEditingCourseId(null);
  }

  async function toggleCourseActive(course: CourseRow) {
    setCourseRowBusy(course.id);
    const { error } = await supabase.from('courses').update({ is_active: !course.is_active }).eq('id', course.id);
    setCourseRowBusy(null);
    if (error) return setCourseRowError((prev) => ({ ...prev, [course.id]: friendlyError(error) }));
    setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, is_active: !c.is_active } : c)));
  }

  function startEditStudent(s: StudentRow) {
    setEditingStudentId(s.id);
    setEditFirstName(s.first_name);
    setEditLastName(s.last_name);
    setStudentRowError((prev) => ({ ...prev, [s.id]: '' }));
  }

  async function saveStudentName(s: StudentRow) {
    const first = cleanName(editFirstName);
    const last = cleanName(editLastName);
    if (first.length === 0 || last.length === 0) {
      return setStudentRowError((prev) => ({ ...prev, [s.id]: 'Nombre y apellido no pueden quedar vacíos.' }));
    }
    if (first === s.first_name && last === s.last_name) return setEditingStudentId(null);

    setStudentRowBusy(s.id);
    const { error } = await supabase.from('students').update({ first_name: first, last_name: last }).eq('id', s.id);
    setStudentRowBusy(null);
    if (error) return setStudentRowError((prev) => ({ ...prev, [s.id]: friendlyError(error) }));
    setStudents((prev) => prev.map((row) => (row.id === s.id ? { ...row, first_name: first, last_name: last } : row)));
    setEditingStudentId(null);
  }

  async function deleteStudent(s: StudentRow) {
    setStudentRowBusy(s.id);
    const { error } = await supabase.from('students').delete().eq('id', s.id);
    setStudentRowBusy(null);
    if (error) return setStudentRowError((prev) => ({ ...prev, [s.id]: friendlyError(error) }));
    setStudents((prev) => prev.filter((row) => row.id !== s.id));
    setConfirmDeleteStudentId(null);
  }

  /** Nunca jugó, o no juega hace 14+ días: una señal simple para resaltar en la lista. */
  function needsAttention(progress: StudentProgressSummary | undefined): boolean {
    if (!progress) return false;
    if (progress.rounds_played === 0) return true;
    if (!progress.last_played_at) return true;
    const days = (Date.now() - new Date(progress.last_played_at).getTime()) / 86_400_000;
    return days >= 14;
  }

  /** Ordena la lista de un curso según lo elegido: alfabético (por defecto),
   * quién va más atrás primero, o quién lleva más tiempo sin jugar primero.
   * Los que todavía no tienen datos de progreso siempre quedan al final. */
  function sortStudents(courseId: string, list: StudentRow[]): StudentRow[] {
    const sortKey = sortByCourse[courseId] ?? 'name';
    if (sortKey === 'name') return list;
    const rows = progressByCourse[courseId]?.rows ?? [];
    const progressOf = (s: StudentRow) => rows.find((r) => r.student_id === s.id);
    return [...list].sort((a, b) => {
      const pa = progressOf(a);
      const pb = progressOf(b);
      if (!pa && !pb) return 0;
      if (!pa) return 1; // sin datos: al final
      if (!pb) return -1;
      if (sortKey === 'least_progress') return pa.levels_passed - pb.levels_passed;
      // 'inactive': nunca jugó primero, luego de más antiguo a más reciente
      const ta = pa.last_played_at ? new Date(pa.last_played_at).getTime() : -Infinity;
      const tb = pb.last_played_at ? new Date(pb.last_played_at).getTime() : -Infinity;
      return ta - tb;
    });
  }

  if (state.status === 'loading') return <FullScreenLoader />;
  if (state.status === 'error') return <FullScreenError message={state.message} onRetry={load} />;

  const activeCourses = courses.filter((c) => c.is_active);
  const archivedCourses = courses.filter((c) => !c.is_active);

  return (
    <Screen wide>
      <header className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold font-['Baloo_2'] truncate">
            Hola{teacherName ? `, ${teacherName}` : ''} 👋
          </h1>
          <p className="text-slate-300 text-sm">Tus cursos y estudiantes</p>
        </div>
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </Button>
      </header>

      <Card className="mb-6">
        <h2 className="font-extrabold text-lg font-['Baloo_2'] mb-3">Crear un curso</h2>
        <form onSubmit={onCreate} noValidate className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1">
            <Field label="Nombre del curso" placeholder="Ej.: 3-A" value={newName} onChange={(e) => setNewName(e.target.value)} error={nameError} maxLength={50} autoComplete="off" />
          </div>
          <Button type="submit" busy={creating} className="sm:mt-[1.85rem]">
            <Plus className="w-5 h-5" aria-hidden="true" /> Crear curso
          </Button>
        </form>
        <div className="mt-3"><ErrorBanner message={createError} /></div>
      </Card>

      {activeCourses.length === 0 && archivedCourses.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-4xl mb-2" aria-hidden="true">🏫</p>
          <p className="font-extrabold">Todavía no tienes cursos.</p>
          <p className="text-slate-300 text-sm mt-1">Crea el primero y comparte su código con tus estudiantes.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-300 mb-3">
            Tus estudiantes entran en <span className="font-mono text-emerald-300">{window.location.origin}/estudiante</span> y escriben el código de su curso.
          </p>
          <ul className="space-y-4">
            {activeCourses.map((course) => {
              const list = students.filter((s) => s.course_id === course.id);
              return (
                <li key={course.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {editingCourseId === course.id ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              autoFocus
                              value={editCourseName}
                              onChange={(e) => setEditCourseName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveCourseName(course);
                                if (e.key === 'Escape') setEditingCourseId(null);
                              }}
                              maxLength={50}
                              className="text-xl font-extrabold font-['Baloo_2'] bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 w-full text-white"
                            />
                            <button
                              onClick={() => void saveCourseName(course)}
                              disabled={courseRowBusy === course.id}
                              className="p-1.5 text-emerald-300 hover:text-emerald-200 shrink-0"
                              aria-label="Guardar nombre"
                            >
                              {courseRowBusy === course.id ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setEditingCourseId(null)} className="p-1.5 text-slate-400 hover:text-white shrink-0" aria-label="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/name">
                            <h3 className="text-xl font-extrabold font-['Baloo_2'] truncate">{course.name}</h3>
                            <button
                              onClick={() => startEditCourse(course)}
                              className="p-1 text-slate-500 hover:text-white opacity-60 group-hover/name:opacity-100 transition-opacity shrink-0"
                              aria-label={`Renombrar ${course.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <p className="text-sm text-slate-300 inline-flex items-center gap-1.5 mt-1">
                          <Users className="w-4 h-4" aria-hidden="true" />
                          {list.length === 1 ? '1 estudiante' : `${list.length} estudiantes`}
                        </p>
                        {courseRowError[course.id] && <p className="text-xs text-red-400 mt-1">{courseRowError[course.id]}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Código del curso</p>
                          <p className="text-3xl font-mono font-extrabold tracking-[0.25em] text-emerald-300">{course.join_code}</p>
                        </div>
                        <Button variant="secondary" onClick={() => void copyCode(course)} aria-label={`Copiar el código de ${course.name}`}>
                          {copiedId === course.id ? <Check className="w-5 h-5 text-emerald-300" aria-hidden="true" /> : <Copy className="w-5 h-5" aria-hidden="true" />}
                          <span aria-live="polite">{copiedId === course.id ? '¡Copiado!' : 'Copiar'}</span>
                        </Button>
                        <button
                          onClick={() => void toggleCourseActive(course)}
                          disabled={courseRowBusy === course.id}
                          className="p-2 text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Archivar (se puede reactivar después; no borra a nadie)"
                          aria-label={`Archivar ${course.name}`}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <details
                      className="mt-4 group"
                      onToggle={(e) => {
                        if ((e.target as HTMLDetailsElement).open) void loadCourseProgress(course.id);
                      }}
                    >
                      <summary className="cursor-pointer min-h-10 inline-flex items-center text-sm font-bold text-slate-300 hover:text-white">
                        Ver estudiantes y su progreso
                      </summary>
                      {progressByCourse[course.id] && progressByCourse[course.id].status !== 'loading' && list.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <button
                            onClick={() => void loadCourseProgress(course.id, true)}
                            disabled={progressByCourse[course.id]?.status === 'loading'}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
                          >
                            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                            Actualizar progreso
                          </button>
                          <label className="text-xs text-slate-400 flex items-center gap-1.5">
                            Ordenar por
                            <select
                              value={sortByCourse[course.id] ?? 'name'}
                              onChange={(e) =>
                                setSortByCourse((prev) => ({ ...prev, [course.id]: e.target.value as SortKey }))
                              }
                              className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-slate-100 text-xs"
                            >
                              <option value="name">Nombre (A-Z)</option>
                              <option value="least_progress">Quién va más atrás</option>
                              <option value="inactive">Quién lleva más tiempo sin jugar</option>
                            </select>
                          </label>
                        </div>
                      )}
                      {list.length === 0 ? (
                        <p className="text-sm text-slate-400 mt-2">Aún no hay estudiantes. Comparte el código para que se unan.</p>
                      ) : progressByCourse[course.id]?.status === 'loading' || !progressByCourse[course.id] ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-3 py-2">
                          <Spinner className="w-4 h-4" /> Cargando el progreso de cada estudiante...
                        </div>
                      ) : progressByCourse[course.id]?.status === 'error' ? (
                        <div className="mt-3">
                          <ErrorBanner message={progressByCourse[course.id]?.message ?? null} />
                          <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {list.map((s) => (
                              <li key={s.id} className="py-1 border-b border-slate-800">
                                {s.first_name} {s.last_name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <ul className="mt-2 divide-y divide-slate-800">
                          {sortStudents(course.id, list).map((s) => {
                            const progress = progressByCourse[course.id]?.rows.find((r) => r.student_id === s.id);
                            const isEditing = editingStudentId === s.id;
                            const isConfirmingDelete = confirmDeleteStudentId === s.id;
                            return (
                              <li key={s.id} className="py-2.5">
                                {isConfirmingDelete ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2 -mx-1">
                                    <p className="text-xs text-red-200">
                                      ¿Borrar a <strong>{s.first_name} {s.last_name}</strong>? Se pierde para siempre
                                      {progress ? ` su progreso (${progress.total_xp} XP, ${progress.levels_passed}/20 niveles)` : ' todo su progreso'}.
                                      No se puede deshacer.
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => void deleteStudent(s)}
                                        disabled={studentRowBusy === s.id}
                                        className="text-xs font-bold bg-red-700 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                                      >
                                        {studentRowBusy === s.id ? <Spinner className="w-3.5 h-3.5" /> : null}
                                        Sí, borrar
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteStudentId(null)}
                                        className="text-xs font-bold text-slate-300 hover:text-white px-2 py-1.5"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          autoFocus
                                          value={editFirstName}
                                          onChange={(e) => setEditFirstName(e.target.value)}
                                          placeholder="Nombre"
                                          maxLength={50}
                                          className="text-sm font-bold bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 w-24 text-white"
                                        />
                                        <input
                                          value={editLastName}
                                          onChange={(e) => setEditLastName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') void saveStudentName(s);
                                            if (e.key === 'Escape') setEditingStudentId(null);
                                          }}
                                          placeholder="Apellido"
                                          maxLength={50}
                                          className="text-sm font-bold bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 w-24 text-white"
                                        />
                                        <button onClick={() => void saveStudentName(s)} disabled={studentRowBusy === s.id} className="p-1.5 text-emerald-300 hover:text-emerald-200" aria-label="Guardar">
                                          {studentRowBusy === s.id ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => setEditingStudentId(null)} className="p-1.5 text-slate-400 hover:text-white" aria-label="Cancelar">
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 group/student">
                                        <span className="text-sm font-bold text-slate-100">
                                          {s.first_name} {s.last_name}
                                        </span>
                                        {needsAttention(progress) && (
                                          <span title="Nunca ha jugado o lleva 14+ días sin jugar" aria-label="Necesita atención">
                                            ⚠️
                                          </span>
                                        )}
                                        <button
                                          onClick={() => startEditStudent(s)}
                                          className="p-1 text-slate-500 hover:text-white opacity-60 group-hover/student:opacity-100 transition-opacity"
                                          aria-label={`Renombrar a ${s.first_name} ${s.last_name}`}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setConfirmDeleteStudentId(s.id)}
                                          className="p-1 text-slate-500 hover:text-red-400 opacity-60 group-hover/student:opacity-100 transition-opacity"
                                          aria-label={`Quitar a ${s.first_name} ${s.last_name} del curso`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}

                                    {progress ? (
                                      <button
                                        onClick={() => setOpenStudent({ id: s.id, name: `${s.first_name} ${s.last_name}` })}
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 hover:text-white rounded-lg px-2 py-1 -mx-2 hover:bg-slate-800/70 transition-colors text-left"
                                      >
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                                          <Flame className="w-3.5 h-3.5" aria-hidden="true" /> {progress.total_xp} XP
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          <Star className="w-3.5 h-3.5 text-blue-300" aria-hidden="true" />
                                          {progress.levels_passed}/20 niveles
                                        </span>
                                        <span className="hidden sm:inline text-slate-400">{timeAgo(progress.last_played_at)}</span>
                                        <span className="text-emerald-300 underline">Ver detalle</span>
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-500">Sin datos</span>
                                    )}
                                  </div>
                                )}
                                {studentRowError[s.id] && <p className="text-xs text-red-400 mt-1">{studentRowError[s.id]}</p>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </details>
                  </Card>
                </li>
              );
            })}
          </ul>

          {archivedCourses.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-sm font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5"
              >
                {showArchived ? 'Ocultar' : 'Ver'} cursos archivados ({archivedCourses.length})
              </button>
              {showArchived && (
                <ul className="space-y-2 mt-3">
                  {archivedCourses.map((course) => {
                    const list = students.filter((s) => s.course_id === course.id);
                    return (
                      <li key={course.id}>
                        <Card className="opacity-70">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-base font-extrabold font-['Baloo_2']">{course.name}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {list.length === 1 ? '1 estudiante' : `${list.length} estudiantes`} · archivado
                              </p>
                              {courseRowError[course.id] && <p className="text-xs text-red-400 mt-1">{courseRowError[course.id]}</p>}
                            </div>
                            <button
                              onClick={() => void toggleCourseActive(course)}
                              disabled={courseRowBusy === course.id}
                              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-slate-800/70 hover:bg-slate-700 rounded-lg px-3 py-2 flex items-center gap-1.5"
                            >
                              {courseRowBusy === course.id ? <Spinner className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                              Reactivar
                            </button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {openStudent && (
        <StudentDetailModal
          studentId={openStudent.id}
          studentName={openStudent.name}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </Screen>
  );
}
