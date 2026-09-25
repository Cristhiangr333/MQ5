# MathQuest 5

Juego educativo 3D de matemáticas para estudiantes de **3.º grado**. El estudiante explora un mundo dividido en 4 regiones (una por operación) y supera retos en 5 tipos de juego para desbloquear nuevas regiones. El docente consulta el desempeño por curso.

### Producto objetivo (ver `docs/DECISIONS.md`)

| Región | Competencia |
|---|---|
| Bosque de la Suma | Suma |
| Montaña de la Resta | Resta |
| Ciudad de la Multiplicación | Multiplicación |
| Castillo de la División | División |

Juegos: Carrera Matemática, Batalla Matemática, Tienda Matemática, Construye el Puente, Detective Matemático.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Three.js · Supabase · Vercel

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa con tu URL y clave anon de Supabase
npm run dev      # http://localhost:3000
npm run lint     # comprobación de tipos (tsc --noEmit)
npm run test     # pruebas automáticas (componentes + lógica)
npm run build    # build de producción en dist/
```

Sin `.env.local` la app muestra una pantalla de "falta configurar la conexión" en vez de fallar en blanco.

## Rutas

| Ruta | Quién entra |
|---|---|
| `/` | Cualquiera — elige "Soy estudiante" o "Soy docente" |
| `/estudiante` | Estudiante: código de curso, nombre y apellido |
| `/jugar` | Estudiante ya registrado (el juego; carga Three.js bajo demanda) |
| `/docente` | Docente: entrar o crear cuenta con el código de la institución |
| `/docente/panel` | Docente ya registrado: sus cursos, códigos y estudiantes |

## Estado

Estudiantes con código de curso, docentes con cuenta propia. El juego usa el modelo real: **4 regiones (Bosque=Suma, Montaña=Resta, Ciudad=Multiplicación, Castillo=División) × 5 niveles cada una** (Carrera → Batalla → Puente → Tienda → Detective, con desbloqueo secuencial), preguntas leídas del banco real de Supabase, y el progreso (estrellas, XP, desbloqueo) se guarda de verdad con `submit_round()`. El panel docente ya muestra el progreso real por estudiante (XP, niveles pasados, última vez que jugó, detalle de los 20 niveles). El motor 3D es la vista principal — soporta arrastre táctil, se recupera solo si el navegador le quita memoria de GPU, y baja de calidad automáticamente en celulares de gama baja. Ver `docs/DECISIONS.md` (ADR-001 a ADR-007).

Ruta de trabajo: Foundation → Core Experience → Game Systems → Progression → Teacher Dashboard → Polish → QA → Production.
