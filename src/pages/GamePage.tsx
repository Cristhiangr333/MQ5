import App from '../App';
import { useAuth } from '../auth/AuthProvider';

/** El juego para el estudiante que ya entró con el código de su curso. */
export default function GamePage() {
  const { student, signOut } = useAuth();

  function handleExit() {
    const ok = window.confirm(
      '¿Quieres cambiar de estudiante? Para volver a jugar tendrás que escribir de nuevo el código de tu curso.',
    );
    if (ok) void signOut();
  }

  return <App playerName={student?.first_name} courseName={student?.course_name} onExit={handleExit} />;
}
