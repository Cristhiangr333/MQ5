import { vi } from 'vitest';

interface AuthResult {
  data: unknown;
  error: { message: string; code?: string; status?: number } | null;
}

/**
 * Doble de @supabase/supabase-js para pruebas de componentes: sin red,
 * con un guion controlable de sesión, rpc() y consultas encadenadas.
 */
export function createMockSupabase() {
  const listeners: Array<(event: string, session: unknown) => void> = [];
  let session: unknown = null;

  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInAnonymously: vi.fn(async (): Promise<AuthResult> => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async (): Promise<AuthResult> => ({ data: {}, error: null })),
    signUp: vi.fn(async (): Promise<AuthResult & { data: { session: unknown } }> => ({
      data: { session: null },
      error: null,
    })),
    signOut: vi.fn(async (): Promise<{ error: null }> => {
      session = null;
      listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    }),
  };

  const rpc = vi.fn(async (_fn: string, _params?: Record<string, unknown>): Promise<AuthResult> => ({
    data: null,
    error: null,
  }));

  function from(_table?: string) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.single = vi.fn(async () => ({ data: null, error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return builder;
  }

  return {
    client: { auth, rpc, from: vi.fn(from) },
    setSession: (next: unknown) => {
      session = next;
      listeners.forEach((cb) => cb(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    },
  };
}
