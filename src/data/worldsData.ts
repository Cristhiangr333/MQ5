import { WorldDefinition, MathQuestion } from '../types';

export const WORLDS: WorldDefinition[] = [
  {
    id: 'bosque',
    name: 'Bosque de la Suma',
    shortName: 'Bosque',
    subtitle: 'Carrera Matemática 3D',
    mode: 'race',
    themeColor: '#3FA34D',
    accentColor: '#5FCB6D',
    bgGradient: 'from-emerald-900/60 to-emerald-950/90',
    icon: '🏃',
    competency: 'Sumas de 1 cifra y patrones rápidos',
    description: 'Acelera por el sendero del bosque respondiendo sumas de 1 cifra y secuencias antes de que termine el tiempo.',
    targetConcept: 'Suma de 1 cifra (1 al 9) y patrones simples',
    unlockedByDefault: true,
    requiredXp: 0,
    islandPosition: [-6, 0.5, 3],
  },
  {
    id: 'montana',
    name: 'Montaña de la Resta',
    shortName: 'Montaña',
    subtitle: 'Batalla en Arena 3D',
    mode: 'battle',
    themeColor: '#D9A441',
    accentColor: '#F2B705',
    bgGradient: 'from-amber-900/60 to-amber-950/90',
    icon: '⚔️',
    competency: 'Restas de 1 cifra y diferencias',
    description: 'Enfréntate al Guardián de Roca en la arena flotante. Cada resta de 1 cifra correcta lanza un golpe al guardián.',
    targetConcept: 'Resta de 1 cifra (1 al 9) y cálculo de diferencias',
    unlockedByDefault: true,
    requiredXp: 50,
    islandPosition: [-2.5, 1.8, -1.5],
  },
  {
    id: 'ciudad',
    name: 'Ciudad de la Multiplicación',
    shortName: 'Ciudad',
    subtitle: 'Mercado del Mercader 3D',
    mode: 'shop',
    themeColor: '#8B5CF6',
    accentColor: '#A78BFA',
    bgGradient: 'from-purple-900/60 to-purple-950/90',
    icon: '🛒',
    competency: 'Multiplicaciones básicas de 1 cifra',
    description: 'Calcula compras en el puesto de Don Mateo con cantidades y precios de 1 cifra.',
    targetConcept: 'Tablas de multiplicar de 1 cifra (tablas del 2, 3, 4 y 5)',
    unlockedByDefault: false,
    requiredXp: 150,
    islandPosition: [2, 0.8, -3.5],
  },
  {
    id: 'rio',
    name: 'Río de la División',
    shortName: 'Río',
    subtitle: 'Puente Flotante 3D',
    mode: 'bridge',
    themeColor: '#0EA5E9',
    accentColor: '#38BDF8',
    bgGradient: 'from-sky-900/60 to-sky-950/90',
    icon: '🌉',
    competency: 'Reparto y divisiones exactas de 1 cifra',
    description: 'Coloca bloques geométricos para tender un puente sobre el río resolviendo divisiones sencillas de 1 cifra.',
    targetConcept: 'Repartos equitativos y divisiones exactas de 1 cifra',
    unlockedByDefault: false,
    requiredXp: 300,
    islandPosition: [5.5, -0.2, 0.5],
  },
  {
    id: 'castillo',
    name: 'Castillo del Saber',
    shortName: 'Castillo',
    subtitle: 'Enigma del Detective 3D',
    mode: 'detective',
    themeColor: '#EC4899',
    accentColor: '#F472B6',
    bgGradient: 'from-pink-900/60 to-slate-950/90',
    icon: '🕵️',
    competency: 'Enigmas e incógnitas de 1 cifra',
    description: 'Desbloquea las 5 runas del torreón descubriendo el número secreto de 1 cifra que falta.',
    targetConcept: 'Incógnitas de 1 cifra y razonamiento numérico para 3º grado',
    unlockedByDefault: false,
    requiredXp: 500,
    islandPosition: [1.5, 3.2, 4.2],
  },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function generateQuestionsForWorld(worldId: string, count = 5): MathQuestion[] {
  const questions: MathQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const qId = `${worldId}-${i + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    switch (worldId) {
      case 'bosque': {
        // Sumas de 1 cifra (3º de primaria)
        const type = i % 3;
        if (type === 0 || type === 1) {
          // Suma de dos números de 1 cifra con resultado exacto
          // Elegimos 'a' y 'b' de 1 cifra (1 a 8) de modo que el resultado sea de 1 cifra (hasta 9)
          const sumTarget = randInt(5, 9);
          const a = randInt(1, sumTarget - 1);
          const b = sumTarget - a;
          const correct = a + b;
          
          // Distractores de 1 cifra diferentes
          const distractors = [correct + 1, correct - 1, correct + 2, correct - 2]
            .filter((v) => v !== correct && v > 0 && v <= 9);
          const opts = shuffle([correct, distractors[0] || (correct > 2 ? correct - 2 : correct + 2), distractors[1] || (correct > 1 ? correct - 1 : correct + 1)]);

          questions.push({
            id: qId,
            text: `${a} + ${b} = ?`,
            category: 'Suma de 1 cifra',
            difficulty: 1,
            options: opts,
            correct,
            explanation: `Contando hacia adelante: ${a} más ${b} es igual a ${correct}.`,
          });
        } else {
          // Secuencia numérica simple de 1 cifra (paso de 1 o 2)
          const step = randInt(1, 2);
          const start = randInt(1, 9 - step * 3);
          const s1 = start;
          const s2 = s1 + step;
          const s3 = s2 + step;
          const correct = s3 + step;
          const distractors = [correct + step, Math.max(1, correct - step), correct + 1]
            .filter((v) => v !== correct && v <= 9 && v >= 1);
          const opts = shuffle([correct, distractors[0] || 9, distractors[1] || 8]);

          questions.push({
            id: qId,
            text: `${s1}, ${s2}, ${s3}, ¿__?`,
            category: 'Serie numérica (1 cifra)',
            difficulty: 1,
            options: opts,
            correct,
            explanation: `El patrón suma +${step} en cada paso: ${s3} + ${step} = ${correct}.`,
          });
        }
        break;
      }

      case 'montana': {
        // Resta de 1 cifra (3º de primaria)
        // a y b de 1 cifra (1 al 9), con a >= b y resultado de 1 cifra
        const a = randInt(3, 9);
        const b = randInt(1, a - 1);
        const correct = a - b;
        const distractors = [correct + 1, correct - 1, correct + 2, correct - 2]
          .filter((v) => v !== correct && v >= 0 && v <= 9);
        const opts = shuffle([correct, distractors[0] || (correct + 1), distractors[1] || Math.max(0, correct - 1)]);

        questions.push({
          id: qId,
          text: `${a} - ${b} = ?`,
          category: 'Resta de 1 cifra',
          difficulty: 1,
          options: opts,
          correct,
          explanation: `Si a ${a} le quitas ${b}, te quedan ${correct}. ¡Porque ${correct} + ${b} = ${a}!`,
        });
        break;
      }

      case 'ciudad': {
        // Multiplicación en el mercado de Don Mateo: factores de 1 cifra y resultado de 1 cifra (o hasta 9)
        const items = [
          { name: 'Manzanas', qty: 3, unit: 2, total: 6 },
          { name: 'Pociones', qty: 2, unit: 3, total: 6 },
          { name: 'Galletas', qty: 4, unit: 2, total: 8 },
          { name: 'Caramelos', qty: 3, unit: 3, total: 9 },
          { name: 'Panes', qty: 2, unit: 4, total: 8 },
          { name: 'Jugos', qty: 2, unit: 2, total: 4 },
          { name: 'Globos', qty: 5, unit: 1, total: 5 },
          { name: 'Lápices', qty: 3, unit: 2, total: 6 },
        ];
        const item = items[(i + randInt(0, 2)) % items.length];
        const correct = item.total;
        const distractors = [correct + 1, correct - 1, correct + 2, correct - 2]
          .filter((v) => v !== correct && v > 0 && v <= 10);
        const opts = shuffle([correct, distractors[0] || (correct + 1), distractors[1] || (correct - 1)]);

        questions.push({
          id: qId,
          text: `${item.qty} × $${item.unit} = ?`,
          category: `Compra: ${item.name}`,
          difficulty: 2,
          options: opts,
          correct,
          explanation: `${item.qty} ${item.name.toLowerCase()} a $${item.unit} cada una es igual a $${correct} en total.`,
          contextData: {
            itemName: item.name,
            unitPrice: item.unit,
            quantity: item.qty,
          },
        });
        break;
      }

      case 'rio': {
        // Repartos y divisiones exactas con números de 1 cifra
        const divisions = [
          { text: '6 ÷ 2 = ?', dividend: 6, divisor: 2, correct: 3, context: '6 bloques entre 2 columnas' },
          { text: '8 ÷ 2 = ?', dividend: 8, divisor: 2, correct: 4, context: '8 piedras entre 2 orillas' },
          { text: '9 ÷ 3 = ?', dividend: 9, divisor: 3, correct: 3, context: '9 maderos entre 3 secciones' },
          { text: '6 ÷ 3 = ?', dividend: 6, divisor: 3, correct: 2, context: '6 tablones entre 3 postes' },
          { text: '8 ÷ 4 = ?', dividend: 8, divisor: 4, correct: 2, context: '8 cuerdas entre 4 amarres' },
          { text: '4 ÷ 2 = ?', dividend: 4, divisor: 2, correct: 2, context: '4 columnas entre 2 tramos' },
        ];
        const div = divisions[i % divisions.length];
        const correct = div.correct;
        const distractors = [correct + 1, correct - 1, correct + 2]
          .filter((v) => v !== correct && v > 0 && v <= 9);
        const opts = shuffle([correct, distractors[0] || (correct + 1), distractors[1] || (correct - 1)]);

        questions.push({
          id: qId,
          text: div.text,
          category: 'Reparto de bloques (1 cifra)',
          difficulty: 2,
          options: opts,
          correct,
          explanation: `Repartir ${div.dividend} en ${div.divisor} partes iguales da ${correct}, porque ${div.divisor} × ${correct} = ${div.dividend}.`,
        });
        break;
      }

      case 'castillo': {
        // Enigmas con incógnitas de 1 cifra para 3º de primaria
        const mysteries = [
          { text: '4 + [ ? ] = 7', correct: 3, exp: '¿Cuánto le falta a 4 para llegar a 7? ¡Le faltan 3!' },
          { text: '[ ? ] + 5 = 8', correct: 3, exp: 'El número misterioso es 3, porque 3 + 5 = 8.' },
          { text: '9 - [ ? ] = 5', correct: 4, exp: 'A 9 le quitamos 4 para que queden 5.' },
          { text: '[ ? ] - 3 = 4', correct: 7, exp: 'Empezamos con 7, porque 7 - 3 = 4.' },
          { text: '2 × [ ? ] = 6', correct: 3, exp: 'En la tabla del 2: 2 × 3 = 6.' },
          { text: '3 × [ ? ] = 9', correct: 3, exp: 'En la tabla del 3: 3 × 3 = 9.' },
          { text: '5 + [ ? ] = 9', correct: 4, exp: '5 más 4 es igual a 9.' },
          { text: '8 - [ ? ] = 6', correct: 2, exp: '8 menos 2 es igual a 6.' },
        ];
        const mystery = mysteries[i % mysteries.length];
        const correct = mystery.correct;
        const distractors = [correct + 1, correct - 1, correct + 2, correct - 2]
          .filter((v) => v !== correct && v > 0 && v <= 9);
        const opts = shuffle([correct, distractors[0] || (correct + 1), distractors[1] || (correct - 1)]);

        questions.push({
          id: qId,
          text: mystery.text,
          category: 'Enigma de 1 cifra',
          difficulty: 2,
          options: opts,
          correct,
          explanation: mystery.exp,
        });
        break;
      }
    }
  }

  return questions;
}
