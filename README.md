# 🌱 Grow

A personal learning journal. Capture what you learn by voice or text, let the assistant tidy and file it, and watch your learning curve rise.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS · Framer Motion · Recharts · Lucide · Firebase Auth (Google) and Firestore · Web Speech API

## Getting started

Requirements: Node.js 18 or later.

```bash
npm install
npm run dev          # http://localhost:5173
```

Grow runs out of the box in **Guest mode**, which stores data in Local Storage and uses the built-in on-device assistant. No keys are needed.

To sync across devices, set up Firebase: see [`docs/firebase-setup.md`](docs/firebase-setup.md).

## Features

| Section | What it does |
| --- | --- |
| **Grow** | A daily reflection (one for each day of the year) and a microphone button. The takeaway opens in a confirmation box with the bucket already chosen. Fixed voice commands go straight to their bucket. Titles are Title Cased, and each record is stored with a UTC timestamp. |
| **Learning** | *The Treasure Box.* Buckets are collapsed by default and show a count. Seven starter buckets are created on first use: Life Lessons, Nature, Technology, Culinary, IT Career, Event Management and Others. One top-right **Edit** toggle manages buckets (add, rename, delete; deleting asks where to move the learnings first) and learnings (edit the title, move to another bucket, delete). Outside edit mode, learnings are plain text. Each card has an **Add** row for typing a learning by hand. |
| **Mentors** | Three columns: *Srila Prabhupada*, *Mentors* and *Workshops*, each with a count badge and a milestone line. Expanding a card lists the entries, newest first, with an **Add** row that needs only a name. One top-right **Edit** toggle lets you retitle or delete entries. Dates are recorded automatically and not shown. |
| **Learning Curve** | Four charts: the overall learning curve, plus separate Books, Mentorship and Workshops charts. Periods are calendar-based (Day, Week, Month, Year), and one navigator moves through time. |
| **Settings** | Google sign-in, Guest/Local switch, and light/dark theme. |

### Voice commands

| Say | Filed into |
| --- | --- |
| “Add Bhagavad gita to SP books” | *Srila Prabhupada* |
| “Add Priya Sharma to mentors” | *Mentors* |
| “I attended Public Speaking workshop” or “Add Design Thinking to workshops” | *Workshops* |
| “I learned about compound interest in Finance” | *Learning*, in your *Finance* bucket |
| “I learned about compound interest” | *Learning*, filed by subject (or Others) |

A spoken date such as “… in March 2025” sets the timestamp. Anything else goes through the general parser, which splits “I learned …” takeaways and recognises “add it to Finance”.

## Install as an app

Grow includes a web app manifest (`public/manifest.json`), icons and a service worker, so it installs like a native app and opens full screen.

- **Android (Chrome):** menu ⋮ → **Install app**.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.
- **Desktop (Chrome / Edge):** the install icon in the address bar.

The service worker runs only in production builds. To test offline behaviour, run `npm run build && npm run preview`.

## Cloud sync (optional)

Sign in from **Settings** to sync entries and learning buckets to Firestore. Each user can read and write only their own data (see [`firestore.rules`](firestore.rules)).

- **Firebase setup:** [`docs/firebase-setup.md`](docs/firebase-setup.md) covers the project, Google sign-in, Firestore, rules and `.env`.
- **Google OAuth client ID and secret:** [`docs/google-oauth-credentials.md`](docs/google-oauth-credentials.md) covers where to find them in Google Cloud Console and when you need them.

## Configuration

Copy `.env.example` to `.env` and fill in the values. Vite reads `.env` only at startup, so restart `npm run dev` after editing it.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Firebase web app config. Leave blank for Guest mode. |
| `VITE_AI_PROVIDER` | `anthropic`, `openai`, or blank for the on-device assistant. |
| `VITE_ANTHROPIC_API_KEY` / `VITE_OPENAI_API_KEY` | Provider keys for local use. |
| `VITE_AI_PROXY_URL` | Your own backend that holds the provider key. Preferred for deployment. |

> **Security note:** every `VITE_*` variable is bundled into the browser build and is visible to anyone who loads the app. Use direct API keys only for local, personal use. For a deployed app, route AI requests through `VITE_AI_PROXY_URL`, which receives `{ system, input }` and returns the model's JSON text. If a provider fails, Grow falls back to the on-device assistant.

## Project structure

```
src/
  components/   Shared UI: bucket cards, modal, toasts, sidebar, logo
  context/      AppContext: auth, store selection, buckets, notifications
  lib/          Firebase setup, storage (local and Firestore), AI helper, text and time utilities
  sections/     Grow, Learning, Mentors, Learning Curve, Settings
public/         Manifest, icons and service worker
docs/           Setup guides
firestore.rules Firestore security rules
```

## Data model

Each record is `{ bucket, title, timestamp, source, group }`:

- `timestamp` is an ISO 8601 UTC string, set when the record is created.
- `source` is `voice` or `manual`.
- `group` is the learning bucket id for learnings, or `null`.

No audio is recorded or stored. Older records that use numeric timestamps or legacy fields are normalised when read.

## Notes

- Voice capture needs a Chromium-based browser or Safari, and microphone permission on `localhost` or HTTPS.
- Accounts created before the Learning rename keep their buckets. The Firestore collection is still named `knowledgeBuckets` so existing data loads.

## License

Add a license before publishing. See [choosealicense.com](https://choosealicense.com) for options.
