import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import path from "node:path";
import * as store from "./store.js";
import type { AnswerResult, QuizQuestion } from "../shared/types.js";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function text(value: unknown, field: string, max: number, required = true): string {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `${field} is required`);
    return "";
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} is required`);
  if (trimmed.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

const app = express();
app.use(express.json({ limit: "100kb" }));

const api = express.Router();

// ---- Decks ----
api.get(
  "/decks",
  wrap(async (_req, res) => {
    res.json(await store.listDecks());
  }),
);

api.post(
  "/decks",
  wrap(async (req, res) => {
    const name = text(req.body?.name, "name", 80);
    const description = text(req.body?.description, "description", 300, false);
    res.status(201).json(await store.createDeck(name, description));
  }),
);

api.get(
  "/decks/:id",
  wrap(async (req, res) => {
    const deck = await store.getDeck(req.params.id as string);
    if (!deck) throw new HttpError(404, "Deck not found");
    res.json(deck);
  }),
);

api.delete(
  "/decks/:id",
  wrap(async (req, res) => {
    if (!(await store.deleteDeck(req.params.id as string))) throw new HttpError(404, "Deck not found");
    res.status(204).end();
  }),
);

// ---- Cards ----
api.get(
  "/decks/:id/cards",
  wrap(async (req, res) => {
    const id = req.params.id as string;
    if (!(await store.getDeck(id))) throw new HttpError(404, "Deck not found");
    res.json(await store.listCards(id));
  }),
);

api.post(
  "/decks/:id/cards",
  wrap(async (req, res) => {
    const id = req.params.id as string;
    if (!(await store.getDeck(id))) throw new HttpError(404, "Deck not found");
    const front = text(req.body?.front, "front", 500);
    const back = text(req.body?.back, "back", 500);
    res.status(201).json(await store.createCard(id, front, back));
  }),
);

api.put(
  "/cards/:id",
  wrap(async (req, res) => {
    const front = text(req.body?.front, "front", 500);
    const back = text(req.body?.back, "back", 500);
    const card = await store.updateCard(req.params.id as string, front, back);
    if (!card) throw new HttpError(404, "Card not found");
    res.json(card);
  }),
);

api.delete(
  "/cards/:id",
  wrap(async (req, res) => {
    if (!(await store.deleteCard(req.params.id as string))) throw new HttpError(404, "Card not found");
    res.status(204).end();
  }),
);

// ---- Quiz ----
// Returns shuffled multiple-choice questions. Correct answers are NOT included;
// the client checks each answer via POST /quiz/answer.
api.get(
  "/decks/:id/quiz",
  wrap(async (req, res) => {
    const id = req.params.id as string;
    if (!(await store.getDeck(id))) throw new HttpError(404, "Deck not found");
    const cards = await store.listCards(id);
    if (cards.length < 2) throw new HttpError(400, "Add at least 2 cards to take a quiz");

    const requested = Number.parseInt(String(req.query.count ?? "10"), 10);
    const count = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 10, cards.length, 50);

    const questions: QuizQuestion[] = shuffle(cards)
      .slice(0, count)
      .map((card) => {
        const wrongPool = [...new Set(cards.filter((c) => c.id !== card.id && c.back !== card.back).map((c) => c.back))];
        const options = shuffle([card.back, ...shuffle(wrongPool).slice(0, 3)]);
        return { cardId: card.id, prompt: card.front, options };
      });
    res.json(questions);
  }),
);

api.post(
  "/quiz/answer",
  wrap(async (req, res) => {
    const cardId = text(req.body?.cardId, "cardId", 100);
    const answer = text(req.body?.answer, "answer", 500);
    const card = await store.getCard(cardId);
    if (!card) throw new HttpError(404, "Card not found");
    const result: AnswerResult = { correct: card.back === answer, correctAnswer: card.back };
    res.json(result);
  }),
);

api.get(
  "/decks/:id/results",
  wrap(async (req, res) => {
    const id = req.params.id as string;
    if (!(await store.getDeck(id))) throw new HttpError(404, "Deck not found");
    res.json(await store.listResults(id));
  }),
);

api.post(
  "/decks/:id/results",
  wrap(async (req, res) => {
    const id = req.params.id as string;
    if (!(await store.getDeck(id))) throw new HttpError(404, "Deck not found");
    const { score, total } = req.body ?? {};
    if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
      throw new HttpError(400, "score and total must be integers with 0 <= score <= total");
    }
    res.status(201).json(await store.addResult(id, score, total));
  }),
);

api.use((_req, _res, next) => next(new HttpError(404, "Not found")));

app.use("/api", api);
app.use(express.static(path.join(process.cwd(), "public")));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Card Quiz running at http://localhost:${port}`);
});
