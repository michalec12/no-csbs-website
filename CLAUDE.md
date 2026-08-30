# Claude Code Project Instructions

This repository holds two independent projects that happen to share a folder.
Figure out which one your current task belongs to, then jump to that
project's section below — each has its own session log to read first, and
the two are not to be mixed (don't fold website notes into the podcast app's
session log, or vice versa).

- **No CSBS Podcast Companion** (`podcast-app/`) — the podcast production
  tool. See below; unchanged from before this repo had a second project.
- **NO CSBS Website + Kommissioner's Kompanion App** (`site/`,
  `kompanion-app/`) — the league's public website and the commissioner's
  desktop companion app. The app is built and shipped, and its code now lives
  in its own git repo; see that project's hard rules. See below.

---

## Project: No CSBS Podcast Companion

Desktop Electron app for managing the "No CSBS" fantasy football podcast: weekly
rankings, source consensus, accuracy grading, episode/outline prep, branded
graphics export, Discord publishing, mailbag intake, and podcast stats.

### Start every session here

**Read `SESSIONS.md` (same folder) before doing anything else.** It holds
summarized context from previous Claude Code sessions — current feature state,
conventions, known issues, and gotchas that are not obvious from the code.
At the end of any session that changes the app meaningfully, append a new
entry to the top of `SESSIONS.md` (newest first, follow the existing format).

### Hard rules

- **No Windows installer yet.** Do not run `npm run dist` — the owner will
  explicitly call a "confident v1" when it's time. Dev-mode launches only.
- **Never print, log, or type secret values** (API keys, bot tokens, webhook
  URLs) anywhere — chat, tool output, or code. Verify secrets by presence/
  length only. Secrets are encrypted at rest via Electron safeStorage (DPAPI).
- **Database isolation (UPDATED 2026-07-20):** The Windows AppContainer
  shadow-copy that used to isolate Claude-launched Electron processes NO
  LONGER APPLIES — a Claude-launched app writes the user's REAL database at
  `AppData\Roaming\No CSBS Podcast Companion\` (proven: the screenshot tour's
  seed data landed in real data). Isolation is now explicit in code:
  `src/main/index.ts` redirects any `NOCSBS_SELFTEST` run to a separate
  `...\No CSBS Podcast Companion Dev\` userData dir (bootstrapped once as a
  copy of the real DB). Therefore: **never launch the app in normal
  (non-selftest) mode from Claude Code** — self-test modes only. Direct
  real-DB surgery (read-only inspection, cleanup) is possible via
  `ELECTRON_RUN_AS_NODE=1` + better-sqlite3 on a script, but only with the
  app closed, only with tightly-matched criteria, and tell the user exactly
  what was changed.

### Working conventions

- Project code lives in `podcast-app/`. Build: `npx electron-vite build`.
  Type-check: `npx tsc --noEmit -p tsconfig.json` (run from `podcast-app/`).
- Verify changes with the self-test harness, not a browser preview (the
  renderer needs Electron's preload bridge):
  `NOCSBS_SELFTEST=<mode> ./node_modules/electron/dist/electron.exe .`
  Modes are listed in `SESSIONS.md` and dispatched in `src/main/index.ts`.
- Architecture: renderer never touches SQLite. Typed client
  (`src/renderer/src/lib/api.ts`) → IPC (`src/main/ipc.ts`) → services
  (`src/main/services/*.ts`). DB schema + migrations in `src/main/db.ts`
  (use `addColumnIfMissing` for new columns).
- Two-token UI system: "Chalkboard Light" for app chrome; the dark broadcast
  palette exists ONLY inside the graphics template engine. Keep them separate.

---

## Project: NO CSBS Website + Kommissioner's Kompanion App

The league's public website (nocsbs.com — static "dc-runtime" pages plus a
Firebase-backed message board) and the commissioner's desktop companion app
(built; v1.0.0 shipped as a Windows installer on 2026-08-18).

### Start every session here

**Read `WEBSITE_SESSIONS.md` (same folder) before doing anything else.** It
holds summarized context from previous sessions on this project — current
feature state, key decisions, and gotchas not obvious from the code. At the
end of any session that changes this project meaningfully, append a new
entry to the top of `WEBSITE_SESSIONS.md` (newest first, follow the existing
format).

Source briefs (not part of the repo): `C:\Users\micha\Downloads\Fantasy
Football Website Brief.pdf` and `C:\Users\micha\Downloads\
Kommissioners_Kompanion_App_Brief.pdf`.

### Hard rules

- **Never push to the live site** (`netlify deploy --prod`) **or deploy
  Firebase changes that affect real user data without asking first**, even
  though both the Netlify CLI (this machine, `AppData\Roaming\netlify`) and
  Firebase CLI are already authenticated and technically able to do this
  directly. Having the capability isn't standing permission.
- **`kompanion-app/` is a separate git repo** (`michalec12/kommissioners-
  kompanion`, private, branch `main`) that merely sits inside this folder,
  exactly like `podcast-app/`. It is **not** a submodule and this folder does
  not track it — the parent sees a single `?? kompanion-app/`. Run the app's
  git commands from **inside** `kompanion-app/`, and never `git add` it from
  here. **Its `.env` holds the real shared secret and is ignored on purpose** —
  never commit it, never print it, never copy it into a scratch clone. That
  secret is also baked into `out/` and `release/`, which is why those are
  ignored as a security matter rather than as tidiness. The repo is code only:
  this file and `WEBSITE_SESSIONS.md` stay here and are **not** backed up by it.
- The Firebase web config embedded in `site/message-board.js` (apiKey, etc.)
  and the Giphy SDK key embedded in `site/Message-Board.dc.html` are **not**
  secrets in the podcast-app sense — both are meant to ship in public
  client-side code by design (Firebase's security model is its deployed
  rules, not hiding the config; Giphy's SDK keys are meant for client
  embedding). Don't apply the podcast app's "never print secrets" instinct
  to these two specifically.
- `firebase deploy --only firestore:indexes` has proven unreliable in this
  environment — it reports success without actually creating the index.
  Use the `firestore_create_index` MCP tool directly instead, and confirm
  with `firestore_list_indexes` that it reaches `state: READY` before
  relying on a query that needs it.
- The Firebase MCP's `firebase_deploy` tool's `only` param does NOT accept
  CLI-style `service:subtarget` syntax (e.g. `firestore:rules`) — it silently
  no-ops that portion while still reporting `"status":"success"` (confirmed
  2026-07-30: `only: "firestore:rules,storage"` deployed storage but left
  firestore's rules on the old value). Pass bare top-level targets instead
  (`firestore`, `storage`), and always re-fetch the deployed rules via
  `firebase_get_security_rules` afterward to confirm — don't trust the
  reported success alone, same discipline as the indexes gotcha above.
- **The ESPN league API needs no auth and no browser.** League 303458 has
  `settings.isPublic === true`, so a plain server-side `fetch` against
  `lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/303458`
  returns real JSON. Do NOT resurrect the belief that ESPN bot-detection
  requires an Electron in-page fetch — that came from hitting the old dead
  host (`fantasy.espn.com/apis/v3/...`, which serves the SPA shell), and the
  corrected history is in the app's `src/main/services/espn.ts` (its own repo,
  `michalec12/kommissioners-kompanion`). Past
  seasons (`seasons/2025/...` → 401, `leagueHistory` → 404) are still
  unavailable unauthenticated. `isPublic` is now load-bearing for the live
  site — don't flip it. Real ESPN auth is needed only for `mystique-api`
  team logos.
- Firebase project: `my-project-3c848`, Google account
  `michalec501@gmail.com`. Auth is Google Sign-In only, gated by a
  `league_members` Firestore allowlist (doc ID = lowercase email) — nothing
  reads or writes without being on that list and `active: true`.

### Working conventions

- **Comments inside `kompanion-app/` that name `site/`, `functions/`,
  `firestore.rules` or `WEBSITE_SESSIONS.md` are relative to THIS folder, not
  to the app's own repo** — from a clone of that repo they read as dangling
  paths. `kompanion-app/README.md`'s "This repo's neighbours" section is the
  canonical mapping; update it if anything moves. Two things are mirrored
  across the repo boundary with nothing enforcing them: the eight `season_data`
  type shapes (five renamed app-side with a `Season*` prefix) and the `mk-*`
  box-score CSS (`app.css` `.post-body-render` ↔ `site/Post.dc.html`
  `[data-r="post-body"]`). Both fail silently.
- `site/` pages are hand-authored `Name.dc.html` files using the site's own
  pre-existing "dc-runtime" (`support.js`): template HTML with `{{ }}`
  interpolation and `<sc-if>`/`<sc-for>` control tags, compiled to real React
  (React 18.3.1 UMD, loaded dynamically by `support.js` itself). No build
  step, no bundler — don't introduce one.
- Any link between pages that carries client-only state (e.g. a post ID)
  **must use a URL fragment** (`Page.dc.html#value`), never a query string.
  Netlify's clean-URL redirect strips query strings on the way to the real
  file but never touches fragments — this bit us once already (`Post.dc.html`
  showing "not found" for every real post) before the fix.
- Verify locally before touching the live site: `.claude/launch.json` has a
  `site-static` config that serves `site/` via `npx serve` on port 4173.
- The Firebase MCP tools (`firestore_add_document` etc.) run with admin
  privileges and bypass security rules entirely — fine for schema/seeding
  smoke tests, but not a substitute for verifying actual rule enforcement
  from an authenticated client (test with a real signed-in session, or at
  least confirm an unauthenticated client gets `permission-denied`).
- Firebase Auth's default `authDomain` (`my-project-3c848.firebaseapp.com`)
  acts as a shared session relay across any origin using this same Firebase
  project — a real signed-in session shows up identically whether the page
  is served from `localhost:4173` or `nocsbs.com`. Useful for testing, not
  a bug.
