import type { AnswerResult, Card, Deck, DeckSummary, QuizQuestion, QuizResult } from "../shared/types";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listDecks: () => request<DeckSummary[]>("GET", "/api/decks"),
  getDeck: (id: string) => request<Deck>("GET", `/api/decks/${id}`),
  createDeck: (name: string, description: string) => request<Deck>("POST", "/api/decks", { name, description }),
  deleteDeck: (id: string) => request<void>("DELETE", `/api/decks/${id}`),

  listCards: (deckId: string) => request<Card[]>("GET", `/api/decks/${deckId}/cards`),
  createCard: (deckId: string, front: string, back: string) =>
    request<Card>("POST", `/api/decks/${deckId}/cards`, { front, back }),
  updateCard: (id: string, front: string, back: string) => request<Card>("PUT", `/api/cards/${id}`, { front, back }),
  deleteCard: (id: string) => request<void>("DELETE", `/api/cards/${id}`),

  getQuiz: (deckId: string, count = 10) => request<QuizQuestion[]>("GET", `/api/decks/${deckId}/quiz?count=${count}`),
  checkAnswer: (cardId: string, answer: string) => request<AnswerResult>("POST", "/api/quiz/answer", { cardId, answer }),
  saveResult: (deckId: string, score: number, total: number) =>
    request<QuizResult>("POST", `/api/decks/${deckId}/results`, { score, total }),
  listResults: (deckId: string) => request<QuizResult[]>("GET", `/api/decks/${deckId}/results`),
};
