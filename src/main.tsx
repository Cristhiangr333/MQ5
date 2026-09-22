import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import { isSupabaseConfigured } from './lib/supabase';
import { FullScreenLoader } from './components/ui';
import Landing from './pages/Landing';
import StudentEntry from './pages/StudentEntry';
import TeacherAccess from './pages/TeacherAccess';
import TeacherPanel from './pages/TeacherPanel';
import ConfigMissing from './pages/ConfigMissing';
import './index.css';

// El juego (y Three.js) se descarga solo cuando el estudiante llega a /jugar.
const GamePage = lazy(() => import('./pages/GamePage'));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/estudiante" element={<StudentEntry />} />
      <Route
        path="/jugar"
        element={
          <RequireRole role="student">
            <Suspense fallback={<FullScreenLoader text="Preparando el mundo..." />}>
              <GamePage />
            </Suspense>
          </RequireRole>
        }
      />
      <Route path="/docente" element={<TeacherAccess />} />
      <Route
        path="/docente/panel"
        element={
          <RequireRole role="teacher">
            <TeacherPanel />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <ConfigMissing />
    )}
  </StrictMode>,
);
