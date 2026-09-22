import { Link, Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { FullScreenError, FullScreenLoader, Screen } from '../components/ui';

export default function Landing() {
  const auth = useAuth();
  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'error') return <FullScreenError message={auth.error} onRetry={auth.refresh} />;
  if (auth.role === 'teacher') return <Navigate to="/docente/panel" replace />;
  if (auth.role === 'student') return <Navigate to="/jugar" replace />;

  return (
    <Screen>
      <div className="text-center mb-8">
        <p className="text-5xl mb-3" aria-hidden="true">🧭</p>
        <h1 className="text-4xl font-extrabold font-['Baloo_2'] tracking-tight">MathQuest 5</h1>
        <p className="text-slate-300 mt-2">Explora el mundo de los números</p>
      </div>

      <nav aria-label="¿Quién eres?" className="space-y-4">
        <Link
          to="/estudiante"
          className="block rounded-3xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition p-5 text-slate-950 shadow-lg shadow-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
        >
          <span className="text-3xl" aria-hidden="true">🎮</span>
          <span className="block text-xl font-extrabold font-['Baloo_2'] mt-1">Soy estudiante</span>
          <span className="block text-sm font-semibold opacity-80">Entra con el código de tu curso y ¡a jugar!</span>
        </Link>

        <Link
          to="/docente"
          className="block rounded-3xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 active:scale-[0.98] transition p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <span className="text-3xl" aria-hidden="true">📚</span>
          <span className="block text-xl font-extrabold font-['Baloo_2'] mt-1">Soy docente</span>
          <span className="block text-sm text-slate-300">Crea tus cursos y mira cómo avanza tu grupo.</span>
        </Link>
      </nav>
    </Screen>
  );
}
