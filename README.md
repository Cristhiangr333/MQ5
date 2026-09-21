# MathQuest 5

Juego educativo 3D de matemáticas para estudiantes de 5.º grado (9–11 años). El estudiante explora un archipiélago de 5 mundos y supera retos para desbloquear nuevas regiones.

| Mundo | Juego | Competencia |
|---|---|---|
| Bosque de la Suma | Carrera Matemática | Cálculo mental ágil |
| Montaña de la Resta | Batalla Matemática | Sustracción |
| Ciudad de la Multiplicación | Tienda Matemática | Multiplicación en contexto |
| Río de la División | Construye el Puente | División y reparto |
| Castillo del Saber | Detective Matemático | Razonamiento y fracciones |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Three.js · (Fase 1) Supabase · Vercel

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # comprobación de tipos (tsc --noEmit)
npm run build    # build de producción en dist/
```

Variables de entorno: copia `.env.example` a `.env.local` cuando se conecte Supabase.

## Estado

Prototipo importado de Google AI Studio, en proceso de convertirse en producto. Sin persistencia ni autenticación todavía.

Ruta de trabajo: Foundation → Core Experience → Game Systems → Progression → Teacher Dashboard → Polish → QA → Production.
