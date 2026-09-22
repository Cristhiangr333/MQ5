import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { cleanName, validateTeacherForm } from '../lib/validation';
import type { FieldErrors } from '../lib/validation';
import { Button, Card, ErrorBanner, Field, FullScreenError, FullScreenLoader, Screen } from '../components/ui';

type Mode = 'login' | 'signup';

export default function TeacherAccess() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'error') return <FullScreenError message={auth.error} onRetry={auth.refresh} />;
  if (auth.role === 'teacher') return <Navigate to="/docente/panel" replace />;

  // Cuenta creada pero sin código válido todavía: solo falta completar el registro.
  const needsCode = Boolean(auth.session) && !auth.isAnonymous && auth.role === 'none';

  async function becomeTeacher() {
    const { error } = await supabase.rpc('become_teacher', {
      p_full_name: cleanName(fullName),
      p_access_code: accessCode.trim(),
    });
    if (error) throw error;
    await auth.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fields = needsCode
      ? (['fullName', 'accessCode'] as const)
      : mode === 'signup'
        ? (['fullName', 'email', 'password', 'accessCode'] as const)
        : (['email', 'password'] as const);
    const found = validateTeacherForm({ fullName, email, password, accessCode }, [...fields]);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      if (needsCode) {
        await becomeTeacher();
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // AuthProvider detecta la sesión y esta pantalla redirige sola según el rol.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: cleanName(fullName) } },
        });
        if (error) throw error;
        if (!data.session) {
          setFormError('Revisa tu correo para confirmar la cuenta y luego vuelve a entrar.');
          return;
        }
        try {
          await becomeTeacher();
        } catch (err) {
          // La cuenta ya existe: se queda con sesión y verá el paso "completar registro".
          setFormError(friendlyError(err));
        }
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const title = needsCode ? 'Completa tu registro' : mode === 'login' ? 'Entrar como docente' : 'Crear cuenta de docente';

  return (
    <Screen>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white mb-4 min-h-10">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
      </Link>
      <Card>
        <div className="text-center mb-5">
          <p className="text-4xl mb-2" aria-hidden="true">📚</p>
          <h1 className="text-2xl font-extrabold font-['Baloo_2']">{title}</h1>
          {needsCode && (
            <p className="text-slate-300 text-sm mt-1">Tu cuenta ya existe. Solo falta tu nombre y el código de docentes.</p>
          )}
        </div>

        {!needsCode && (
          <div role="tablist" aria-label="Acceso de docentes" className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl bg-slate-950/60">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setErrors({});
                  setFormError(null);
                }}
                className={`min-h-11 rounded-lg text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  mode === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {(needsCode || mode === 'signup') && (
            <Field label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} autoComplete="name" maxLength={100} />
          )}
          {!needsCode && (
            <>
              <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" inputMode="email" />
              <Field
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                hint={mode === 'signup' ? 'Mínimo 8 caracteres.' : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </>
          )}
          {(needsCode || mode === 'signup') && (
            <Field
              label="Código de docentes"
              hint="Te lo dio la persona que administra MathQuest en tu institución."
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              error={errors.accessCode}
              autoComplete="off"
              spellCheck={false}
            />
          )}

          <ErrorBanner message={formError} />

          <Button type="submit" busy={busy} className="w-full">
            {needsCode ? 'Terminar registro' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}
          </Button>
          {needsCode && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => void auth.signOut()}>
              Usar otra cuenta
            </Button>
          )}
        </form>
      </Card>
    </Screen>
  );
}
