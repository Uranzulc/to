import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Card, Deck, DeckSummary, QuizResult } from "../shared/types.js";

interface DB {
  decks: Deck[];
  cards: Card[];
  results: QuizResult[];
}

const DATA_FILE = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "db.json");

let db: DB | null = null;
let queue: Promise<void> = Promise.resolve();

const now = () => new Date().toISOString();

function seed(): DB {
  const deckId = randomUUID();
  const pairs: [string, string][] = [
    ["What is the capital of France?", "Paris"],
    ["What is the capital of Japan?", "Tokyo"],
    ["What is the capital of Canada?", "Ottawa"],
    ["What is the capital of Australia?", "Canberra"],
    ["What is the capital of Mongolia?", "Ulaanbaatar"],
    ["What is the capital of Brazil?", "Brasília"],
  ];
  return {
    decks: [
      { id: deckId, name: "World Capitals", description: "A sample deck to get you started.", createdAt: now() },
    ],
    cards: pairs.map(([front, back]) => ({ id: randomUUID(), deckId, front, back, createdAt: now() })),
    results: [],
  };
}

async function writeFile(): Promise<void> {
  if (!db) return;
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function persist(): Promise<void> {
  queue = queue.then(writeFile).catch((err) => {
    console.error("Failed to save database:", err);
  });
  return queue;
}

async function load(): Promise<DB> {
  if (db) return db;
  try {
    db = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as DB;
  } catch {
    db = seed();
    await persist();
  }
  return db;
}

// ---- Decks ----

export async function listDecks(): Promise<DeckSummary[]> {
  const d = await load();
  return d.decks.map((deck) => {
    const results = d.results.filter((r) => r.deckId === deck.id && r.total > 0);
    const best = results.length ? Math.max(...results.map((r) => Math.round((r.score / r.total) * 100))) : null;
    return { ...deck, cardCount: d.cards.filter((c) => c.deckId === deck.id).length, bestScore: best };
  });
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return (await load()).decks.find((d) => d.id === id);
}

export async function createDeck(name: string, description: string): Promise<Deck> {
  const d = await load();
  const deck: Deck = { id: randomUUID(), name, description, createdAt: now() };
  d.decks.push(deck);
  await persist();
  return deck;
}

export async function deleteDeck(id: string): Promise<boolean> {
  const d = await load();
  const before = d.decks.length;
  d.decks = d.decks.filter((x) => x.id !== id);
  if (d.decks.length === before) return false;
  d.cards = d.cards.filter((c) => c.deckId !== id);
  d.results = d.results.filter((r) => r.deckId !== id);
  await persist();
  return true;
}

// ---- Cards ----

export async function listCards(deckId: string): Promise<Card[]> {
  return (await load()).cards.filter((c) => c.deckId === deckId);
}

export async function getCard(id: string): Promise<Card | undefined> {
  return (await load()).cards.find((c) => c.id === id);
}

export async function createCard(deckId: string, front: string, back: string): Promise<Card> {
  const d = await load();
  const card: Card = { id: randomUUID(), deckId, front, back, createdAt: now() };
  d.cards.push(card);
  await persist();
  return card;
}

export async function updateCard(id: string, front: string, back: string): Promise<Card | undefined> {
  const card = await getCard(id);
  if (!card) return undefined;
  card.front = front;
  card.back = back;
  await persist();
  return card;
}

export async function deleteCard(id: string): Promise<boolean> {
  const d = await load();
  const before = d.cards.length;
  d.cards = d.cards.filter((c) => c.id !== id);
  if (d.cards.length === before) return false;
  await persist();
  return true;
}

// ---- Results ----

export async function addResult(deckId: string, score: number, total: number): Promise<QuizResult> {
  const d = await load();
  const result: QuizResult = { id: randomUUID(), deckId, score, total, takenAt: now() };
  d.results.push(result);
  await persist();
  return result;
}

export async function listResults(deckId: string): Promise<QuizResult[]> {
  const d = await load();
  return d.results.filter((r) => r.deckId === deckId).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}
