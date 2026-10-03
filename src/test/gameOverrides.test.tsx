import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mínimo del cliente de Supabase: cada tabla devuelve lo que le pongamos.
type Result = { data: unknown; error: unknown };
const tables: Record<string, Result> = {};
const questionFilters: Array<[string, string, unknown]> = [];

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    if (table === 'questions') questionFilters.push([name, String(args[0]), args[1]]);
    return b;
  };
  for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'limit']) b[m] = chain(m);
  b.then = (resolve: (r: Result) => unknown) => resolve(tables[table]);
  return b;
}
vi.mock('../lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));

const gameModes = [
  { id: 'battle', question_kinds: ['direct'], questions_per_round: 5, seconds_per_question: 11, lives: 3, difficulty_min: 1, difficulty_max: 2 },
];
const questionRow = { id: 1, kind: 'direct', prompt: '122 ÷ 2 = ?', correct_answer: 61, distractors: [71, 60, 62], difficulty: 4, explanation: 'x' };

async function freshModule() {
  vi.resetModules(); // los cachés (game_modes y overrides) viven en el módulo
  return import('../lib/game');
}
const range = () => ({
  min: questionFilters.find((f) => f[0] === 'gte')?.[2],
  max: questionFilters.find((f) => f[0] === 'lte')?.[2],
});

describe('fetchQuestionsForLevel · overrides de region_games (migración 0012)', () => {
  beforeEach(() => {
    questionFilters.length = 0;
    tables.game_modes = { data: gameModes, error: null };
    tables.questions = { data: [questionRow], error: null };
  });

  it('con override usa su dificultad y su tiempo (castillo/battle)', async () => {
    tables.region_games = {
      data: [{ region_id: 'castillo', game_mode_id: 'battle', difficulty_min: 4, difficulty_max: 4, seconds_per_question: 25 }],
      error: null,
    };
    const { fetchQuestionsForLevel } = await freshModule();
    const res = await fetchQuestionsForLevel('castillo', 'battle');
    expect(range()).toEqual({ min: 4, max: 4 });
    expect(res.config.secondsPerQuestion).toBe(25);
  });

  it('otra región con el mismo modo conserva el rango y tiempo del modo', async () => {
    tables.region_games = {
      data: [{ region_id: 'castillo', game_mode_id: 'battle', difficulty_min: 4, difficulty_max: 4, seconds_per_question: 25 }],
      error: null,
    };
    const { fetchQuestionsForLevel } = await freshModule();
    const res = await fetchQuestionsForLevel('bosque', 'battle');
    expect(range()).toEqual({ min: 1, max: 2 });
    expect(res.config.secondsPerQuestion).toBe(11);
  });

  it('si region_games falla (0012 sin aplicar) se comporta como antes', async () => {
    tables.region_games = { data: null, error: { message: 'column region_games.difficulty_min does not exist' } };
    const { fetchQuestionsForLevel } = await freshModule();
    const res = await fetchQuestionsForLevel('castillo', 'battle');
    expect(range()).toEqual({ min: 1, max: 2 });
    expect(res.config.secondsPerQuestion).toBe(11);
  });

  it('opciones = correcta + 2 distractores', async () => {
    tables.region_games = { data: [], error: null };
    const { fetchQuestionsForLevel } = await freshModule();
    const { questions } = await fetchQuestionsForLevel('castillo', 'battle');
    expect(questions[0].options.slice().sort()).toEqual([61, 71, 60].sort());
  });
});

describe('shuffle (mezcla uniforme)', () => {
  it('la respuesta correcta cae ~33 % en cada posición (antes 44/19/38)', async () => {
    const { shuffle } = await freshModule();
    const N = 30000;
    const pos = [0, 0, 0];
    for (let i = 0; i < N; i++) pos[shuffle(['c', 'x', 'y']).indexOf('c')]++;
    for (const p of pos) expect(p / N).toBeGreaterThan(0.31), expect(p / N).toBeLessThan(0.355);
  });

  it('conserva los elementos y no muta el arreglo original', async () => {
    const { shuffle } = await freshModule();
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });

  it('todas las preguntas de un banco tienen la misma probabilidad de salir', async () => {
    const { shuffle } = await freshModule();
    const bank = 36, k = 5, M = 20000, hit = Array(bank).fill(0);
    const ids = [...Array(bank).keys()];
    for (let i = 0; i < M; i++) shuffle(ids).slice(0, k).forEach((x) => hit[x]++);
    const ideal = (k / bank) * M;
    for (const h of hit) expect(Math.abs(h - ideal) / ideal).toBeLessThan(0.12);
  });
});
