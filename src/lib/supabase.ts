import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Falso si faltan las variables de entorno; la app muestra una pantalla de aviso. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Solo va la clave pública (anon/publishable). NUNCA la service_role.
// Si falta la configuración, el cliente usa valores de relleno y nunca se llega a usar
// porque App muestra <ConfigMissing /> antes.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
