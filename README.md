# NO CSBS — league website workspace

The public website for the No CSBS fantasy football league (**nocsbs.com**), the
Firebase backend behind it, and the working notes for this project and one other.

This is the workspace folder. Two desktop apps live inside it but are **not part
of this repo** — each is its own repository, and this one ignores them:

| Folder | Its own repo |
|---|---|
| `podcast-app/` | `github.com/michalec12/no-csbs-companion` (private) |
| `kompanion-app/` | `github.com/michalec12/kommissioners-kompanion` (private) |

Commit those from inside their own folders. Never `git add` them from here — the
`.gitignore` excludes them precisely so they cannot be recorded as broken
gitlinks.

## What is here

| | |
|---|---|
| `site/` | The website. Hand-authored `Name.dc.html` pages on the site's own "dc-runtime" (`support.js`) — `{{ }}` interpolation and `<sc-if>`/`<sc-for>` tags compiled to React at load time. **No build step and no bundler**; don't introduce one. |
| `functions/` | Cloud Functions (TypeScript). The in-season ESPN pipeline that pulls the league's data, computes matchups and writes `season_data` documents, plus the callables the Kompanion app signs in against. |
| `firestore.rules`, `storage.rules` | The security model. These are the actual enforcement for both the website and the Kompanion app — the app's writes are gated by `isKompanionApp()` in here, so a deploy of these can break an app that lives in a different repo. |
| `firebase.json`, `.firebaserc`, `firestore.indexes.json` | Firebase project config. Project id `my-project-3c848`. |
| `.claude/` | Local dev wiring — `launch.json` serves `site/` on port 4173 via `dev-server.cmd`. |

## The documentation is the point of this repo

`CLAUDE.md`, `SESSIONS.md` and `WEBSITE_SESSIONS.md` are roughly 215 KB of
accumulated failure modes — the things that were learned the expensive way and
are not derivable from the code. Until 2026-08-29 they existed in exactly one
place, on one disk. That is the main reason this repo exists.

- **`CLAUDE.md`** — instructions and hard rules for both projects in this folder.
  Read the section for whichever project you are touching.
- **`WEBSITE_SESSIONS.md`** — the session log for the website *and* the
  Kompanion app. One log covering both, deliberately: many sessions genuinely
  span `site/`, `functions/` and the app at once, and splitting it would strand
  exactly those entries.
- **`SESSIONS.md`** — the podcast companion's log. Separate project, separate
  log; don't mix the two.

## Running the site locally

```
npx serve site -l 4173
```

or use the `site-static` configuration in `.claude/launch.json`. There is no
build step — the pages are served as-is.

## Two rules worth knowing before you touch anything

**Never deploy without asking.** Both the Netlify CLI and the Firebase CLI are
authenticated on this machine and technically able to push to the live site and
to real user data. Having the capability is not standing permission. See
`CLAUDE.md` for the full set, including the Firebase MCP gotchas that have
already cost real time.

**The Firebase web config in `site/message-board.js` and the Giphy SDK key in
`site/Message-Board.dc.html` are not secrets.** Both are meant to ship in public
client-side code — Firebase's security model is the deployed rules, not hiding
the config object. Don't file either as a leak. Real secrets live in Google
Secret Manager and in gitignored `.env` / `.secret.local` files that are not in
this repo.
