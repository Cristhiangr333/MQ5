# MathQuest 5 — Contexto para continuar en un chat nuevo

**Cómo usar este documento:** pégalo en el chat nuevo **junto con** el
"Documento de contexto" original (el Master Role de 50 secciones — identidad,
principios de producto, protocolo de trabajo). Ese documento sigue vigente tal
cual, no cambió nada de él. Este documento es un **apéndice con el estado real
del proyecto a hoy**, para que el chat nuevo no tenga que redescubrir nada.

Fecha de este snapshot: 1 de octubre de 2026.
Último commit en `main`: `b5de9ab`.
Repo: `https://github.com/Cristhiangr333/MQ5`.

---

## 1. Corrección importante sobre el stack

El Master Role original pide Next.js. **El proyecto real usa Vite + React +
TypeScript + Tailwind + Three.js**, no Next.js (ver ADR-001 en
`docs/DECISIONS.md`). Esto se decidió al principio del proyecto porque no hay
necesidad real de servidor propio — login, progreso y panel docente se
resuelven con Supabase + RLS — y es más simple de mantener. Si un chat nuevo
lee el Master Role primero, va a esperar Next.js: aclarar esto de entrada
evita que proponga una migración de framework que ya se decidió no hacer.

Infraestructura real: **GitHub + Supabase + Vercel** (esto sí coincide con el
Master Role).

## 2. Qué es MathQuest 5 hoy (producto real, no el concepto original)

- **4 regiones**, una por operación: Bosque de la Suma, Montaña de la Resta,
  Ciudad de la Multiplicación, Castillo de la División (no 5 "mundos" sueltos
  como en el prototipo original).
- **5 niveles por región**, mismo orden fijo y desbloqueo secuencial en las 4:
  1. Carrera Matemática → 2. Batalla Matemática → 3. Construye el Puente →
  4. Tienda Matemática → 5. Detective Matemático.
- Estudiantes: sin cuenta, sesión anónima de Supabase + código de curso del
  docente. Docentes: cuenta propia (correo/contraseña) con código de
  institución para registrarse.
- Preguntas, dificultad, tiempo, vidas y desbloqueo de región: todo real,
  calculado y validado en el servidor (Supabase), no inventado en el cliente.
- Motor principal: Three.js (mapa 3D navegable + 5 minijuegos), con un motor
  "ilustrado" (2D) de respaldo si WebGL falla.
- Panel docente: lista de estudiantes por curso con XP, niveles pasados, %
  de aciertos; detalle por estudiante con las 20 combinaciones región×nivel,
  precisión por dificultad, actividad reciente, y exportación a CSV.

El detalle completo de **por qué** cada una de estas decisiones se tomó así
(incluyendo las que se intentaron y se revirtieron) está en
`docs/DECISIONS.md` — 16 ADRs a la fecha. No hace falta leerlos todos para
seguir trabajando, pero **antes de tocar algo que suene ya resuelto, conviene
buscar ahí primero** — varias cosas que parecen bugs nuevos ya se
diagnosticaron y arreglaron una vez (ver sección 5).

## 3. Mapa rápido del código

```
src/
  App.tsx                 -- estado central del juego (session, progreso, navegación)
  pages/
    TeacherPanel.tsx       -- panel docente (lista de cursos/estudiantes, export CSV)
    TeacherAccess.tsx
  components/
    WorldViewport.tsx      -- decide motor 3D vs ilustrado, overlays (clima, desbloqueo)
    ThreeWorldCanvas.tsx   -- el motor 3D completo (~4600 líneas, Three.js puro)
    GalaxyUnlockOverlay.tsx-- celebración 2D al desbloquear región
    GameHUD.tsx, QuestionPanel.tsx, GameOverModal.tsx, PauseModal.tsx,
    GameModeTutorial.tsx, RegionLevelStrip.tsx, StudentDetailModal.tsx
  lib/
    game.ts                -- fetchQuestionsForLevel, submitRound, fetchProgress
    teacherProgress.ts      -- las 4 consultas RPC del panel docente
    supabase.ts, validation.ts, errors.ts
    lib.test.ts             -- pruebas de lógica pura (node --test, NO vitest)
  data/regionsData.ts       -- REGIONS y GAME_MODES (nombres, colores, posiciones 3D)
  utils/audio.ts            -- todos los sonidos (sintetizados con WebAudio, sin archivos)
supabase/
  migrations/0001 a 0011    -- el historial real de la base de datos (0010 y 0011 esperan ser aplicadas por el usuario)
  rollbacks/*.down.sql      -- cómo deshacer cada migración
docs/DECISIONS.md           -- los 20 ADRs, la fuente de verdad del "por qué"
```

`ThreeWorldCanvas.tsx` es, por lejos, el archivo más denso y más propenso a
bugs sutiles (efectos con dependencias de React que interactúan con un loop
de animación de `requestAnimationFrame` fuera de React). Casi todos los
bugs reales encontrados en esta sesión estaban ahí. Antes de tocarlo conviene
leer los ADR-012 a ADR-016 completos, no solo el resumen de abajo.

## 4. Rutina de verificación (seguirla siempre antes de hacer push)

```bash
npm run lint                                              # tsc --noEmit
npm run test                                               # vitest (componentes)
node --experimental-strip-types --test src/lib/lib.test.ts # lógica pura (NO corre con `npm run test`)
npm run build                                               # build de producción
```

Los cuatro deben pasar limpios. `lib.test.ts` es fácil de olvidar porque
`npm run test` (vitest) no lo incluye — hay que correrlo aparte como arriba.

## 5. Resumen condensado de lo arreglado/construido en esta sesión (ADRs completos en `docs/DECISIONS.md`)

- **ADR-012:** "Siguiente nivel" a veces mandaba al mapa por una carrera entre
  `submitRound` y `loadProgress`. Arreglado.
- **ADR-013:** borrado permanente de curso completo (solo desde archivados).
- **ADR-014 / ADR-015 / ADR-016:** la cadena completa del bug "confeti/cámara
  de victoria/personajes mal ubicados al entrar a un nivel por primera vez".
  Se arregló tres veces porque cada arreglo destapó un caso que el anterior no
  cubría — **si algo parecido vuelve a aparecer, leer los tres ADR enteros
  antes de volver a tocar esto**, el patrón general (reconstrucción de escena
  3D + estado de React que llega tarde o no se resetea) ya se entiende bien y
  es fácil repetir el mismo error de otra forma.
- Animación de victoria de Detective mejorada (barras del candado
  deslizándose, haz de luz dorado, salto triunfal).
- Celebración "Mario Galaxy" al desbloquear una región nueva (overlay 2D +
  FX 3D + detección real contra Supabase de qué región se acaba de
  desbloquear).
- Panel docente: precisión general, precisión por dificultad, actividad
  reciente, exportación CSV (migración `0009`).
- Caché en memoria de `game_modes` (una consulta menos por nivel desde el
  segundo nivel de la sesión).

## 6. ⚠️ Importante: hay (o hubo) otra sesión trabajando en paralelo sobre el mismo repo

Durante esta sesión aparecieron **tres veces** commits en `main` que esta
conversación no había hecho (ADR-010, ADR-011 los documentó esa otra sesión;
y los merges de confeti/snapshot en ADR-015/016 también vinieron de ahí). Los
merges fueron limpios hasta ahora, pero:

- **Antes de hacer push, siempre `git fetch` primero** y revisar si hay
  commits nuevos del remoto (`git log --oneline HEAD..FETCH_HEAD`). Si los
  hay, mezclar, correr la rutina de verificación completa de la sección 4
  de nuevo, y recién ahí hacer push.
- Si el usuario confirma que esa otra sesión ya no sigue activa, esta
  advertencia deja de aplicar — pero conviene preguntarle explícitamente en
  vez de asumirlo.

## 7. Pendientes y riesgos conocidos, dichos explícitamente (no ocultar)

- **Compromiso de seguridad aceptado a propósito (ADR-004/007/010):** la
  respuesta correcta de la ronda actual es visible en el cliente (para dar
  feedback instantáneo), y el banco completo de preguntas es legible por
  cualquier sesión autenticada. El usuario decidió explícitamente no
  arreglarlo (ADR-010) por ser un riesgo bajo para este contexto. **No
  reabrir esto sin que el usuario lo pida** — ya se intentó una vez, se
  rompió el despliegue por caché de esquema de PostgREST, y se revirtió todo.
- **El loop de juego ahora SÍ tiene prueba de integración** (`src/test/gameFlow.test.tsx`: responder, ganar/perder, guardar, refrescar, modal, celebración de isla), pero con el lienzo 3D simulado (jsdom no tiene WebGL). Lo que sigue sin cubrirse es el *aspecto* de las animaciones 3D: eso solo se ve en un navegador.
- **Regla de islas (ADR-018):** una isla se abre al COMPLETAR la anterior, no por XP. Migraciones 0010 y 0011 sin aplicar en producción; antes de la 0011 correr `supabase/checks/0011_impact_check.sql`.
- **Gran Final "universo completado" (ADR-020):** integrado desde el prototipo, sin marcas ajenas. Cinemática 3D y cámara pensadas para 5 islas del prototipo: falta verificar su encuadre en un navegador con las 4 regiones. `vitest` solo recoge `*.test.tsx` (un `.test.ts` se ignora en silencio).
- **Reset de visuales al rejugar (ADR-016/019):** "Jugar de nuevo" ahora fuerza una escena 3D nueva (`worldKey`). Antes dependía de un cargador de pantalla completa que desmontaba todo al terminar cada ronda (ya eliminado, ADR-019). Falta VERLO en un navegador.
- **Migración `0009` (panel docente) ya fue corrida por el usuario en su
  Supabase real** y confirmada funcionando. Cualquier migración nueva que se
  escriba de acá en adelante: **nunca se puede aplicar desde este entorno**
  (no hay acceso de red a Supabase) — siempre hay que dársela al usuario para
  que la pegue él mismo, y esperar su confirmación antes de asumir que ya
  existe en producción.

## 8. Cómo pedir el token de GitHub

El usuario ya ha compartido tokens de GitHub (`github_pat_...`) directamente
en el chat varias veces en esta sesión, para hacer `git push` a `main` sin
pasos intermedios. Si lo vuelve a ofrecer "para toda la sesión", está bien
seguir ese patrón — pero **nunca** guardarlo en el repo, en un archivo, ni en
`git remote` de forma persistente; usarlo solo inline en el comando de
`push`/`fetch` puntual, como se ha hecho hasta ahora.
