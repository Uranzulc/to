import { api } from "./api";
import type { Card, QuizQuestion } from "../shared/types";

type Child = Node | string | null | false | undefined;
type Props = Record<string, unknown>;

// Tiny DOM helper. Text goes through append() so user content is never parsed as HTML.
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === null) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key === "value" && "value" in el) {
      (el as unknown as HTMLInputElement).value = String(value);
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

const app = document.getElementById("app") as HTMLElement;
let cleanup: (() => void) | null = null;

function mount(...nodes: Node[]): void {
  app.replaceChildren(...nodes);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function errorView(err: unknown): HTMLElement {
  const message = err instanceof Error ? err.message : String(err);
  return h("div", { class: "panel error" }, h("p", {}, `Something went wrong: ${message}`), h("a", { href: "#/", class: "btn" }, "Back to decks"));
}

function toast(message: string): void {
  const t = h("div", { class: "toast" }, message);
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

// ---------- Views ----------

async function homeView(): Promise<void> {
  const decks = await api.listDecks();

  const nameInput = h("input", { placeholder: "Deck name", maxlength: 80, required: true });
  const descInput = h("input", { placeholder: "Description (optional)", maxlength: 300 });
  const form = h(
    "form",
    {
      class: "panel form-row",
      onSubmit: async (e: Event) => {
        e.preventDefault();
        try {
          const deck = await api.createDeck(nameInput.value, descInput.value);
          location.hash = `#/deck/${deck.id}`;
        } catch (err) {
          toast((err as Error).message);
        }
      },
    },
    nameInput,
    descInput,
    h("button", { class: "btn primary", type: "submit" }, "Create deck"),
  );

  const list = decks.length
    ? h(
        "div",
        { class: "grid" },
        ...decks.map((d) =>
          h(
            "a",
            { class: "deck-card", href: `#/deck/${d.id}` },
            h("h3", {}, d.name),
            h("p", { class: "muted" }, d.description || "No description"),
            h(
              "div",
              { class: "meta" },
              h("span", {}, `${d.cardCount} card${d.cardCount === 1 ? "" : "s"}`),
              d.bestScore !== null && h("span", { class: "badge" }, `Best ${d.bestScore}%`),
            ),
          ),
        ),
      )
    : h("p", { class: "muted" }, "No decks yet. Create your first one above.");

  mount(h("h1", {}, "Your decks"), form, list);
}

async function deckView(deckId: string): Promise<void> {
  const [deck, cards, results] = await Promise.all([api.getDeck(deckId), api.listCards(deckId), api.listResults(deckId)]);

  const frontInput = h("input", { placeholder: "Front (question)", maxlength: 500, required: true });
  const backInput = h("input", { placeholder: "Back (answer)", maxlength: 500, required: true });
  const addForm = h(
    "form",
    {
      class: "panel form-row",
      onSubmit: async (e: Event) => {
        e.preventDefault();
        try {
          await api.createCard(deckId, frontInput.value, backInput.value);
          await deckView(deckId);
        } catch (err) {
          toast((err as Error).message);
        }
      },
    },
    frontInput,
    backInput,
    h("button", { class: "btn primary", type: "submit" }, "Add card"),
  );

  const cardRow = (card: Card) =>
    h(
      "li",
      { class: "card-row" },
      h("div", {}, h("strong", {}, card.front), h("div", { class: "muted" }, card.back)),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "btn small",
            onClick: async () => {
              const front = prompt("Front:", card.front);
              if (front === null) return;
              const back = prompt("Back:", card.back);
              if (back === null) return;
              try {
                await api.updateCard(card.id, front, back);
                await deckView(deckId);
              } catch (err) {
                toast((err as Error).message);
              }
            },
          },
          "Edit",
        ),
        h(
          "button",
          {
            class: "btn small danger",
            onClick: async () => {
              await api.deleteCard(card.id);
              await deckView(deckId);
            },
          },
          "Delete",
        ),
      ),
    );

  const canQuiz = cards.length >= 2;
  mount(
    h("a", { href: "#/", class: "back" }, "← All decks"),
    h("h1", {}, deck.name),
    h("p", { class: "muted" }, deck.description),
    h(
      "div",
      { class: "toolbar" },
      h("a", { class: `btn primary${cards.length ? "" : " disabled"}`, href: cards.length ? `#/study/${deckId}` : undefined }, "Study"),
      h("a", { class: `btn primary${canQuiz ? "" : " disabled"}`, href: canQuiz ? `#/quiz/${deckId}` : undefined }, "Take quiz"),
      h(
        "button",
        {
          class: "btn danger",
          onClick: async () => {
            if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
            await api.deleteDeck(deckId);
            location.hash = "#/";
          },
        },
        "Delete deck",
      ),
    ),
    !canQuiz && h("p", { class: "muted" }, "Add at least 2 cards to unlock the quiz."),
    addForm,
    h("h2", {}, `Cards (${cards.length})`),
    cards.length ? h("ul", { class: "card-list" }, ...cards.map(cardRow)) : h("p", { class: "muted" }, "No cards yet."),
    h("h2", {}, "Recent quiz results"),
    results.length
      ? h(
          "ul",
          { class: "results" },
          ...results.slice(0, 5).map((r) =>
            h("li", {}, `${r.score}/${r.total} (${Math.round((r.score / r.total) * 100)}%) — ${new Date(r.takenAt).toLocaleString()}`),
          ),
        )
      : h("p", { class: "muted" }, "No quizzes taken yet."),
  );
}

async function studyView(deckId: string): Promise<void> {
  const [deck, loaded] = await Promise.all([api.getDeck(deckId), api.listCards(deckId)]);
  if (!loaded.length) {
    location.hash = `#/deck/${deckId}`;
    return;
  }
  let cards = shuffle(loaded);
  let index = 0;
  let flipped = false;

  const flipper = h("div", { class: "flip" });
  const faceFront = h("div", { class: "face front" });
  const faceBack = h("div", { class: "face back" });
  flipper.append(faceFront, faceBack);
  const counter = h("p", { class: "muted center" });

  const render = () => {
    const card = cards[index] as Card;
    faceFront.textContent = card.front;
    faceBack.textContent = card.back;
    flipper.classList.toggle("flipped", flipped);
    counter.textContent = `Card ${index + 1} of ${cards.length} — click the card or press Space to flip`;
  };
  const go = (delta: number) => {
    index = (index + delta + cards.length) % cards.length;
    flipped = false;
    render();
  };
  const flip = () => {
    flipped = !flipped;
    render();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      flip();
    } else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => document.removeEventListener("keydown", onKey);

  flipper.addEventListener("click", flip);
  mount(
    h("a", { href: `#/deck/${deckId}`, class: "back" }, `← ${deck.name}`),
    h("h1", {}, "Study mode"),
    flipper,
    counter,
    h(
      "div",
      { class: "toolbar center" },
      h("button", { class: "btn", onClick: () => go(-1) }, "Previous"),
      h("button", { class: "btn", onClick: flip }, "Flip"),
      h("button", { class: "btn", onClick: () => go(1) }, "Next"),
      h(
        "button",
        {
          class: "btn",
          onClick: () => {
            cards = shuffle(cards);
            index = 0;
            flipped = false;
            render();
          },
        },
        "Shuffle",
      ),
    ),
  );
  render();
}

async function quizView(deckId: string): Promise<void> {
  const [deck, questions] = await Promise.all([api.getDeck(deckId), api.getQuiz(deckId, 10)]);
  let index = 0;
  let score = 0;

  const showQuestion = () => {
    const q = questions[index] as QuizQuestion;
    let answered = false;
    const feedback = h("p", { class: "feedback" });
    const next = h(
      "button",
      { class: "btn primary hidden", onClick: () => (index + 1 < questions.length ? (index++, showQuestion()) : finish()) },
      index + 1 < questions.length ? "Next question" : "See results",
    );
    const buttons = q.options.map((option) =>
      h(
        "button",
        {
          class: "option",
          onClick: async (e: Event) => {
            if (answered) return;
            answered = true;
            const clicked = e.currentTarget as HTMLButtonElement;
            try {
              const result = await api.checkAnswer(q.cardId, option);
              if (result.correct) score++;
              for (const b of buttons) {
                b.disabled = true;
                if (b.textContent === result.correctAnswer) b.classList.add("correct");
              }
              if (!result.correct) clicked.classList.add("wrong");
              feedback.textContent = result.correct ? "Correct!" : `Not quite. The answer is "${result.correctAnswer}".`;
              next.classList.remove("hidden");
            } catch (err) {
              answered = false;
              toast((err as Error).message);
            }
          },
        },
        option,
      ),
    );

    mount(
      h("a", { href: `#/deck/${deckId}`, class: "back" }, `← ${deck.name}`),
      h("h1", {}, "Quiz"),
      h("div", { class: "progress" }, h("div", { class: "bar", style: `width:${(index / questions.length) * 100}%` })),
      h("p", { class: "muted" }, `Question ${index + 1} of ${questions.length} · Score ${score}`),
      h("div", { class: "panel question" }, h("h2", {}, q.prompt), h("div", { class: "options" }, ...buttons)),
      feedback,
      next,
    );
  };

  const finish = async () => {
    const pct = Math.round((score / questions.length) * 100);
    try {
      await api.saveResult(deckId, score, questions.length);
    } catch (err) {
      toast((err as Error).message);
    }
    mount(
      h("h1", {}, "Quiz complete"),
      h("div", { class: "panel center" }, h("div", { class: "big" }, `${score} / ${questions.length}`), h("p", { class: "muted" }, `${pct}% correct`)),
      h(
        "div",
        { class: "toolbar center" },
        h("a", { class: "btn primary", href: `#/quiz/${deckId}`, onClick: () => setTimeout(route, 0) }, "Try again"),
        h("a", { class: "btn", href: `#/deck/${deckId}` }, "Back to deck"),
      ),
    );
  };

  showQuestion();
}

// ---------- Router ----------

async function route(): Promise<void> {
  cleanup?.();
  cleanup = null;
  const [, view, id] = location.hash.replace(/^#/, "").split("/");
  try {
    if (view === "deck" && id) await deckView(id);
    else if (view === "study" && id) await studyView(id);
    else if (view === "quiz" && id) await quizView(id);
    else await homeView();
  } catch (err) {
    mount(errorView(err));
  }
}

window.addEventListener("hashchange", route);
void route();
