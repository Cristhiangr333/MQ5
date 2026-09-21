export type GameMode = 'race' | 'battle' | 'shop' | 'bridge' | 'detective';

export interface WorldDefinition {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  mode: GameMode;
  themeColor: string;
  accentColor: string;
  bgGradient: string;
  icon: string;
  competency: string;
  description: string;
  targetConcept: string;
  unlockedByDefault: boolean;
  requiredXp: number;
  islandPosition: [number, number, number]; // [x, y, z] on map
}

export interface MathQuestion {
  id: string;
  text: string;
  category: string;
  difficulty: number;
  options: number[] | string[];
  correct: number | string;
  hint?: string;
  explanation: string;
  contextData?: {
    itemName?: string;
    unitPrice?: number;
    quantity?: number;
    fractionVisual?: { num: number; den: number };
  };
}

export interface PlayerStats {
  score: number;
  stars: number;
  xp: number;
  lives: number;
  maxLives: number;
  combo: number;
  highestCombo: number;
  worldProgress: Record<string, {
    completed: boolean;
    highScore: number;
    stars: number;
    questionsAnswered: number;
    correctAnswers: number;
  }>;
  totalCorrect: number;
  totalAnswered: number;
}

export interface GameSessionState {
  currentWorldId: string;
  activeQuestionIndex: number;
  totalQuestions: number;
  questions: MathQuestion[];
  isAnswered: boolean;
  selectedOption: number | string | null;
  isCorrect: boolean | null;
  timeLeft: number;
  maxTime: number;
  isTimerActive: boolean;
  feedbackText: string;
  gameOver: boolean;
  gameWon: boolean;
  // Specific mode sub-states
  raceProgress: number; // 0 to 100%
  heroHp: number; // 0 to 100
  enemyHp: number; // 0 to 100
  bridgeBuiltSegments: number; // 0 to target
  shopCartTotal: number;
  cluesFound: number;
}
