# Card Quiz

A full-stack flashcard quiz app written entirely in TypeScript.

- **Backend:** Express REST API with a JSON-file database (`data/db.json`, created and seeded on first run)
- **Frontend:** TypeScript single-page app (no framework), bundled with esbuild
- **Shared:** `src/shared/types.ts` is used by both sides so the API contract is type-checked end to end

## Features

- Create and delete decks, add / edit / delete cards
- Study mode: flip cards, shuffle, keyboard shortcuts (Space = flip, ←/→ = navigate)
- Quiz mode: multiple choice built from the deck's own answers; answers are checked on the server
- Quiz results saved per deck, with best score shown on the deck list

## Run it

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

Development with live reload (server restarts + client rebuilds):

```bash
npm run dev
```

Environment variables: `PORT` (default 3000), `DATA_FILE` (default `./data/db.json`).

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/decks` | List decks with card count and best score |
| POST | `/api/decks` | Create deck `{ name, description? }` |
| GET | `/api/decks/:id` | Get one deck |
| DELETE | `/api/decks/:id` | Delete deck, its cards and results |
| GET | `/api/decks/:id/cards` | List cards |
| POST | `/api/decks/:id/cards` | Add card `{ front, back }` |
| PUT | `/api/cards/:id` | Update card `{ front, back }` |
| DELETE | `/api/cards/:id` | Delete card |
| GET | `/api/decks/:id/quiz?count=10` | Get shuffled multiple-choice questions (no answers included) |
| POST | `/api/quiz/answer` | Check an answer `{ cardId, answer }` → `{ correct, correctAnswer }` |
| GET | `/api/decks/:id/results` | Past quiz results |
| POST | `/api/decks/:id/results` | Save a result `{ score, total }` |

## Project layout

```
src/
  shared/types.ts     shared interfaces
  server/index.ts     Express app, routes, validation
  server/store.ts     JSON-file persistence
  client/main.ts      views and router
  client/api.ts       typed fetch wrapper
public/
  index.html
  styles.css
```
