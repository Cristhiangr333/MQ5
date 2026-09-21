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
    competency: 'Operaciones y cálculo mental ágil',
    description: 'Acelera por el sendero del bosque respondiendo sumas y series numéricas antes de que expire el tiempo.',
    targetConcept: 'Adición, decenas y series numéricas',
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
    competency: 'Sustracción y resolución de diferencias',
    description: 'Enfréntate al Guardián de Roca en la arena flotante. Cada resta correcta lanza un golpe crítico certero.',
    targetConcept: 'Sustracción con reagrupación y cálculo inverso',
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
    competency: 'Multiplicación y presupuestos reales',
    description: 'Calcula costos en el mercado de la ciudad: artículos por cantidad, promociones y vueltos de compras.',
    targetConcept: 'Tablas de multiplicar, factores y múltiplos',
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
    competency: 'División y reparto equitativo',
    description: 'Coloca bloques geométricos para tender un puente sobre el río bravío resolviendo divisiones y fracciones.',
    targetConcept: 'División exacta, cocientes y partes iguales',
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
    competency: 'Razonamiento lógico y fracciones mixtas',
    description: 'Desbloquea las 5 runas del torreón resolviendo enigmas matemáticos, fracciones y jerarquía de operaciones.',
    targetConcept: 'Fracciones equivalentes, incógnitas y problemas combinados',
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
    const qId = `${worldId}-${i + 1}-${Date.now()}`;

    switch (worldId) {
      case 'bosque': {
        // Sumas ágiles y secuencias de grado 5
        const type = i % 3;
        if (type === 0) {
          const a = randInt(25, 95);
          const b = randInt(18, 88);
          const correct = a + b;
          const distractors = [correct + 10, correct - 10, correct + 2, correct - 2].filter(v => v !== correct && v > 0);
          const opts = shuffle([correct, ...distractors.slice(0, 2)]);
          questions.push({
            id: qId,
            text: `${a} + ${b} = ?`,
            category: 'Suma de 2 dígitos',
            difficulty: 1,
            options: opts,
            correct,
            explanation: `Descomponiendo: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10} y ${a % 10} + ${b % 10} = ${a % 10 + b % 10}, dando un total de ${correct}.`,
          });
        } else if (type === 1) {
          const a = randInt(120, 450);
          const b = randInt(85, 320);
          const correct = a + b;
          const opts = shuffle([correct, correct + (randInt(1, 2) === 1 ? 10 : -10), correct + (randInt(1, 2) === 1 ? 100 : -100)]);
          questions.push({
            id: qId,
            text: `${a} + ${b} = ?`,
            category: 'Suma con centenas',
            difficulty: 2,
            options: opts,
            correct,
            explanation: `Sumando centenas, decenas y unidades: ${a} + ${b} = ${correct}.`,
          });
        } else {
          // Serie numérica
          const step = randInt(4, 9);
          const start = randInt(12, 30);
          const s1 = start;
          const s2 = s1 + step;
          const s3 = s2 + step;
          const correct = s3 + step;
          const opts = shuffle([correct, correct + step, correct - 2]);
          questions.push({
            id: qId,
            text: `${s1}, ${s2}, ${s3}, ¿__?`,
            category: 'Patrón de suma creciente',
            difficulty: 2,
            options: opts,
            correct,
            explanation: `El patrón aumenta de +${step} en cada paso: ${s3} + ${step} = ${correct}.`,
          });
        }
        break;
      }

      case 'montana': {
        // Resta y cálculo de diferencias
        const type = i % 2;
        if (type === 0) {
          const a = randInt(70, 180);
          const b = randInt(25, a - 10);
          const correct = a - b;
          const opts = shuffle([correct, correct + 10, correct - 8].filter(v => v > 0));
          questions.push({
            id: qId,
            text: `${a} - ${b} = ?`,
            category: 'Resta directa',
            difficulty: 2,
            options: opts.length === 3 ? opts : [correct, correct + 10, correct - 5],
            correct,
            explanation: `Comprobación: ${correct} + ${b} = ${a}.`,
          });
        } else {
          const total = randInt(200, 500);
          const part = randInt(65, 185);
          const correct = total - part;
          const opts = shuffle([correct, correct + 12, Math.max(10, correct - 10)]);
          questions.push({
            id: qId,
            text: `${total} - ${part} = ?`,
            category: 'Sustracción con llevada',
            difficulty: 3,
            options: opts,
            correct,
            explanation: `Al restar ${part} de ${total} obtenemos exactamente ${correct}.`,
          });
        }
        break;
      }

      case 'ciudad': {
        // Multiplicación en contexto de mercado
        const items = [
          { name: 'Pociones de energía', unit: randInt(6, 12), qty: randInt(4, 8) },
          { name: 'Cristales mágicos', unit: randInt(12, 25), qty: randInt(3, 6) },
          { name: 'Escudos de bronce', unit: randInt(15, 30), qty: randInt(2, 5) },
          { name: 'Manzanas doradas', unit: randInt(7, 9), qty: randInt(6, 9) },
          { name: 'Pergaminos de hechizo', unit: randInt(8, 14), qty: randInt(5, 7) },
        ];
        const item = items[i % items.length];
        const correct = item.unit * item.qty;
        const opts = shuffle([correct, correct + item.unit, correct - item.unit].filter(v => v > 0));
        questions.push({
          id: qId,
          text: `${item.qty} × $${item.unit} = ?`,
          category: `Compra: ${item.name}`,
          difficulty: 3,
          options: opts.length === 3 ? opts : [correct, correct + 10, correct - 10],
          correct,
          explanation: `${item.qty} unidades a $${item.unit} cada una dan un precio total de $${correct}.`,
          contextData: {
            itemName: item.name,
            unitPrice: item.unit,
            quantity: item.qty,
          },
        });
        break;
      }

      case 'rio': {
        // División y reparto de bloques para el puente
        const divisors = [4, 5, 6, 7, 8, 9];
        const div = divisors[i % divisors.length];
        const quot = randInt(4, 12);
        const dividend = div * quot;
        const correct = quot;
        const opts = shuffle([correct, correct + 1, Math.max(1, correct - 2)]);
        questions.push({
          id: qId,
          text: `${dividend} ÷ ${div} = ?`,
          category: 'Reparto de bloques del puente',
          difficulty: 3,
          options: opts,
          correct,
          explanation: `Dividir ${dividend} en ${div} partes iguales da ${correct} bloques por sección, porque ${div} × ${correct} = ${dividend}.`,
        });
        break;
      }

      case 'castillo': {
        // Enigmas de 5to grado: fracciones y operaciones combinadas
        const type = i % 3;
        if (type === 0) {
          // Fracción equivalente
          const n = randInt(2, 4);
          const d = randInt(5, 8);
          const mult = randInt(2, 4);
          const correctNum = n * mult;
          const correctDen = d * mult;
          questions.push({
            id: qId,
            text: `¿Fracción equivalente a ${n}/${d}?`,
            category: 'Fracciones equivalentes',
            difficulty: 4,
            options: shuffle([`${correctNum}/${correctDen}`, `${correctNum + 1}/${correctDen}`, `${correctNum}/${correctDen + 2}`]),
            correct: `${correctNum}/${correctDen}`,
            explanation: `Multiplicando numerador y denominador por ${mult}: (${n}×${mult})/(${d}×${mult}) = ${correctNum}/${correctDen}.`,
          });
        } else if (type === 1) {
          // Operación combinada (con jerarquía)
          const a = randInt(3, 6);
          const b = randInt(4, 8);
          const c = randInt(10, 25);
          const correct = a * b + c;
          questions.push({
            id: qId,
            text: `(${a} × ${b}) + ${c} = ?`,
            category: 'Jerarquía de operaciones',
            difficulty: 4,
            options: shuffle([correct, correct - a, correct + 10]),
            correct,
            explanation: `Primero resolvemos la multiplicación: ${a} × ${b} = ${a * b}. Luego sumamos ${c}: ${a * b} + ${c} = ${correct}.`,
          });
        } else {
          // Enigma con incógnita
          const x = randInt(12, 28);
          const add = randInt(15, 35);
          const total = x + add;
          questions.push({
            id: qId,
            text: `Enigma: [ ? ] + ${add} = ${total}`,
            category: 'Ecuación misteriosa',
            difficulty: 4,
            options: shuffle([x, x + 5, Math.max(2, x - 4)]),
            correct: x,
            explanation: `Despejamos restando: ${total} - ${add} = ${x}.`,
          });
        }
        break;
      }
    }
  }

  return questions;
}
