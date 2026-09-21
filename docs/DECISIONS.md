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
- **Por qué:** separa contenido de código; permite analizar por operandos ("¿qué tabla falla más?") y corregir sin desplegar. En la migración 0003 el servidor recalculará si cada respuesta es correcta y otorgará el XP; el cliente no puede declararlo.
- **Compromiso conocido:** el cliente recibe la respuesta correcta junto con la pregunta para dar feedback inmediato. Un estudiante decidido podría verla con las herramientas del navegador. El servidor ignora lo que el cliente afirme, así que no puede inflar XP ni resultados inventados, pero sí responder con la clave. Ocultarla exige un viaje al servidor por respuesta: queda como P2.
- **Impacto:** `generateQuestionsForWorld` (cliente, `Math.random`) será reemplazado por lectura del banco. Las secuencias numéricas del prototipo quedan fuera por ahora (P2).
- **Dificultad:** nivel 1 = resultado de 1 cifra (lo que hoy hace el prototipo). Niveles 2 y 3 (resultados mayores) están cargados pero el juego solo los usará si se decide. Con resultado de 1 cifra hay únicamente 6 multiplicaciones y 6 divisiones distintas.
