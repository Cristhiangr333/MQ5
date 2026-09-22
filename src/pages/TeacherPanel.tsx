import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy, LogOut, Plus, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { cleanName } from '../lib/validation';
import type { CourseRow, StudentRow } from '../lib/types';
import { Button, Card, ErrorBanner, Field, FullScreenError, FullScreenLoader, Screen } from '../components/ui';

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

  if (state.status === 'loading') return <FullScreenLoader />;
  if (state.status === 'error') return <FullScreenError message={state.message} onRetry={load} />;

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

      {courses.length === 0 ? (
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
            {courses.map((course) => {
              const list = students.filter((s) => s.course_id === course.id);
              return (
                <li key={course.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold font-['Baloo_2']">{course.name}</h3>
                        <p className="text-sm text-slate-300 inline-flex items-center gap-1.5 mt-1">
                          <Users className="w-4 h-4" aria-hidden="true" />
                          {list.length === 1 ? '1 estudiante' : `${list.length} estudiantes`}
                        </p>
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
                      </div>
                    </div>

                    <details className="mt-4 group">
                      <summary className="cursor-pointer min-h-10 inline-flex items-center text-sm font-bold text-slate-300 hover:text-white">
                        Ver estudiantes
                      </summary>
                      {list.length === 0 ? (
                        <p className="text-sm text-slate-400 mt-2">Aún no hay estudiantes. Comparte el código para que se unan.</p>
                      ) : (
                        <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          {list.map((s) => (
                            <li key={s.id} className="py-1 border-b border-slate-800">
                              {s.first_name} {s.last_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Screen>
  );
}
