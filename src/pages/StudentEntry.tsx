import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { cleanName, normalizeCourseCode, validateStudentForm } from '../lib/validation';
import type { FieldErrors } from '../lib/validation';
import { Button, Card, ErrorBanner, Field, FullScreenError, FullScreenLoader, Screen } from '../components/ui';

export default function StudentEntry() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'error') return <FullScreenError message={auth.error} onRetry={auth.refresh} />;
  if (auth.role === 'student') return <Navigate to="/jugar" replace />;

  // Un docente (o un registro a medias) tiene sesión con correo en este navegador.
  if (auth.session && !auth.isAnonymous) {
    return (
      <Screen>
        <Card className="space-y-4 text-center">
          <p className="text-3xl" aria-hidden="true">👩‍🏫</p>
          <h1 className="text-xl font-extrabold font-['Baloo_2']">Hay una sesión de docente abierta</h1>
          <p className="text-slate-300 text-sm">Para entrar como estudiante, primero cierra la sesión de docente.</p>
          <div className="flex flex-col gap-3">
            {auth.role === 'teacher' && (
              <Link to="/docente/panel" className="min-h-12 rounded-xl bg-slate-800 border border-slate-600 font-extrabold inline-flex items-center justify-center">
                Ir a mi panel
              </Link>
            )}
            <Button onClick={() => void auth.signOut()}>Cerrar sesión de docente</Button>
          </div>
        </Card>
      </Screen>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validateStudentForm({ code, firstName, lastName });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      // La sesión anónima se crea solo ahora (no al abrir la página): así los ingresos
      // de un salón se reparten en el tiempo y no chocan con el límite por IP.
      if (!auth.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const { error } = await supabase.rpc('register_student', {
        p_join_code: normalizeCourseCode(code),
        p_first_name: cleanName(firstName),
        p_last_name: cleanName(lastName),
      });
      if (error) throw error;
      await auth.refresh();
      navigate('/jugar', { replace: true });
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white mb-4 min-h-10">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
      </Link>
      <Card>
        <div className="text-center mb-6">
          <p className="text-4xl mb-2" aria-hidden="true">🎮</p>
          <h1 className="text-2xl font-extrabold font-['Baloo_2']">¡Vamos a jugar!</h1>
          <p className="text-slate-300 text-sm mt-1">Escribe tus datos para entrar a tu curso.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field
            label="Código de tu curso"
            hint="Te lo da tu profe. Son 5 letras o números."
            value={code}
            onChange={(e) => setCode(normalizeCourseCode(e.target.value))}
            error={errors.code}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={5}
            className="text-center text-2xl font-mono font-bold tracking-[0.35em] uppercase"
            placeholder="AB3XK"
          />
          <Field label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} autoComplete="off" maxLength={50} />
          <Field label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} autoComplete="off" maxLength={50} />

          <ErrorBanner message={formError} />

          <Button type="submit" busy={busy} className="w-full text-lg">
            {busy ? 'Entrando...' : '¡Entrar a jugar!'}
          </Button>
        </form>
      </Card>
    </Screen>
  );
}
