// Types shared by the server and the client.

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface DeckSummary extends Deck {
  cardCount: number;
  bestScore: number | null; // best quiz score as a percentage (0-100)
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: string;
}

export interface QuizQuestion {
  cardId: string;
  prompt: string;
  options: string[];
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
}

export interface QuizResult {
  id: string;
  deckId: string;
  score: number;
  total: number;
  takenAt: string;
}

export interface ApiError {
  error: string;
}
