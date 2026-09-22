import { Card, Screen } from '../components/ui';

/** Se muestra si faltan las variables de entorno de Supabase (error de despliegue). */
export default function ConfigMissing() {
  return (
    <Screen>
      <Card className="space-y-3">
        <p className="text-3xl" aria-hidden="true">🔧</p>
        <h1 className="text-xl font-extrabold font-['Baloo_2']">Falta configurar la conexión</h1>
        <p className="text-slate-300 text-sm">
          La app no encontró las variables <code className="text-emerald-300">VITE_SUPABASE_URL</code> y{' '}
          <code className="text-emerald-300">VITE_SUPABASE_ANON_KEY</code>. Agrégalas en el hosting (o en{' '}
          <code className="text-emerald-300">.env.local</code>) y vuelve a desplegar.
        </p>
      </Card>
    </Screen>
  );
}
