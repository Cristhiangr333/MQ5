# Registro de decisiones

Cada decisión importante: qué cambió, por qué y qué impacto tiene.

## ADR-001 · Vite + React en lugar de Next.js
- **Qué:** el frontend se mantiene en Vite + React + TypeScript + Tailwind + Three.js.
- **Por qué:** prioridad del 3D, no hay necesidad real de servidor (login, progreso y panel docente se resuelven con Supabase + RLS) y es más simple de mantener.
- **Impacto:** rutas del lado del cliente (`react-router`), `vercel.json` con reescritura SPA, seguridad respaldada por RLS y no por el framework.
- **Revisar si:** hace falta lógica con claves secretas en servidor, páginas públicas con SEO o renderizado en servidor.

## ADR-002 · Acceso: estudiante anónimo + docente con login
- **Qué:** los estudiantes no crean cuenta; usan una sesión anónima de Supabase Auth y se registran con nombre, apellido y **código de curso**. Los docentes inician sesión con correo y contraseña y los crea el administrador.
- **Por qué:** sin identidad, RLS no puede garantizar que cada sesión solo acceda a sus datos. El informe pide no crear cuentas para niños; la sesión anónima lo cumple. Sin login docente, los datos de menores quedarían legibles para cualquiera con la URL.
- **Impacto:** el informe debe decir "sin registro de estudiantes, identificador anónimo" (no "sin Auth") y añadir el login docente. Hay que activar *Anonymous sign-ins* y subir su límite por IP (30/hora por defecto; un salón comparte IP).
- **Nota:** el código de curso evita que personas ajenas creen estudiantes falsos en un curso. El progreso queda ligado al navegador; recuperarlo en otro dispositivo es P2.

## ADR-003 · Producto: 3.º grado, 4 regiones × 5 juegos
- **Qué:** el producto objetivo es el del informe: 3.º grado, 4 regiones (Suma, Resta, Multiplicación, División) y 5 tipos de juego (Carrera, Batalla, Tienda, Puente, Detective).
- **Por qué:** el informe es el documento del producto. El prototipo tenía 5 islas con un juego cada una y contenido de fracciones fuera de 3.º.
- **Impacto:** el catálogo (`regions`, `game_modes`, `region_games`) permite decidir después qué juego va en cada región sin rehacer la base de datos. El prototipo actual (5 mundos) se adaptará en la Fase 2.

## ADR-004 · Banco de preguntas en la base de datos, validado en el servidor
- **Qué:** las preguntas son hechos aritméticos de 1 cifra (`a op b = r`) generados por SQL: 735 en total (245 hechos × 3 formatos: directa, número faltante en 1.ª o 2.ª posición). La configuración de cada juego (tiempo, vidas, preguntas por ronda) y de cada región (XP para desbloquear) también vive en la base de datos.
- **Por qué:** separa contenido de código; permite analizar por operandos ("¿qué tabla falla más?") y corregir sin desplegar. En la migración 0004 el servidor recalculará si cada respuesta es correcta y otorgará el XP; el cliente no puede declararlo.
- **Compromiso conocido:** el cliente recibe la respuesta correcta junto con la pregunta para dar feedback inmediato. Un estudiante decidido podría verla con las herramientas del navegador. El servidor ignora lo que el cliente afirme, así que no puede inflar XP ni resultados inventados, pero sí responder con la clave. Ocultarla exige un viaje al servidor por respuesta: queda como P2.
- **Impacto:** `generateQuestionsForWorld` (cliente, `Math.random`) será reemplazado por lectura del banco. Las secuencias numéricas del prototipo quedan fuera por ahora (P2).
- **Dificultad:** nivel 1 = resultado de 1 cifra (lo que hoy hace el prototipo). Niveles 2 y 3 (resultados mayores) están cargados pero el juego solo los usará si se decide. Con resultado de 1 cifra hay únicamente 6 multiplicaciones y 6 divisiones distintas.

## ADR-005 · Docentes se registran solos, con código de la institución
- **Qué:** el docente se registra con correo y contraseña y la app llama a `become_teacher(nombre, código)`, que lo convierte en docente solo si el código coincide con el configurado por el administrador. Si no hay código configurado, el registro está cerrado. Reemplaza la creación manual de docentes del ADR-002 (el resto del ADR-002 sigue vigente).
- **Por qué:** crear docentes a mano no escala. Registrarse no expone datos de nadie: por RLS cada docente solo ve sus propios cursos y estudiantes. El código evita que cualquiera se haga pasar por docente.
- **Impacto:**
  - Se desactiva *Confirm email* en Supabase: el servidor de correo gratuito solo entrega a miembros del equipo del proyecto y con un máximo de 2 mensajes por hora, así que la verificación por correo no funciona para docentes reales.
  - Sin verificación de correo, la barrera real es el código de institución: hay que elegir uno largo y no compartirlo con estudiantes.
  - No hay recuperación de contraseña por correo. Mientras tanto, el administrador la restablece desde Authentication → Users.
  - Mejoras futuras: iniciar sesión con Google (identidad verificada, sin correos) es P1; SMTP propio para recuperar contraseñas es P2.
- **Renumeración:** la migración de intentos y progreso pasa a ser la 0004.

## ADR-006 · Los 5 juegos como niveles progresivos, mismo orden en los 4 mundos
- **Qué:** dentro de cada mundo, los 5 juegos son niveles con un orden fijo — 1 Carrera, 2 Batalla, 3 Puente, 4 Tienda, 5 Detective — y se desbloquean en ese orden: hay que terminar el nivel N para jugar el N+1. La dificultad sube con el nivel en tres variables a la vez: segundos por pregunta, vidas y el rango de la columna `questions.difficulty` que se sirve (nuevas columnas `game_modes.difficulty_min/max`).
- **Por qué:** el prototipo original mezclaba parámetros sin ninguna lógica entre juegos (10, 12, 12, 15, 20 segundos sin relación con la dificultad real). Un orden fijo y una progresión consistente hace que las 4 regiones se sientan como el mismo tipo de experiencia, en vez de 20 pantallas sueltas.
- **Impacto:** se creó la migración `0004`, no se editó la `0002` porque esta ya se había ejecutado en producción — el historial de migraciones debe reflejar lo que realmente corrió, en el orden en que corrió.
- **Bug encontrado al probar:** la `0002` generó la Resta solo con minuendos de una cifra (2-9), así que toda quedó en `difficulty=1`. Con los rangos nuevos, los niveles 3 y 4 (dificultad 2 y 3) del mundo Resta se habrían quedado sin preguntas disponibles — el juego se habría visto en blanco. Se corrigió en la misma `0004`, ampliando el banco de Resta con minuendos de dos cifras (837 preguntas nuevas). El resto de las regiones ya tenía suficiente variedad en los 3 niveles de dificultad.
- **Progresión de cada nivel** (igual en los 4 mundos):

  | Nivel | Juego | Preguntas | Seg/pregunta | Vidas | Dificultad |
  |---|---|---|---|---|---|
  | 1 | Carrera | 5 | 12 | 3 | 1 |
  | 2 | Batalla | 5 | 11 | 3 | 1–2 |
  | 3 | Puente | 6 | 10 | 3 | 2 |
  | 4 | Tienda | 6 | 10 | 2 | 2–3 |
  | 5 | Detective | 5 | 15 | 2 | 1–2 (la dificultad real es el formato "número faltante", no hace falta sumar números más grandes) |

- **Pendiente:** el desbloqueo secuencial (nivel N+1 requiere completar N) y las estrellas por ronda se implementan en la migración de intentos y progreso, que pasa a ser la `0005`.

## ADR-007 · Intentos, estrellas y XP: todo calculado en el servidor
- **Qué:** una sola función, `submit_round(región, nivel, respuestas)`, es la única forma de registrar una ronda jugada. El cliente manda qué respondió a cada pregunta (no si acertó ni cuánto XP ganó); el servidor recalcula todo comparando contra `questions.correct_answer`.
- **Reglas:**
  - **Desbloqueo:** el nivel 1 de cada mundo siempre está abierto. Los niveles 2 a 5 requieren una ronda **completa** con **al menos 1 estrella** en el nivel anterior, del mismo estudiante, en la misma región.
  - **Estrellas** (decisión del profe, opción B): 3 si acertó el 100%, 2 si acertó el 70% o más, 1 si terminó la ronda con menos del 70%, 0 si no la terminó (se quedó sin vidas a mitad de camino — el servidor lo detecta porque llegan menos respuestas de las que pide `questions_per_round`).
  - **XP:** ronda completa = 10 por acierto, más un bono de 30/15/0 según las estrellas. Ronda incompleta = 5 por acierto, sin bono: se reconoce el esfuerzo sin premiar el abandono.
  - **Región:** se desbloquea cuando el XP acumulado del estudiante (en cualquier mundo) llega a `regions.required_xp`.
- **Validaciones anti-trampa** (probadas explícitamente, no solo asumidas): no se puede repetir una pregunta en la misma ronda, no se puede mandar más respuestas de las que pide el nivel, y cada pregunta debe pertenecer a la región y al rango de dificultad de ese nivel específico — así nadie puede "colar" una pregunta fácil de otro nivel para inflar su cuenta de aciertos.
- **Compromiso conocido (heredado del ADR-004):** el servidor no confía en lo que el cliente *afirme*, pero el cliente sigue *viendo* la respuesta correcta antes de contestar, porque así se puede dar feedback inmediato. Sigue como mejora P2.
- **Tablas nuevas:** `rounds` (una fila por ronda jugada, con sus estrellas y XP) y `attempts` (una fila por pregunta respondida dentro de esa ronda — es la materia prima para que el docente vea en qué falla cada estudiante).
- **No se guarda un "total de XP" aparte:** se sigue calculando sumando `rounds.xp_earned` cada vez (`get_my_total_xp`). Con el volumen de un salón de clase no hace falta una columna cacheada; si el proyecto creciera mucho, sería la primera optimización a considerar.

## ADR-008 · Auditoría de funcionalidad (no visual): tutorial, pausa, banco de preguntas
- **Qué:** tras terminar el trabajo de diseño/game feel (partículas, clima, confeti 3D), se pidió explícitamente revisar la *funcionalidad* del juego pensando en la experiencia real de un estudiante de 3º grado jugando solo. Se auditaron: onboarding, control del tiempo, y suficiencia del banco de preguntas.
- **Hallazgo 1 — sin explicación al entrar a un juego por primera vez:** violaba el principio de "cero confusión" del proyecto. Un estudiante que entraba por primera vez a Detective Matemático no tenía forma de saber, sin ayuda de un adulto, qué significa el formato "número faltante" — solo un subtítulo de una línea, con el cronómetro ya corriendo.
  - **Arreglo:** `GameModeTutorial.tsx`, modal de una pantalla por tipo de juego, se muestra una sola vez por dispositivo (localStorage, `mq5_tutorial_seen_v1`). El cronómetro no arranca (`isTimerActive: false`) hasta que se cierra el tutorial.
- **Hallazgo 2 — sin forma de pausar una ronda:** si al estudiante lo llamaban o se distraía, el cronómetro seguía corriendo y podía perder vidas sin haber jugado mal.
  - **Arreglo:** `PauseModal.tsx` + botón en el HUD, solo visible cuando de verdad hay algo que pausar (no durante carga, error, tutorial o game-over). Mismo patrón defensivo que el tutorial: bloquea también los atajos de teclado 1/2/3 mientras está pausado.
- **Hallazgo 3 — banco de preguntas desbalanceado en dificultad 1 de Multiplicación/División:** la `0002` generó esas dos regiones exigiendo *ambos* operandos ≥ 2, así que dificultad 1 (resultado de una cifra) solo tenía **6 combinaciones posibles** — confirmado con una consulta real contra el Supabase del usuario, no solo estimado. Carrera Matemática (dificultad fija 1, 5 preguntas por ronda) en Ciudad y Castillo mostraba casi las mismas 5 preguntas en cada repetición del nivel.
  - **Arreglo:** migración `0007`, agrega la tabla del 1 (×1 y ÷1) — matemáticamente válida y apropiada para dificultad 1, sin chocar con ninguna fila existente (la `0002` nunca generó nada con un operando en 1). Probada con PGlite antes de entregarla: 6→23 preguntas en Carrera de esas dos regiones, sin duplicados, sin distractores rotos, banco total 1572→1674.
- **No tocado a propósito:** el compromiso de seguridad P2 (respuesta visible en cliente, ADR-004/007) y el `README.md` general del repo (pendiente, ver documento de contexto).

## ADR-009 · "Soy yo": evita que un estudiante quede duplicado entre dispositivos
- **Qué:** siguiente ronda de auditoría, esta vez sobre el panel docente. Hallazgo grave: el acceso sin cuenta (ADR-002) usa una sesión anónima de Supabase atada al navegador/dispositivo, y `register_student()` creaba **siempre** una fila nueva, sin revisar si ya existía alguien con ese nombre en ese curso. Un mismo niño real que jugaba un día en una tablet del salón y otro en el celular de la casa (o el colegio reseteaba las tablets entre trimestres, o borraba caché) terminaba viéndose como 2-3 estudiantes distintos en el panel, cada uno con una parte de su progreso — le pega directo al objetivo central del proyecto: que el docente entienda el desempeño real.
- **Decisión (con el usuario, por el trade-off de seguridad):** se presentaron dos caminos — vincular automáticamente por coincidencia de nombre al registrarse, o solo dar una herramienta de fusión manual al docente. El usuario eligió el automático. Es una decisión consciente de simplicidad sobre seguridad, en la misma línea que ADR-002: cualquiera que escriba el mismo nombre en ese curso puede continuar ese progreso (sin verificación real de identidad). Para un juego de matemáticas de salón sin datos sensibles, es un riesgo aceptado explícitamente.
- **Arreglo:** migración `0008`, reemplaza `register_student()`. Si ya existe un estudiante con el mismo nombre+apellido (sin importar mayúsculas/espacios) en ese curso, la sesión nueva actualiza el `auth_user_id` de esa fila existente en vez de insertar una nueva — no se crea ninguna tabla nueva, es la solución más simple que resuelve el problema real.
- **Probada con PGlite** simulando el escenario exacto: dispositivo A registra "Juan Pérez", dispositivo B registra "  juan " / "PÉREZ" → misma fila (`auth_user_id` se mueve al dispositivo B), total de estudiantes en el curso correcto, idempotente en llamadas repetidas.
- **Límite conocido, documentado a propósito:** la 0008 solo evita duplicados *nuevos* desde que se corre. No fusiona retroactivamente duplicados que ya existían antes (ver query de detección en `supabase/README.md`) — eso requiere decidir a mano cuál fila conservar y mover sus `rounds`/`attempts`, no es automatizable de forma segura sin criterio humano.

## ADR-010 · Intento revertido: cerrar la fuga completa del banco de preguntas (ADR-004 P2)
- **Qué pasó:** otra sesión encontró que el grant de la 0002 daba `select` sin restricción sobre `questions` a cualquier sesión `authenticated`, incluida la de un estudiante — cualquiera podía abrir la consola del navegador y bajarse las 1674 preguntas con respuestas correctas, no solo las de su ronda. Se implementó, probó con PGlite y documentó una migración `0009` (revocar `select`, reemplazar por `get_round_questions(region_id, game_mode_id)`, una función `security definer` que filtra y muestrea del lado del servidor). El usuario la corrió en su Supabase real.
- **Qué falló:** después de correrla, las preguntas dejaron de cargar en el juego real. **Causa más probable (no confirmada por el usuario, pero es el motivo típico de este síntoma exacto en Supabase):** PostgREST — la capa que expone las funciones de Postgres como endpoints `rpc()` — mantiene en caché el esquema de la base de datos, y no se enteró de la función nueva hasta refrescar ese caché. La migración 0009 no incluía `notify pgrst, 'reload schema';` al final, algo que si se corre a mano desde el SQL Editor (no vía la UI de migraciones de Supabase) hay que disparar aparte. El código y la lógica SQL en sí mismos estaban bien — el mismo patrón `security definer` ya funciona hoy para `register_student`, `submit_round`, etc.
- **Qué se hizo:** el usuario revirtió los 3 commits (código, pruebas, ADR) en el repo, y corrió a mano en Supabase real `grant select on public.questions to authenticated; drop function if exists public.get_round_questions(text, text);` — es decir, deshizo también la base de datos. Se confirmó (sesión siguiente) que ambos quedaron alineados en el estado de antes: no hay ningún desfase entre lo que el código espera y lo que la base de datos permite.
- **Decisión final del usuario:** dejarlo así por ahora — considera que el arreglo es "un poco innecesario" para el riesgo real (un juego de matemáticas de salón, sin datos sensibles, con estudiantes de 8-9 años como amenaza improbable). El compromiso vuelve a quedar exactamente como estaba documentado en ADR-004/ADR-007: la respuesta correcta de la ronda actual es visible en el cliente por diseño (feedback instantáneo sin ida y vuelta al servidor), y además — este es el hallazgo nuevo que sigue sin resolver — el banco completo también es legible por cualquier sesión autenticada, no solo la ronda actual.
- **Si en el futuro se quiere reintentar:** la migración 0009 original (recuperable con `git show 1bd38a4:supabase/migrations/0009_restrict_question_bank_access.sql`) solo necesitaría agregar `notify pgrst, 'reload schema';` al final, y esperar 1-2 minutos o forzar el refresco manual del caché de esquema desde el dashboard de Supabase (Settings → API) antes de probar que el juego carga preguntas. No hace falta rediseñar nada del enfoque.

## ADR-011 · Por qué seguía "igual" después de revertir todo (ADR-010) -- y cómo se cerró
- **Contexto:** después de que el usuario revirtiera la 0009 en código y en su Supabase real (ver ADR-010), el juego seguía trabado en "Cargando desafío matemático..." en incógnito. La teoría de la caché de esquema de PostgREST (ADR-010) es real y explica bien el fallo *original* -- pero no explicaba que siguiera pasando después del revert, porque en ese punto el frontend ya no llamaba ninguna función nueva: había vuelto al `select` directo de siempre, y `grant`/`revoke` los aplica Postgres al momento, sin depender de ningún caché.
- **Diagnóstico real (con evidencia, no teoría):** consola del navegador mostraba errores de `GamePage-BBfiFCb5.js` -- un nombre de archivo que no coincidía con ningún build generado por el código actual (que en ese momento producía `GamePage-BxdDUNXE.js`). El navegador estaba cargando JavaScript de un build viejo, no el desplegado. Confirmado también desde la API de despliegues de GitHub que el commit correcto sí estaba como `Production` en Vercel -- el problema no era qué se desplegó, sino qué le servía la caché al navegador.
- **Causa raíz:** `vercel.json` no tenía ninguna regla de `Cache-Control` para `index.html`. Los `.js`/`.css` con hash en el nombre sí deben cachearse agresivo (son inmutables, el nombre cambia en cada build) -- pero si `index.html` (el que dice cuál `.js` cargar) queda cacheado en el borde de la CDN, el navegador puede terminar pidiendo un bundle que ya no es el actual, sin importar cuántas veces se abra una ventana de incógnito nueva (eso descarta caché del navegador como única causa; apuntaba a la CDN).
- **Arreglo:** se agregó a `vercel.json` `Cache-Control: no-cache, no-store, must-revalidate` para `/` y `/index.html`. Los assets con hash (`/assets/*.js`, `*.css`) no se tocaron -- esos sí deben seguir cacheados fuerte.
- **Para la próxima vez que algo "no cargue" después de un deploy:** antes de sospechar de la base de datos o de Postgres, comparar el nombre del archivo `.js` que muestra el error de consola contra el que genera `npm run build` en ese momento. Si no coinciden, es caché de `index.html`, no lógica.
