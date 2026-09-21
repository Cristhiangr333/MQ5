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

Prototipo importado de Google AI Studio (5 mundos, contenido de 3.º grado) en proceso de convertirse en producto. Sin persistencia ni autenticación todavía; la Fase 1 (Supabase) está en curso. Ver `supabase/README.md`.

Ruta de trabajo: Foundation → Core Experience → Game Systems → Progression → Teacher Dashboard → Polish → QA → Production.
