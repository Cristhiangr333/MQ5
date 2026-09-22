import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from './AuthProvider';
import { FullScreenError, FullScreenLoader } from '../components/ui';
import type { Role } from '../lib/types';

/** Deja pasar solo a quien tiene el rol indicado; el resto vuelve al inicio. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'error') return <FullScreenError message={auth.error} onRetry={auth.refresh} />;
  if (auth.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
