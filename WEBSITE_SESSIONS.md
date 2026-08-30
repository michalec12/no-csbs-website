# Session Log — NO CSBS Website + Kommissioner's Kompanion App

Newest entries first. Each entry: date, what changed, decisions made, open
items. Future sessions: read the top entry (at minimum) before starting
work; append a new entry here when a session meaningfully changes this
project. Do not add entries here for podcast-app work — that project keeps
its own separate `SESSIONS.md`.

---

## 2026-08-29 — kompanion-app extracted to its own private repo

**Where things now live, and this is the part to remember:**

| | |
|---|---|
| App **code** | `github.com/michalec12/kommissioners-kompanion` — private, branch `main`, tagged `v1.0.0`, 55 files |
| App **docs** | **This file and `CLAUDE.md`. They are NOT in that repo.** |
| `site/`, `functions/`, `firestore.rules`, `storage.rules`, `firebase.json` | still here, still untracked |

**To work on the app: `cd kompanion-app` first.** Commit from inside it. Never
`git add` it from the parent — it is a plain nested repo, not a submodule, and
the parent shows it as a single `?? kompanion-app/`. Same arrangement
`podcast-app/` has had all along.

The app had **never been under version control at all** — 54 files, no history,
one bad disk from gone, with a v1.0.0 installer already shipped. That is what
this fixed.

### Why the log wasn't split

21 entries, 77 mentions of kompanion, and many entries genuinely span
site + functions + app in one session (the whole in-season ESPN pipeline). One
log covering both, unchanged. Splitting it would strand exactly the entries
that matter most.

### What was deliberately left out of the repo

`.env`, `node_modules`, `out`, `release`, `*.tsbuildinfo`. The `.env` holds the
shared secret for `mintKompanionAppToken`; recover it with
`firebase functions:secrets:access KOMPANION_APP_SHARED_SECRET`. **That secret
is also baked into `out/main/index.js` and into `release/`'s `app.asar`** — I
confirmed it by a filename-only scan — which is why those two are ignored as a
security matter, not merely as tidiness. Five gates ran before the first commit,
including `check-ignore -v` proving each rule fires by line number and a
filename-only scan for 64-hex strings across every staged file.

### The 38 dangling references, and the README that answers them

The app's source references things its repo does not contain **38 times**: 8 to
this file, 12 to `site/`, 14 to `functions/`, 4 to `firestore.rules`. podcast-app
got away with the same doc arrangement because its source references its session
log **zero** times; kompanion's does not.

So `kompanion-app/README.md` is new and load-bearing, not decoration. Its
**"This repo's neighbours"** section maps the vocabulary once — that is the fix,
rather than rewriting 38 comments and risking a wrong path in each. It also
records the runtime dependency the repo cannot show: three deployed Cloud
Functions, and an `isKompanionApp()` gate in rules that live over here, where a
deploy can break the app with no change in its repo.

### Two cross-repo mirrors, now named as such

Neither is enforced by anything, and both fail silently:

1. **Eight `season_data` type shapes.** Five are renamed app-side with a
   `Season*` prefix, so grepping the same name across the two repos finds
   nothing. Both sides now spell out the repo and the full rename mapping.
2. **The `mk-*` box-score CSS** — `app.css` `.post-body-render` ↔
   `site/Post.dc.html` `[data-r="post-body"]`. This one was implicit before and
   is the more fragile: CSS has no typechecker, and the app's Preview pane is
   the only place a recap is checked before publishing, so a drift makes the
   preview *lie* rather than break.

### Comments corrected over here

`functions/src/season/espnMatch.ts` said to keep `ESPN_TEAM_MAPPING` in sync
with the app's copy — **there is no copy**; that setting was deleted when this
pipeline took the mapping over. Dead instruction, now says so. `espnMatch.ts`
and `matchupCompute.ts` both claimed to be "PORTED VERBATIM" from app files
that no longer exist; reworded as provenance, and `matchupCompute.ts` now
records the coupling that *is* live — the app flips every matchup so the winner
is side A, so do not "fix" the order here to match what the app displays.
`types.ts`'s "Ported from" heading over-claimed by covering three names that no
longer exist app-side.

**These parent-folder edits are NOT commits** — this folder still has zero
commits. Don't go looking for one.

### The one behaviour change

`currentSeasonLabel()` derived the season in **local** time while the Cloud
Function that writes `season_data/<espnSeasonId>` derives it in **UTC**. Applying
`label = espnSeasonId + 1` the rules are otherwise identical, so they agreed
except in the window where local and UTC months differ — roughly 19:00 to
midnight Central on 31 July. In that window the app asks for a document the
pipeline has not written and shows an empty season with no error. The producer
owns the doc-id namespace, so the app moved to UTC. Verified across 144 instants
spanning a year: zero mismatches.

**Verified:** 55 blobs on the remote per GitHub's own tree API, no
`node_modules`/`out`/`release`/`.env`/`.asar`/`.exe` path anywhere in it, repo
confirmed `isPrivate=true` *before* the first push, tag `v1.0.0` annotated to
match podcast-app's form, `npm run typecheck` clean after every commit.

### Open items

- **Nothing but the two apps is backed up.** `CLAUDE.md`, `SESSIONS.md` and this
  file are ~215 KB of accumulated failure modes existing in exactly one place.
  This change makes that gap sharper, not smaller. The parent's `origin` is
  `michalec12/my-project`, which is **PUBLIC** — a real reason for caution and a
  separate decision. A second private repo, or private Gists for the three
  markdown files, avoids the question entirely.
- The durable fix for the season boundary is to stop deriving it client-side at
  all: `season_data` documents already carry `meta.seasonId`, so the app could
  read the pipeline's answer instead of recomputing it. That removes the
  invariant rather than documenting it.
- `release/` stays here: 555 MB, and its `app.asar` carries the live secret.
  Inert while this folder is untracked; the first thing to check if that changes.

---

## 2026-08-18 — v1 installer shipped; uninstall cycle finally run, and it was broken

Owner gave the "confident v1" go-ahead. Built the first real Windows
installer, reviewed the season pipeline that had landed since the prior
review, and ran the install/uninstall cycle that had been written-but-never-
executed since 2026-07-27. Version bumped 0.1.0 -> 1.0.0.

**Correction to the 2026-07-30 entry below**: that review covered a stale
snapshot. Several files read during it (ipc.ts, espn.ts, api.ts, Compose.tsx,
Settings.tsx, types.ts, settings.ts, compose.ts, index.ts, selftest.ts) were
older than what was on disk, and the whole season pipeline
(shared/season.ts, shared/seasonMapping.ts, main/services/season.ts,
main/services/kompanionAuth.ts, renderer/src/lib/seasonData.ts,
functions/src/season/*) was never seen at all. The two fixes that entry
claims for `matchupCompute.ts` do not describe the shipping app -- that file
no longer exists app-side; the logic moved to functions/src/season/ and the
copy there already carries both. Reviewed properly this pass.

**Four real bugs found and fixed, three of them only findable by running the
installer rather than reading it:**

- **`${APP_FILENAME}` resolves to package.json's `name`, not `productName`.**
  This is the assumption flagged as unverified since 2026-07-27, and it was
  wrong. The uninstaller was pointed at `$APPDATA\kommissioners-kompanion`
  while Electron's real userData folder is `$APPDATA\Kommissioner's
  Kompanion`. Both branches silently did nothing useful: "Keep" created an
  empty `kommissioners-kompanion Backup` folder and copied nothing (source
  path didn't exist), and "No" would have wiped a folder that isn't the app's
  data, leaving everything behind while reporting a clean uninstall. Fixed by
  hardcoding the literal productName folder in `build/installer.nsh` (must
  stay in sync with package.json's productName AND backup.ts). Re-ran the
  cycle: `backup.json` now lands in the sibling folder correctly.
- **No single-instance lock.** Launching the app twice ran two full instances
  against one userData profile, producing exactly the symptoms this project
  chased three times and blamed entirely on force-killing: "Unable to move
  the cache: Access is denied", "Could not open the quota database,
  resetting", "Database IO error". Reproduced deliberately (8 processes, two
  start times, error cascade), fixed with `requestSingleInstanceLock()` +
  a `second-instance` focus handler, re-verified (1 windowed instance, second
  launch exits silently, **zero** error lines). Force-killing was a real
  cause; a commissioner double-clicking the desktop icon is another, and it
  needed no misbehavior at all. Skipped under KOMPANION_SELFTEST so the
  harness still runs modes back-to-back.
- **The restore banner could never appear.** App.tsx gated on
  `settings.espnLeagueId === null`, which stopped being reachable the moment
  settings.ts shipped a pre-filled League ID default (2026-07-28) --
  getSettings() coalesces, so it is never null. The uninstaller half was
  preserving data faithfully into a folder the app would never offer to
  restore from. Replaced with a real signal: `isFreshInstall()` in backup.ts
  (does settings.json exist in THIS userData folder?), returned from
  `checkForRestorableBackup()`. Added a permanent assertion to the
  `backuprestore` self-test, since the file round-trip passed throughout the
  entire time the gate was dead.
- **The `backuprestore` self-test was destroying real data.** Its own
  comments claim it is "deliberately non-destructive to real data." It
  wasn't: `restoreBackupPath()` hardcoded the productName folder, and since
  `dirname()` of both the real and `...Emulator` userData is the same
  AppData\Roaming, the emulator profile resolved to the *real* install's
  restore-backup location and cleaned it up. Caught by noticing a
  verified-present `backup.json` had vanished after a routine self-test run.
  Fixed by deriving from `basename(userDataDir())` -- production stays
  byte-identical to installer.nsh's hardcoded path, emulator gets its own
  `...Emulator Backup`. Verified with a seeded marker file that now survives.

**Two smaller fixes**: the app aborted the manual season refresh at 300s while
the Cloud Function is allowed 540s, so a long backfill would show a failure
for a refresh that actually succeeded (raised to 560s); and StandingsTable
rendered an empty gold-framed box for `[]` because it only checked `!standings`
(buildStandings returns `[]`, never null, when the season snapshot is missing).

**Silent-uninstall guard added**: NSIS renders MessageBox even under `/S`, so
an unattended uninstall would have blocked forever on an invisible prompt --
not hypothetical, electron-builder's own update flow uninstalls silently.
`IfSilent` now takes the keep-data branch (safe default when there's no human
to ask).

**Verified end-to-end**: full install -> launch -> uninstall cycle run
repeatedly against the real machine. Packaged app boots with zero errors,
reads the same `AppData\Roaming\Kommissioner's Kompanion` folder the dev
shortcut used (so the commissioner's settings/ESPN session/drafts carry over),
graceful window close fully exits the process tree, uninstall preserves
userData and writes the sibling backup. Real userData backed up before testing
and confirmed byte-identical afterward. Both projects typecheck clean.

**Season pipeline reviewed, no changes needed**: the auth rework (server-minted
custom token with a durable `kompanionApp` claim, replacing the drift-prone
pinned anonymous UID) is a genuine improvement and removes the class of
lockout that IndexedDB corruption used to cause. `mintKompanionAppToken` uses
a timing-safe, SHA-256-normalized secret comparison. `seasonMapping.ts`
correctly inverts the head-to-head record when it flips a matchup to
winner-left -- the subtle bug its own comment warns about. Starters-only
filtering (owner confirmed the roster: 1 QB/2 RB/2 WR/1 TE/2 Flex/1 D-ST/1 K,
6 bench, 2 IR) is correct, cross-checked against the league's live
`lineupSlotCounts`. Wire types are duplicated between app and functions but
currently identical.

**Known, accepted**: the shared secret is extractable from the .exe (owner
reviewed and accepted -- single trusted recipient). Still open from before:
whether a real scored player's roster entry reports the same `lineupSlotId`
is only answerable at Week 1, and if it's wrong every score on the site is
wrong. The `restorebannerscreenshot` self-test now needs the Firebase
emulators running (the auth mint calls a Cloud Function), so the banner's
positive case wasn't visually confirmed this pass.

**Owner action**: installer is at `kompanion-app/release/Kommissioner's
Kompanion Setup 1.0.0.exe` and is also installed on this machine. The old
`Kommissioner's Kompanion (Beta).lnk` desktop shortcut still points at the
dev-mode electron.exe and is now redundant -- worth deleting to avoid
launching the wrong one.

---

## 2026-08-17 (2) — Kompanion switched to the Firestore pipeline; ESPN demoted to logos only

Direct continuation of the entry below. With the weekly pipeline live, the Kompanion app was
still doing its own ESPN pull and its own stat computation on every "New Post" — a second,
independent copy of `matchupCompute.ts` that could silently disagree with the one the website
uses. Owner asked to switch the app to consume the pipeline, with a manual re-pull for when
the Tuesday run isn't enough. Planned in Plan Mode; owner chose Firestore-only compose (no
ESPN fallback), h2h moved into the function, logos seeded into Firestore from the app, and the
full cleanup including the transport swap — plus two explicit instructions: **delete any
Settings field the change makes unnecessary**, and **a season is named for the year it ENDS**.

**Season naming is now defined, not just an offset.** The site has always displayed `year + 1`
(`league-data.js:260`, `Home.dc.html:278`) with no stated reason. It has one: the league names
a season for the year it *ends*, so the upcoming season is "the 2027 season" while ESPN calls
it 2026. New `kompanion-app/src/shared/season.ts` makes both directions explicit
(`currentSeasonLabel()` / `espnSeasonId()`), and the app now shows only the label — the ESPN id
is an implementation detail confined to Firestore paths and ESPN URLs. **This fixed a real
latent bug**: `settings.ts` defaulted `espnSeason` to a bare `new Date().getFullYear()` with no
offset at all, which is correct only Aug–Dec; every January it would have started reading a
`season_data` document the pipeline never writes, with no visible error. Verified across the
year boundary (Aug 2026 → Jul 2027 all resolve to label 2027 / seasonId 2026).

**Function side (deployed first, purely additive)**: `ResolvedMatchup` gained `history`, joined
from `manager_history/h2h` — read **once per refresh**, not once per matchup, replacing ~5
`getManagerHistory` callables the app fired on every pull. `buildTeamInfo` gained a logo-override
parameter, and `refreshSeasonData` now reads a new `season_data/{id}/logos` subcollection and
substitutes those into standings. New rules block grants `write: if isKompanionApp()` on that
one path — still the only writable path under `season_data`.

**The trap that would have shipped silently**: `season_data` stores ESPN's real away/home order
with a real `'A' | 'B' | 'tie'` winner, but the app guarantees "side A is always the winner" —
an invariant `MatchupCard.tsx:181` and `postAssembly.ts:209` rely on so completely that they
**hardcode side B as the loser**. A matchup the home team won arrives as `winner:'B'` and has to
be flipped: scores, manager ids, team names, top scorers, over/under performers, **and the
head-to-head record**, which is stored from the away manager's point of view and therefore
inverts too. Miss any one and the published recap is confidently, invisibly wrong. Deliberately
fixed at the app's mapping boundary rather than in the function — the website's scoreboard wants
true away/home order.

**Because that trap can't be exercised by real data until a week is actually played** (and by
then a mistake is already published), the reshape was extracted into a pure
`src/shared/seasonMapping.ts` — same "pure, no I/O" convention the deleted `espnMatch.ts` and
`matchupCompute.ts` followed — and covered by a new fixture-driven `seasonmapping` self-test:
18 assertions over a home-win, an away-win, a tie, and an unresolved-manager case. The h2h
inversion it asserts (josh 20-11 brent) matches what `manhist` independently returns from the
real callable.

**Deleted from the app, not deprecated**: the entire "ESPN Team ↔ Manager Matching" card and its
handlers, `AppSettings.espnTeamMapping`, `src/shared/espnMatch.ts`, `src/main/services/matchupCompute.ts`,
and the `espn:fetchTeams` / `fetchWeekMatchups` / `fetchStandings` channels. The function resolves
manager ids itself (name matching, verified 10/10, with its own hardcoded fallback), so none of
it had a consumer left. **Deleting the app's `matchupCompute.ts` is what actually eliminates the
drift risk** — the claim in the previous entry is now true rather than aspirational. Manager
display-name masks lived *inside* the deleted matching table, so they were rehomed to their own
roster-driven card. Also switched `getSettings()` from a spread to explicit field construction:
the spread was carrying dead keys forward indefinitely (confirmed — `espnTeamMapping` was still
being echoed after removal) and let a persisted `null` beat a correct default.

**Transport swapped to plain `fetch`.** The hidden-BrowserWindow JSON path is gone, along with
`getApiWindow()` and the `executeJavaScript` string building. The one thing that genuinely still
needs a real ESPN session — the `mystique-api` team logos — now runs in a **create-use-destroy**
window. Because nothing outlives the main window any more, `main/index.ts`'s `app.exit(0)` hack
(23 lines of comment explaining a beforeunload prompt hanging shutdown on an invisible window)
was replaced with an ordinary `app.quit()`.

**That removal was verified, not assumed.** The new `logosync` self-test creates a real ESPN
page, fetches the auth-gated logo, downscales it, writes it to Firestore, and then quits — so a
leaked window would make the test *hang* rather than surface on the commissioner's machine
later. Ran under `timeout`: exit code 0, and `Get-Process electron` reported 0 before and after.

**Real Disconnect bug fixed**: `clearEspnLoginSession()` cleared only the session partition, so
`espn-auth.json` survived and `espnConnectionStatus()` reported "connected" again on the next
launch — the UI silently reverted. `clearEspnAuth()` existed for exactly this and had **zero
callers** (grep-confirmed). Now wired up.

**Logo seed ran for real**: exactly one team needed it (11, "Colston LoveIsLand"), resolved to a
30 KB PNG data URL and written to `season_data/2026/logos/11`. Confirmed publicly readable and
still `403` to an anonymous write. The function substitutes it into standings on its next run —
that substitution is unit-tested but can't be confirmed end-to-end until Week 1, since the
off-season guard means standings aren't written at all yet.

**Accepted, owner-chosen tradeoff, worth remembering**: there is now **no way to compose a recap
for an in-progress week**. The function only writes a week doc once ESPN moves past it
(`min(latestScoringPeriod, currentMatchupPeriod - 1)`), and the manual refresh can't change that
— an unfinished week has no final scores. The old ESPN path could pull mid-week with partial
scores. Compose now fails with a specific, actionable message naming which weeks *do* have data.

**Self-tests**: added `seasondata` (asserts the read resolves **without** `anonReady` — the
deliberate deviation that keeps compose off the one-shot token mint that poisons permanently on
failure), `seasonmapping`, `seasonrefresh`, `logosync`. Deleted `espnmatch` (feature gone).
Updated `composenewpost` (a missing week doc is now a valid pre-season pass; it also asserts
winner-left on real data once that exists) and `espn` (dropped the three leagueHistory probes
that only ever logged failures). Fixed `settingsscreenshot`, which was only ever capturing the
viewport and silently never verified anything below the fold — it now reports the rendered card
and button list and shoots top *and* bottom, scrolling the real inner container rather than
`window` (which did nothing and produced a "bottom" shot identical to the top).

**Regression set all green**: `boot`, `draftroundtrip`, `mintauth`, `authpersist`, `manhist`,
`composescreenshot`. Zero drafts created by any of it — `composenewpost` now throws *before*
`drafts:create` runs, so the old create-then-delete orphan path is gone.

**Noticed, not acted on**: the real drafts folder is up to **38** drafts, mostly old self-test
artifacts (previous entry flagged this at 7+). The owner's own "Delete All Drafts" button
clears them. Also added `*-screenshot.png` to `kompanion-app/.gitignore` — self-test
screenshots were not ignored, and this repo still has no commits, so they'd have been swept
into the first one.

**Owner action**: none blocking. Nothing is deployed to the live site this pass (no `site/`
changes). The Week 1 `BENCH_SLOTS` check is still the real gate — and note that the app and
website now share one computation, so if it's wrong they'll be wrong *together*: easier to
spot, no less wrong.

---

## 2026-08-17 — In-season ESPN pipeline shipped: "This Season" page, scheduled Cloud Functions, live scoring

Owner asked whether ESPN league data could be pulled via an API and, if so, to plan an
automated weekly refresh so the site could carry in-season content alongside its purely
historical pages. Planned in Plan Mode first; owner approved the plan and all three deploys.

**The headline finding, and it invalidates a long-standing assumption in this repo: ESPN's
league API is reachable with a bare `curl` — no cookies, no browser, no Electron.** Verified
directly against the real league: `settings.isPublic === true`, so
`lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/303458`
returns HTTP 200 + real JSON unauthenticated. Gzipped payloads: mSettings+mStatus 1.7 KB,
mTeam 7 KB, mMatchupScore 62 KB, mBoxscore 55 KB (mRoster is 1.1 MB — never request it).
CORS is wide open too — ESPN reflects the request Origin (`Access-Control-Allow-Origin:
https://nocsbs.com`) with a working preflight, so a browser-direct call is possible (noted,
not used; server-side polling is free anyway and strictly better).

**`kompanion-app/src/main/services/espn.ts:50-63`'s "escalation history" comment was wrong
and has been corrected in place.** It concluded that Node's `fetch` and Electron's
`net.request` were blocked by ESPN bot detection keying on sec-fetch-*/Origin/Referer, and
that only an in-page `executeJavaScript` fetch works. Those 202s were against the OLD dead
host (`fantasy.espn.com/apis/v3/...`); the attempts predate the `espnsniff` self-test that
found `lm-api-reads`, and the transport was never retested once the URL was fixed. **Wrong
host, not wrong transport.** The comment now also records that this league's reads need no
auth at all — `requestJson`'s `getStoredEspnCookies()` check is a gate only, and the cookies
were never actually attached to those JSON calls (no Cookie header, no `credentials`, and
the API is a different origin from the carrier page). Real ESPN auth is genuinely required
only for `mystique-api` team logos. **The transport itself was deliberately NOT changed** —
it works, and destabilizing it three weeks before the draft would be reckless. That swap is
an off-season job; see "Kompanion follow-ups" below.

**Past seasons remain unavailable**: `seasons/2025/...` → 401 "not authorized";
`leagueHistory/303458` → 404 in every variant tried (with and without the kona headers).
Irrelevant to this work — the site already has 2008–2025 baked into its static files. One
untested angle worth a cheap experiment later: the 401 was assumed in a prior session to be
a wrong-endpoint-shape problem, but we now know `seasons/{year}` IS the right shape, so it
may just be a real permissions response the commissioner's own cookies would satisfy. If it
works, historical box scores open up.

**New: `functions/src/season/`** — 7 modules, no new dependencies (Node 22's global fetch).
`matchupCompute.ts` and `espnMatch.ts` were ported **verbatim** from kompanion-app (only the
type import path changed) — they were already pure, which is exactly why they lifted cleanly.
`espnClient.ts` asserts a JSON content-type specifically so a regression to the SPA-shell
host fails loudly instead of silently. `odds.ts` is a 20k-sim Monte Carlo using the league's
REAL settings read from mSettings (14-week season, 6 playoff teams, `TOTAL_POINTS_SCORED`
seeding tiebreak, weeks 15–17 bracket with seeds 1–2 on bye), with team scoring regressed
toward the league mean early (`n/(n+4)`) so 1–2 game samples don't produce absurd swings, and
a seeded PRNG so re-running produces identical odds rather than jitter.

**Two scheduled functions, deliberately 2 not 3** — Cloud Scheduler's free tier is 3 jobs:
- `refreshSeasonData` — `0 6 * * 2` America/Chicago (Tuesday, after ESPN settles stat
  corrections). Full compute; always recomputes the most recent completed week (corrections
  land for days) and backfills any missing older week.
- `refreshLiveScores` — `*/10 12-23 * * 0,1,4` (one cron across Sun/Mon/Thu rather than three
  jobs). Pulls mMatchupScore only and writes a small separate `live` field so the 10-minute
  poll never rewrites the large week documents.
- `triggerSeasonRefresh` — onRequest, gated on the **existing** `KOMPANION_APP_SHARED_SECRET`
  rather than a second auth mechanism. Needed to verify a deploy without waiting for Tuesday,
  and to force a backfill. Both paths tested: correct secret → 200, wrong secret → 401.

**Week-completion rule worth remembering**: `latestScoringPeriod` alone is wrong — it advances
as soon as a week's first game starts, so using it would lock in half-played scores and skew
the odds badly. The pipeline uses `min(latestScoringPeriod, currentMatchupPeriod - 1)`.

**Free-tier math** (owner's condition for live scoring): ~940 invocations/mo vs 2M free, ~700
GB-sec vs 400k, ~3k Firestore writes/mo vs 20k/**day**, 2 scheduler jobs vs 3. Inbound ESPN
data is free (Google doesn't bill ingress). Not close to any limit.

**`firestore.rules` gained its FIRST public-read grant** — `season_data` (+ its `weeks`
subcollection), read `if true`, write `if false` (the functions use the Admin SDK, which
bypasses rules). Justified in the rules file itself: this is the same standings/score data
the site already publishes openly as static files, just current instead of historical, so
gating it would be *more* restrictive than the status quo. **Verified from a genuinely
unauthenticated client** (raw Firestore REST, not the admin-privileged MCP tools, which
bypass rules): `season_data` → 200, while `posts` / `league_members` / `manager_history` all
still → 403. The new grant is exactly as narrow as intended.

**New page `site/This-Season.dc.html`** + `site/season-data.js` (reactive
`window.NOCSBS_SEASON`, modeled directly on `message-board.js`, but with no auth since these
reads are public). Page carries the scoreboard with a week selector, live standings, weekly
superlatives, week high score (shaped to match `pot-data.js`'s existing record format), and —
per owner — **power rankings and title odds combined into one panel** rather than a separate
odds chart, with both `madePlayoffsPct` and `titlePct` columns. Nav label "This Season",
positioned between Home and Message Board across all 11 files.

**Home's AI odds board removed with no replacement**, per owner. `ai-pick-data.js` stays on
disk as the pre-season odds seed but is no longer loaded by Home. Found and removed a
**vestigial empty `<sc-if value="{{ hasAiPick }}"></sc-if>` pair** left in the hero from an
earlier refactor — harmless but dead, and it referenced a now-deleted variable. It was missed
by a first grep because the surrounding comment said "ODDS" in caps; worth remembering that
this codebase's markup comments are uppercase and case-sensitive greps will skip them.

**Verified before deploying** via a scratch harness against real live ESPN data: 10/10
managers matched by name, and the resolved ids match the hardcoded `ESPN_TEAM_MAPPING`
exactly — two independent methods agreeing. Odds sanity: playoff percentages sum to 600
(6 spots), title to 100, identical on re-run. A synthetic played-week fixture confirmed the
transform logic real 2026 data can't reach yet: bench/IR excluded, week filtering correct
(a decoy week+1 entry properly ignored), awards and high score correct. One real bug caught
this way — the `showBoard` `<sc-if>` was never closed (6 open / 5 close).

**Deployed, in order, each verified before moving on**: Firestore rules (re-fetched to
confirm they landed, per the standing MCP-deploy gotcha) → functions (all 3 new confirmed
live, nodejs22) → `triggerSeasonRefresh` seeded `season_data/2026` (off-season guard fired
correctly: `latestCompletedWeek: 0`, meta only, `weeksWritten: 0`) → `npx netlify-cli deploy
--prod --dir=site`, exactly **13 files** uploaded (11 `.dc.html` + `season-data.js` +
`message-board.js`'s stale comment), nothing unintended. Live on nocsbs.com, reading real
Firestore data, zero console errors.

**A verification gotcha that briefly looked like a failed deploy**: `curl` against
nocsbs.com showed 0 "This-Season" links on 8 of 11 pages. Not a deploy problem —
**Netlify's pretty-URL processing rewrites hrefs in the served HTML**, turning
`href="Members.dc.html"` into `href='/members.dc'` (lowercased, extension stripped,
single-quoted). Greps against production must use the rewritten form. Also note the clean URL
is `/this-season.dc`, NOT `/This-Season` (which 404s) — `.html` is stripped, `.dc` is not.
Home was the one page that matched the raw string, only because of an HTML comment.

**Open, and the real gate — Week 1 (~Sept 8–15)**: `BENCH_SLOTS = {20,21}` in
`matchupCompute.ts` is still confirmed only against the league's configured *slot counts*
(mSettings), never against a real scored player's own `lineupSlotId`. If it's wrong, every
score and every "top performer" on the live site is wrong. Verify against a real played week
before trusting anything the page shows. Also spot-check computed scores against ESPN's own
site for all 5 matchups, and confirm the Tuesday cron and the Sunday live poll actually fired
(`functions_get_logs` — don't assume).

**Kompanion follow-ups, deliberately deferred to the off-season** (do NOT do these
mid-season): drop the cookie gate on league reads (fixes the recurring "every reinstall
forces a fresh ESPN login" pain, since `espn-auth.json` can never be restored from backup);
replace the hidden-BrowserWindow transport with a plain fetch (deletes `getApiWindow()`, the
`executeJavaScript` string building, and the hidden-window shutdown hack in `index.ts:44-65`);
demote the ESPN login to optional ("improves team logos"); and the bigger win — have Kompanion
**read `season_data` from Firestore instead of pulling ESPN and recomputing**, which makes
"New Post" near-instant, pre-fills recaps with the already-computed awards/high score/power
movement, guarantees the app and site show identical numbers, and removes the
`matchupCompute.ts` two-copy drift risk. Also a real incidental bug found:
`clearEspnLoginSession()` (`espn.ts:38`) clears the session partition but never deletes
`espn-auth.json` — `clearEspnAuth()` exists in `espnAuth.ts:58` and is never called, so
"disconnect" leaves stored credentials on disk.

**Not yet built** (planned Phase 4/5, needs real data first): pot-tracker auto-append on Home,
and merging in-season results into the career-records pages (`league-data.js` aggregates,
Manager Records, The Pantheon) — that one should stay additive and clearly labeled
("incl. season in progress"), never silently mutating history.

**Owner action**: none blocking. Live and verified. The one thing that genuinely matters is
the Week 1 `BENCH_SLOTS` check. Also worth knowing: **`isPublic: true` on the ESPN league is
now load-bearing** — flipping it to private breaks the unauthenticated pulls (recoverable by
adding stored cookies to the function, but don't flip it casually).

---

## 2026-07-30 (3) — Kompanion identity redesigned: server-assigned, not a pinned client UID

Direct continuation of the entry below. After the 4th UID re-pin that same session, owner
asked the obvious follow-up: won't this exact bug recur the moment v1 installs on the
commissioner's own separate machine (a fresh profile always mints a new anonymous uid)?
Yes — confirmed as a valid, near-certain-to-recur concern, not a false alarm. Presented
two real fixes (real Google Sign-In reusing the website's existing `isCommissioner()`/
`isAdmin()` rules, vs. a Cloud-Function-issued service identity gated on a shared secret)
with pros/cons; owner picked the shared-secret approach specifically to keep the app's
"no login required" design intact. Planned properly first (Plan Mode, one Plan-agent
research pass) before touching anything, given real production security rules were
involved twice more.

**New design**: `firestore.rules`/`storage.rules`' `isKompanionApp()` no longer checks a
hardcoded client-generated anonymous uid at all. Instead, a new Cloud Function
(`functions/src/index.ts`'s `mintKompanionAppToken`, `onRequest`, gated on a
`defineSecret('KOMPANION_APP_SHARED_SECRET')`) verifies a fixed shared secret baked into
the built app and, if valid, mints a Firebase custom token for a **server-assigned**
fixed uid (`kompanion-app-service-account`) carrying a `kompanionApp: true` custom claim.
The rules now just check `request.auth.token.get('kompanionApp', false) == true` — no
uid anywhere. Since the identity is assigned by the server based on possession of the
secret rather than generated locally by whatever a given machine's browser profile
produces, it's now identical on every machine, every reinstall, forever — this whole
class of bug (four re-pins in three days) cannot recur.

**Belt-and-suspenders claim durability**: `createCustomToken(uid, claims)`'s
`developerClaims` argument is only guaranteed present on that one initial token, not
confirmed to survive the session's later silent hourly refresh. Rather than risk the app
silently losing write access mid-session, `mintKompanionAppToken` also calls
`setCustomUserClaims(uid, claims)` (self-provisioning the user record via `createUser`
first if it doesn't exist yet) — durably attaches the claim to the user record itself, so
every future refreshed token carries it regardless. Empirically confirmed working via a
forced-refresh check in the new `mintauth` self-test (`getIdTokenResult(user, true)`,
claim still present) — the uncertainty didn't need to be worked around, it got resolved.

**Secret handling**: generated via Node `crypto.randomBytes(32)`, set in Cloud Secret
Manager (`firebase functions:secrets:set`) and written to `kompanion-app/.env`
(`MAIN_VITE_KOMPANION_SHARED_SECRET=...`, gitignored) in the same single non-interactive
shell command — the actual value was never printed to chat or tool output at any point,
consistent with the standing "never print secret values" discipline. Baked into the
compiled **main-process** bundle only (not renderer) via electron-vite's built-in
`MAIN_VITE_` env-prefix mechanism (confirmed by reading the installed `electron-vite`
source directly — no `electron.vite.config.ts` changes were needed, and critically it's
`import.meta.env.MAIN_VITE_X`, not `process.env.X`, which stays a genuine runtime
passthrough in main for unrelated reasons like `KOMPANION_USE_EMULATOR`). Mint call
happens from **main**, not the renderer (`main/services/kompanionAuth.ts`, new
`auth:mintKompanionToken` IPC channel), specifically so the raw secret never enters the
renderer's DevTools-reachable bundle. `kompanion-app/.env.example` (checked in, no real
value) documents the var for any future setup. Known, accepted trade-off: `app.asar` is
unencrypted, so the secret is recoverable by anyone with real local access to the
installed app — acceptable for this threat model (single trusted commissioner machine),
same bar already accepted for the Firebase web config elsewhere in this repo.

**Real deploy-time blocker, not a code bug**: the function deployed and correctly
validated the secret (confirmed both reject/accept paths independently), but minting
itself failed with `Permission 'iam.serviceAccounts.signBlob' denied` — a well-known,
one-time GCP setup gap where Cloud Functions' default compute service account lacks
permission to sign JWTs on its own behalf. No available tool could grant this (no `gcloud`
locally, no IAM MCP tool) — correctly treated as the owner's call rather than attempting
a workaround, since it's genuine access/security configuration. Owner ran one `gcloud iam
service-accounts add-iam-policy-binding ... --role=roles/iam.serviceAccountTokenCreator`
in Cloud Shell; took about a minute to propagate (matches Google's documented IAM
propagation delay), confirmed via a background-polling retry loop rather than guessing.

**Four-phase, zero-downtime rollout**, each deploy re-verified against real production
before moving on (never trusted a reported "success" alone, same discipline as always):
1. Deploy the new function alone (purely additive) — verified directly via HTTP (wrong
   secret → 401, correct secret → a token with the right uid/claim).
2. Deploy transitional rules accepting *either* the old pinned uid *or* the new claim —
   re-ran `authpersist`/`manhist`/`espnmatch` against the *old, not-yet-rebuilt* app to
   confirm zero behavior change.
3. Ship the app code (`lib/firebase.ts`'s `anonReady` now mints fresh through the new IPC
   flow instead of `signInAnonymously()`), rebuild, confirm the real secret is actually
   baked into `out/main/index.js` (grepped for it directly, presence-only, never printed),
   then a new `mintauth` self-test mode proved the whole chain end-to-end against real
   production — including the claim surviving a forced token refresh.
4. Drop the old-uid fallback entirely, deploy the final rules, re-verify `mintauth` +
   `manhist` + `espnmatch` once more (including a re-run of `espnmatch` specifically,
   since that's the exact code path the original "Manager Match... Missing or
   insufficient permissions" report came from).

**One real self-inflicted incident, caught immediately**: a stray shell command
accidentally omitted `KOMPANION_SELFTEST`, launching the real app in normal mode (a real
visible window against real production) instead of a self-test. Caught via `Get-Process
electron`, closed **gracefully** (`CloseMainWindow()`, not `Stop-Process -Force`) —
specifically because force-killing this app is the documented root cause of the very bug
class this whole session was fixing — then re-confirmed the identity was still stable
afterward. No corruption resulted.

**Not run this session, deliberately**: the emulator-dependent `firestorewrite`/
`composepublish` self-tests (they exercise `__kompanionSignInWithCustomToken`, a
pre-existing, unmodified hook — only a new sibling `__kompanionGetIdTokenClaims` hook was
added nearby). Skipped the emulator setup overhead given the very strong real-production
signal already in hand from `mintauth`/`authpersist`/`manhist`/`espnmatch`; worth a
regression pass next time real emulator-based work happens anyway.

**Owner action**: none blocking. Live in production, verified end-to-end. Worth
remembering for `npm run dist`/real-machine-install planning: this was the actual blocker
that made v1 unsafe to ship before now — that risk is gone.

---

## 2026-07-30 (2) — Manager Match permissions bug: UID drifted again (4th re-pin, not yet deployed); Delete All Drafts added

Owner reported "Manager Match is giving: Missing or insufficient permissions. error again" and asked for a
"Delete All Drafts" button (with confirmation) on the Resume Draft popup.

**Permissions bug: same recurring class as the three prior re-pins, root-caused via `authpersist` rather than
assumed.** Confirmed deployed `firestore.rules` matches the local file exactly (no drift there) and the
currently-pinned UID (`CZzTiUNsFgYo650d6eFfJdq5zO12`) is a real, existing Firebase Auth user refreshed as
recently as today — so the natural first guess ("rules never deployed" / "UID never existed") was wrong. Ran
`authpersist` against the real profile instead: it's now persisting **`FlOBcCHWiNc1jPx55IJaDHnOYej2`** — a
straight mismatch against the pinned UID, confirmed **stable across three separate clean relaunches** (the
project's own established bar before re-pinning) before touching the rules files. Notably this is the *same*
UID this profile held back on 2026-07-27, before that day's second re-pin — exact mechanism of the revert not
root-caused this time (no force-kill observed in this session), but the fix is identical to every prior
occurrence: re-pin `isKompanionApp()` in both `firestore.rules` and `storage.rules` to whatever the real profile
currently, stably persists. **Deployed and verified this session** (owner approved) — see below.

**Own mistake, caught and corrected mid-session**: a malformed shell command accidentally launched the real app
in normal (non-selftest) mode in the background — a real, visible window against real production Firebase,
exactly the thing CLAUDE.md's hard rule says never to do from Claude Code. Caught immediately via `Get-Process
electron`, closed **gracefully** (`CloseMainWindow()`, i.e. a real X-button-equivalent close, not
`Stop-Process -Force`) specifically because force-killing this exact app is the documented cause of every prior
UID-drift incident — re-ran `authpersist` afterward to confirm the pinned-worthy UID was still stable post-
recovery (it was, a 3rd consecutive confirmation). No corruption resulted, but recorded here plainly rather than
omitted.

**Delete All Drafts**: `services/drafts.ts` gained `deleteAllDrafts()` (loops `listDrafts()`, deletes each file,
one `writeBackupSnapshot()` at the end rather than per-file), wired through a new `drafts:deleteAll` IPC handler
and `api.drafts.deleteAll()`. `ResumeDraftModal.tsx` gained a header-row "Delete All" button (only rendered when
drafts exist), gated behind `window.confirm` naming the real count — same confirm-dialog convention the
existing per-draft Delete already used, deliberately not a custom modal-in-modal. A separate `busyAll` state
disables both the new button and every row's Resume/Delete while the bulk delete is in flight.

**New self-test `deletealldrafts`**: hard-refuses to run without `KOMPANION_USE_EMULATOR=1` (same guard pattern
as `firestorewrite`/`composepublish`) — a bulk delete against the real drafts folder would destroy the
commissioner's actual in-progress drafts, unlike `draftroundtrip`'s existing single-fresh-UUID scope which is
safe either way. Seeds 3 drafts, calls `deleteAllDrafts()`, confirms `listDrafts()` returns empty. Passing.
Re-ran `draftroundtrip` as a regression check afterward — still passing, confirming the single-delete path is
untouched.

**New self-test `resumedraftscreenshot`**: read-only against real production drafts (opens the modal, never
clicks Delete/Delete All — the actual delete behavior is what `deletealldrafts` already proves, non-
destructively, against the isolated emulator profile instead). **Real capture-timing quirk found and fixed**:
a direct DOM readback confirmed the modal's content was genuinely present 1.5s after the click, but
`capturePage()` at that same point still showed the pre-click Compose screen with no overlay at all — bumped
the wait to 3s (matching the box-score logo timing fix's precedent elsewhere in this same file: empirically
confirm a reliable duration, don't just guess). Final screenshot confirms the button renders correctly,
positioned top-right of the "Resume Draft" header, styled consistently with the rest of the app.

**Noticed in passing, not acted on**: the real Resume Draft list currently has 7+ "Week 1 Recap" drafts from
Jul 29–30, almost certainly leftover test artifacts from earlier sessions' `composenewpost`/`composescreenshot`
self-test runs (both of which create real, non-emulator drafts) that were never cleaned up. Not deleted this
session — flagged for the owner, who now has the exact tool (this session's own new button) to clear them if
wanted.

**Deployed via the Firebase MCP tool, with a real gotcha found**: `firebase_deploy({ only:
"firestore:rules,storage" })` reported `"status":"success"` but re-fetching the deployed rules afterward showed
storage updated correctly while **firestore silently kept the OLD uid** — the MCP tool's `only` param apparently
doesn't accept colon-scoped sub-targets like the CLI does (`firestore:rules`), unlike `--only` on the real
`firebase` CLI. Caught only because this project's own habit is re-fetching deployed rules directly rather than
trusting a reported success (same discipline as the existing `firestore:indexes` unreliability noted in
CLAUDE.md). Re-ran with `only: "firestore"` (bare top-level target) instead — deployed correctly, re-fetch
confirmed the new uid live. **Worth remembering for any future MCP-tool Firebase deploy**: pass bare top-level
targets (`firestore`, `storage`) to this tool, not CLI-style `service:subtarget` syntax, and always re-fetch
after to confirm — added to CLAUDE.md's hard rules alongside the existing indexes gotcha.

**End-to-end confirmation, not just "rules look right"**: ran `espnmatch` against the real league (303458) post-
deploy — real ESPN data, real `manager_history/roster` Firestore read, all 10 real managers matched
automatically, zero permission errors. This is the exact code path "Match ESPN Teams to Managers" uses, so this
is a real fix confirmation, not just an inference from the rules text.

**Owner's follow-up question, still open**: concerned this exact class of bug (a single hardcoded anonymous-auth
uid baked into the rules) will recur the moment v1 is installed on the commissioner's own separate machine —
correctly so, since a fresh profile always mints a brand-new random uid with no way for a non-technical end user
to fix it themselves. Recommended replacing the raw-uid check with a Cloud-Function-mediated identity (a shared
app secret verified server-side, minting a custom token/claim, or routing every `isKompanionApp()`-gated
operation through a callable the way `getManagerHistory` already works) — removes the dependency on local
IndexedDB persistence entirely. Not yet decided/implemented; owner is weighing it.

---

## 2026-07-30 — Pre-v1 code review of Kompanion app: cleanup + one live-confirmed assumption

Owner asked for a thorough review of `kompanion-app/` ahead of shipping v1.
Read every main-process service, the full renderer (lib + components +
screens), the self-test harness, `firestore.rules`/`storage.rules`, and the
Cloud Function. `npx tsc --noEmit` clean on both tsconfig projects
throughout.

**Real fix, security-adjacent**: five renderer files
(`lib/firebase.ts`, `lib/posts.ts`, `lib/compose.ts`, `lib/notifications.ts`,
`lib/roster.ts`) unconditionally attached internal functions to `window` on
every module load — including `window.__kompanionPosts.deleteRecapPost` and
`__kompanionPublishDraft` — reachable from DevTools on a normal commissioner
launch, not just during self-tests. Added `window.kompanion.selftest`
(preload, mirrors the existing `useEmulator` runtime-toggle pattern, backed
by `process.env.KOMPANION_SELFTEST !== undefined`) and gated every one of
these hooks behind it. Verified directly by loading the built renderer both
with and without `KOMPANION_SELFTEST` set and inspecting `window` — hooks
are `undefined` normally, present only under self-test. Ran the `boot` and
`draftroundtrip` self-tests afterward (both local-only, no Firebase/ESPN
touch) to confirm the preload/IPC change didn't break anything.

**Real bug**: `Compose.tsx`'s `newPost()` persisted a draft to disk
(`createRecapDraft` → `drafts:create` + `drafts:save`) *before* checking
whether ESPN returned any matchups for the requested week. When it hadn't
(offseason/preseason, or any week with no real schedule yet), the draft was
silently abandoned on disk — an empty "Week N Recap" that would linger
forever in Resume Draft/History. Fixed: deletes the just-created draft
before showing the "no matchup data yet" message.

**Minor fix**: `biggestOverUnder()` in `matchupCompute.ts` would list the
same single player as both over- and under-performer when only one starter
had a projection value (rare — most bye-week-free lineups have 9-10). Now
shows it once (as over-performer) instead of twice.

**Cleanup**: `kompanion-app/.gitignore` was missing `*.tsbuildinfo` —
`tsconfig.node.tsbuildinfo`/`tsconfig.web.tsbuildinfo` build-cache files
would have been swept into the repo's first commit (this whole app is still
entirely untracked in git as of this session).

**BENCH_SLOTS assumption resolved**: `matchupCompute.ts` had flagged its
`BENCH_SLOTS = new Set([20, 21])` (which lineupSlotIds count as bench/IR,
excluded from "top scorers") as "common ESPN convention, unconfirmed" since
the 2026 season hadn't drafted yet when it was built. Owner supplied the
league's real roster construction as an FYI (1 QB, 2 RB, 2 WR, 1 TE, 2 Flex,
1 D/ST, 1 K = 10 starters; 6 bench; up to 2 IR). Cross-checked against a
live, read-only `mSettings` pull against the real league (303458, via the
already-connected ESPN session, the `espn` self-test) —
`settings.rosterSettings.lineupSlotCounts` came back
`{"0":1,"2":2,"4":2,"6":1,"16":1,"17":1,"23":2,"20":6,"21":2}`, an exact
match (QB/RB/WR/TE/D-ST/K/FLEX = 10 starters, BENCH=6, IR=2). Confirms
`BENCH_SLOTS={20,21}` is correct for this league, not just a guess — updated
the code comment accordingly. Still not 100% closed out: this confirms the
league's configured slot *counts*, not yet that a real scored player's own
roster entry reports the same `lineupSlotId` once Week 1 actually happens —
worth one more quick sanity check then, per the (now narrower) comment left
in the code.

**Nothing else needed fixing**: `sanitizeHtml.ts`'s allowlist, the
`isKompanionApp()` rules in both `firestore.rules`/`storage.rules`, the
`espn-auth.json` credential-redaction discipline in `selftest.ts`, and the
`app.css` ↔ `site/Post.dc.html` `mk-*` CSS sync all held up under review —
no drift or leftover risk found.

**Owner action**: none blocking. App is ready for v1 from a code-cleanliness
standpoint; the `npm run dist` go-ahead is still the owner's call to make,
unchanged from prior sessions.

---

## 2026-07-29 (2) — All-time series centered; a real sanitizer-scope catch

Small, owner-requested tweak: center the all-time head-to-head line under
the score, deployed immediately (pre-authorized in the same request).

**First attempt didn't actually work** — caught by re-screenshotting
instead of trusting the build succeeded. Added `class="mk-history"` to the
existing `<p>All-time series...</p>` in `postAssembly.ts`, added the CSS
rule, rebuilt, screenshotted: still left-aligned. Root cause:
`sanitizeHtml.ts`'s `ALLOWED_ATTRS` only grants `class` to `DIV`/`SPAN` (the
scoped addition from the box-score work) — `P` was never included, so the
class was silently stripped during sanitization every time, CSS rule
correct but never actually applied to the real element. Fixed by switching
the element itself from `<p>` to `<div class="mk-history">` rather than
widening the sanitizer further — `DIV` already has `class` allowed, so this
needed no sanitizer change at all. Re-screenshotted after the real fix and
confirmed centered before deploying.

**Deployed and verified**: `npx netlify-cli deploy --prod --dir=site`, 1
file uploaded, confirmed the `.mk-history{text-align:center` rule is
present in the real production page's loaded stylesheet afterward.

**Lesson worth remembering for any future `mk-*` markup**: `class` is only
safe to use on `DIV`/`SPAN` elements in anything that flows through
`sanitizeHtml.ts` — reach for one of those two, not `P`/other tags, or
check `ALLOWED_ATTRS` first.

---

## 2026-07-29 — Box-score CSS deployed; two "bugs" traced to the same cause

Direct continuation from the prior session's box-score work. Owner reported
two problems against the real published post: team logos rendering huge,
and the all-time head-to-head record seeming to be missing.

**Root cause, confirmed by reading the actual stored post directly** (not
assumed): both were the same thing. Pulled the real live post's `bodyHtml`
from Firestore and found the all-time record text (`<p>All-time series:
8-6</p>`, one per matchup) genuinely present for all 5 matchups, and every
logo `<img>` correctly wrapped in `class="mk-logo"`. The app-side generation
was already correct — the `site/Post.dc.html` CSS that makes `mk-logo`
render as a small circle (and lays out the rest of the box score) had
still never been deployed, so the browser rendered the raw `<img>` tags at
native size, ballooning the layout badly enough that the (genuinely
present) all-time record line was easy to lose track of underneath it.

**Also investigated, same session**: an "11 teams in standings for a
10-team league" report and a recurring "Missing or insufficient
permissions" publish error. Neither reproduced against fresh live data/a
fresh build (checked `fetchStandings` directly: exactly 10 real teams,
matching `fetchEspnTeams`; drove the actual "Post to Website" click twice
against production with a clean build: succeeded both times). Likely
explanation for both: `standings`/`locked.history` are computed once at
"New Post" time and never recalculated, so an older draft created before an
earlier fix would keep showing whatever was wrong at creation time
permanently, regardless of any code fix since. No code change from this
round of investigation beyond what was already shipped.

**Deployed**: `npx netlify-cli deploy --prod --dir=site`, same command as
last time (plain `netlify` still isn't on PATH in this environment). CDN
diff uploaded exactly 1 file (`Post.dc.html`). Verified post-deploy by
checking the real production page's loaded stylesheet directly for all 4
new rule families (`mk-logo`, `mk-stats`, `mk-num`, `mk-arrow-up`) — all
present. Could not visually confirm the actual rendered post itself, since
`Post.dc.html` is behind the league's Google Sign-In gate and verifying
further would need a real member's own account.

**Owner action**: none blocking. If the "11 teams"/permissions symptoms
recur on a **freshly created** post (not an old one, not a stale-process
retry), that's a real live bug worth a fresh report — everything checked
out against current code and real data this pass.

---

## 2026-07-28 (5) — Stats box: owner picked option 3; real QB-label bug fix

Direct continuation, same day. Owner picked "framed panel with markers"
(option 3) from the 3 samples; implemented it for real in both
`MatchupCard.tsx` and `postAssembly.ts`/CSS. Also fixed an unrelated real
bug flagged mid-turn.

**Option 3, built into the app**: gold-bordered frame around the stats box
(was the muted border color), gold numbered circle badges for the top 3
(not `<ol>`'s browser marker — a styled span), a vertical divider between
the two team columns, and a colored triangle marker for over-/under-
performer (▲ green / ▼ coral) instead of a text label. The triangles are
plain unicode characters, not an icon font — the mockup used Tabler icons
for speed, but that font isn't loaded in either the real app or the live
site, so the real implementation needed something that renders identically
in both without a new asset/font dependency. New `mk-num`/`mk-arrow-up`/
`mk-arrow-down`/`mk-stats-divider` classes, added to both `app.css` and
`site/Post.dc.html` (removed the now-dead `mk-stats ul/ol/p` rules from the
prior structure). Verified via a real screenshot through the actual
sanitized Preview pipeline, not just the live editor.

**Real bug, flagged by the owner mid-turn**: quarterbacks were showing as
"TQB" instead of "QB". `matchupCompute.ts`'s `POSITION_NAMES` had
`1: 'TQB'` — wrong for this league's real data. Confirmed directly rather
than just patching on the owner's word: every real QB across this session's
own screenshots (Josh Allen, Jalen Hurts, Caleb Williams, Drake Maye,
Trevor Lawrence, Dak Prescott, Brock Purdy) came back as
`defaultPositionId: 1`, and none of them are actually "Team QB" — just
ordinary starters. Fixed to `1: 'QB'`; re-verified against a fresh live
ESPN pull afterward (grepped every distinct position label that came back
— `QB` present, `TQB` gone).

**Owner action**: same as the last two entries — the `site/Post.dc.html`
half of the whole box-score feature (now including this styling) is still
undeployed pending the owner's go-ahead.

---

## 2026-07-28 (4) — Box score content refinements, pre-deploy review

Direct continuation, same day, before the box-score work goes live.

**Team identity block now shows record + rank** ("3-2 (1st place)"), not
rank alone — `postAssembly.ts`'s `rankLabel` renamed `recordRankLabel`,
pulls `wins`/`losses`/`ties` off the same `StandingsEntry` already used for
the rank lookup. Same function, `MatchupCard.tsx` and the published HTML.

**All-time head-to-head record**: investigated an owner report that it was
inconsistently showing. Root cause not fully reproducible — a fresh live
pull against the real league showed it correctly on all 5 matchups, most
likely explained by a stale running process (same class of issue as the
publish-permissions bug earlier this session). Fixed what's genuinely worth
fixing regardless: `getManagerHistory`'s call in `buildMatchupSections` now
catches its own failure locally (`.catch(() => null)`) instead of letting a
transient Cloud Function error fail the whole "New Post" pull over one
non-critical lookup. Also moved the record's placement to directly under
the score (it was rendering after the whole stats block before) — matches
"underneath the matchup score" literally, in both `MatchupCard.tsx`
(already correct) and `postAssembly.ts` (fixed).

**Top Performers / Over / Under restructured**: dropped the "Manager Name
#1:" style prefix labels entirely. Each side now gets a centered "Top
Performers" heading over a real numbered `<ol>` 1-3, then separate centered
"Over-Performer"/"Under-Performer" headings each with one "- "-prefixed
line (not a bulleted `<ul>` — a real bullet plus a literal dash would
double up). New `.mk-stat-heading` class + `<ol>`/`<p>` margin resets added
to both `app.css` and `site/Post.dc.html`, same "two places, must stay in
sync" discipline as every other `mk-*` rule this feature uses.

**Verified** against real ESPN data through the actual sanitized Preview
pipeline (not just live editing) — record+rank format, record placement,
and the restructured stats sections all confirmed correct in a real
screenshot. Test drafts cleaned up after.

**3 stats-box visual style options** presented for review (ledger/divider
style, two-card duo with accent borders, framed panel with numbered-circle
and arrow markers) — a design-exploration widget, not app code; nothing
implemented yet pending the owner's pick.

**Owner action**: pick a stats-box style (or request changes); the
`site/Post.dc.html` half of the whole box-score feature is still
undeployed, same as noted in the entry above.

---

## 2026-07-28 (3) — Box score matchup layout, header photo, per-section photos

Direct continuation, same day. Owner wanted matchups to look like a real
sports box score, the old bottom "Photos" gallery moved to a single header
image under the title, and photo uploads added to every section the way
GIFs already work. Planned properly first (Plan Mode) given the real open
data question and the security-relevant sanitizer change involved.

**Live-data finding, resolved with the owner**: ESPN does not expose
championship/league-winning odds for this league through any view reachable
from this app — checked directly (`mTeam`+`mStatus`+`mStandings`, real
diagnostic pull against league 303458, cross-referenced against
community-documented `currentSimulationResults`/`playoffPct` fields that
simply aren't present here). Owner chose real standings-derived **rank**
("1st place" style) instead of a fabricated percentage. Team **logos** ARE
available (`team.logo`, a plain hosted image URL) — confirmed and used.

**Winner always shown left**: `lib/compose.ts`'s `buildMatchupSections` now
reorders at data-assembly time (`winnerLeft()` picks `[A,B]` or `[B,A]`
based on `ComputedMatchup.winner` before resolving manager ids/history) —
every downstream consumer just trusts "A is left/winner," never re-derives
it. Ties keep ESPN's original order.

**Sanitizer change #2 this project** (first was `IMG`/`src`, this session's
GIF work): `sanitizeHtml.ts` now also allows `class` on `DIV`/`SPAN`.
Deliberately different risk profile than allowing `style` (rejected
earlier): a class value can only *reference* CSS rules already written into
`app.css`/`Post.dc.html` — no way to inject a new declaration (e.g. a
`background:url(...)` exfiltration vector) through a class name string.
Needed because achieving real box-score structure in the *published* post
(not just the in-app editor, which uses React inline styles freely and
never touches the sanitizer) is impossible with zero allowed attributes.
New `mk-*` prefixed classes (`mk-box`, `mk-team`, `mk-logo`, `mk-score`,
`mk-stats`, ...) emitted by `postAssembly.ts`, matching CSS added in two
places that must stay in sync: `app.css` (`.post-body-render`, for the
in-app Preview) and `site/Post.dc.html`'s `<style>` block
(`[data-r="post-body"]`, for the real published post).

**Logo/rank resolution**: `StandingsEntry` gained `logoUrl`; no changes to
`ComputedMatchup`/`LockedMatchupStats` needed — a matchup's logo/rank is
looked up at render time by cross-referencing `matchup.managerA`/`managerB`
against `draft.standings` (new `rankLabel`/`logoForManager` helpers in
`postAssembly.ts`, shared by `MatchupCard.tsx`). Top-3/over/under moved into
its own visually distinct sub-box under the scoreboard (border/background
contrast), same left=A/right=B split so it still lines up.

**Header Photo**: new `RecapDraft.headerImageUrl` — deliberately a *new*
field, not a repurposed `imageUrls` (confirmed `site/Message-Board.dc.html`'s
own composer independently writes `imageUrls` for regular members' photo
galleries; changing that field's meaning for Kompanion would have collided
with that still-active, unrelated use). New single-image
`HeaderImageUploader.tsx` (upload replaces, not adds) moved to right under
the Title card. Old `ImageUploader.tsx` (multi-file gallery) deleted —
nothing referenced it anymore once Kompanion stopped using `imageUrls`.
`gifUrl`/`imageUrls` stay in the shared type/Firestore schema, just unused
by Kompanion going forward (same treatment `gifUrl` already got when inline
GIFs shipped) — no `isCommissionerRecap` gate needed on the new
`headerImageEl` render in `Post.dc.html`, since regular posts simply never
have the field set.

**Per-section photo upload**: `RichNotesBox.tsx` gained a second toolbar
button, "Photo," reusing the *exact* selection-preserving insert mechanism
already built for GIFs (`insertImageAtCursor`, factored out so both share
it) — only the URL source differs (Giphy pick vs. `uploadImage(draftId,
file)`). Needed `draftId` threaded into `RichNotesBox`/`MatchupCard.tsx` as
a new prop.

**Real bug caught by a screenshot, not the code**: first verification
screenshot showed team logos completely blank. Not a CSP issue (`img-src
https:` already permissive) or a hotlink-block (confirmed the same URLs
load fine navigated to directly) — just the existing `composescreenshot`
self-test's 8s wait firing before the logos' own separate network load
finished. Fixed by bumping that wait to 15s (confirmed reliable at 16s in
a one-off check) — a real, lasting fix to an existing self-test, not just
a one-off workaround.

**Verified**: real ESPN data end-to-end (winner-left ordering, real logos
loading, real ranks matching the real standings order), both the live
editing view (`MatchupCard.tsx`) and the actual sanitized Preview-pane
output (same `assembleBodyHtml`+`sanitizeHtml` pipeline "Post to Website"
uses) — confirming the `class`-attribute sanitizer change survives the real
publish pipeline, not just the in-app React rendering. All test drafts
cleaned up afterward.

**Owner action**: the `site/Post.dc.html` CSS + `headerImageEl` change is
local-only, not yet deployed — will ask before pushing, same as every other
live-site change this session.

---

## 2026-07-28 (2) — Compose screen: automatic standings, simpler score
display, inline GIFs anywhere

Direct continuation, same day. Three owner-requested changes to the compose
experience, all verified against real ESPN data and real screenshots.

**Standings Snapshot is now automatic**, not a free-text box. New
`StandingsEntry` (shared/types.ts) replaces `RecapDraft.standingsSnapshotHtml`
entirely. `main/services/espn.ts`'s new `fetchStandings` pulls the same
`mTeam` view `fetchEspnTeams` already used for owner matching — record shape
(`team.record.overall.{wins,losses,ties,pointsFor}`) confirmed via a live
diagnostic pull against the real league before writing any code against it,
not assumed (same discipline as the `matchupPeriodId` lesson from the
original build). `lib/compose.ts`'s new `buildStandings` resolves ESPN team
ids to manager ids via the same `mapping[id] ?? espn-<id>` fallback pattern
matchups already use, ranks wins desc / pointsFor desc, and is computed once
alongside matchups at "New Post" time — locked into the draft from then on,
same as `LockedMatchupStats`, never re-fetched or user-editable. New
`components/StandingsTable.tsx` renders it; `postAssembly.ts` renders the
published-post equivalent as an `<ol>` (free rank numbering).

**Player score lines dropped the shown projection** — now just
`actualPoints (+/-diff)` instead of `actualPoints (proj X.X, +/-diff)`. Small
change (`MatchupCard.tsx` + `postAssembly.ts`'s `statLineHtml`), the
projection itself was still used internally to compute the diff, just no
longer displayed.

**GIFs now insert inline at the cursor, in any rich-text box** — Intro, every
matchup's commentary, Conclusion — not a single fixed attachment slot at the
end. `components/RichNotesBox.tsx` gained its own "GIF" toolbar button and
now owns its own `GifPicker` instance; the button saves the current
selection (`Range`) before the picker modal steals focus, then restores it
and `execCommand('insertHTML', ...)`'s a plain `<img src>` in on pick — same
mechanism as every other toolbar command here, verified via a self-test that
drives a real click through the real picker and reads the resulting
`contentEditable` innerHTML back out, not just trusted to compile. Removed
the old single `gifUrl`/"Media" section UI from `Compose.tsx` entirely
(renamed to "Photos" — uploaded images only now); `gifUrl` stays in the type/
Firestore schema unused rather than migrated, since removing it outright
wasn't needed and this way old data/site rendering needs zero changes.

**Sanitizer change, deliberately narrow**: `sanitizeHtml.ts` now allows
`IMG`/`src` (plus the existing `javascript:` guard extended to also cover
`src`, not just `href`). This is Kompanion's own copy only — `site/
message-board.js`'s sanitizer is untouched, so regular member posts still
can't embed inline images. Reasoned through explicitly before making this
change (a real, if narrow, widening of a shared stored-XSS defense): an
`<img>` can't execute script via `src` the way an unfiltered `<script>` or
event-handler attribute could, so this doesn't reopen the specific risk the
allowlist exists to prevent — unlike the inline-`style` case rejected
earlier this project for being "not something to loosen for visual polish,"
this is a directly-requested capability with a well-understood, narrow blast
radius.

**Image-overflow fix, both sides**: a bare `<img src>` with no size
attributes (sanitizer strips everything else) needed a container-level CSS
constraint instead, since there's nowhere to put an inline style. Added
`.rich-notes img, .post-body-render img { max-width:100%; ... }` to
`app.css` (covers both live editing and the in-app Preview pane) and the
equivalent `[data-r="post-body"] img` rule + a `data-r="post-body"` hook on
`postBodyEl` to `site/Post.dc.html` (matching that file's existing
`data-r`-attribute CSS convention, not introducing a new one) — **local edit
only, not deployed**, per the standing hard rule on live-site pushes.
Checked first that `Message-Board.dc.html`'s own list view never renders
`bodyHtml` as real HTML (only the composer's own contentEditable, and the
single `Post.dc.html` page) — so this one spot was the only place that
needed it.

**New permanent self-test**: `inlinegifscreenshot` (drives a real GIF pick
through a real "New Post" draft, confirms the resulting `contentEditable`
innerHTML directly, screenshots before/after). Reused the existing
`composenewpost`/`composescreenshot` self-tests as-is for the standings/
score-display verification — real ESPN data, real screenshots, all cleaned
up afterward (test drafts deleted, screenshot files removed).

**Deployed live**: owner approved after review — `npx netlify-cli deploy
--prod --dir=site` (the plain `netlify` binary isn't on PATH in this
environment; npx resolved and used the existing stored auth without a login
step, matching the precedent noted below). CDN diff uploaded exactly 1 file
(`Post.dc.html`), confirming nothing else unintended went out. Verified
post-deploy by loading the real production page and checking for the
`data-r="post-body"` hook and the `max-width:100%` rule directly in the
live DOM/stylesheet, not just trusting the CLI's "Deploy is live!" output.

**Owner action**: none. Live at nocsbs.com.

---

## 2026-07-28 — Beta feedback round: a real permissions bug, install-time defaults, app icon

Owner's first real hands-on testing pass against the live app (via the
desktop shortcut, real production Firebase, real ESPN league). Produced one
genuine bug and several install-experience changes.

**Real bug: "Missing or insufficient permissions" clicking "Match ESPN Teams
to Managers."** Not a rules/deployment problem — checked the actual deployed
Firestore rules (`firebase_get_security_rules`) against the local file
(identical) and the app's live anonymous UID against the pinned one in
`isKompanionApp()` (also identical). Real cause: `lib/roster.ts`'s
`getRoster()` called `getDoc()` without waiting for the renderer's silent
anonymous sign-in (`anonReady` in `lib/firebase.ts`) to resolve first — a
plain race, not a permissions bug per se. Only `getManagerHistory()` had ever
been given this guard; `posts.ts` (7 functions), `gifs.ts` (2), `media.ts`,
and `notifications.ts` were all missing it too — same latent bug, just not
yet hit. Fixed everywhere. `subscribeGifLibrary()` needed a slightly
different shape (stays synchronous — returns its unsubscribe fn immediately,
matching `GifPicker.tsx`'s existing `useEffect` — but defers the actual
`onSnapshot` call internally until `anonReady` resolves, with a `cancelled`
guard for an unmount that beats sign-in). Re-ran the real matching flow
end-to-end afterward against the live league — all 10 managers matched
clean.

**Stale `backup.json` found and fixed.** While updating the commissioner
display name, noticed the real `backup.json` had drifted from real
`settings.json` (different name, null mapping) — cause unclear, harmless
since the app only ever reads `settings.json` directly, not the backup, in
normal operation. Fixed by routing the actual correction through
`updateSettings()` (via a temporary one-off self-test, removed after use)
rather than hand-editing JSON, so `writeBackupSnapshot()` refreshed it
correctly in the same call — confirmed it now correctly holds the real
mapping and all 11 real drafts.

**Install-time defaults, not empty state.** This app is single-purpose (built
only for this one league, this one commissioner) — the owner wants a fresh
install to already be fully configured, not walk through setup. `DEFAULTS` in
`services/settings.ts` now ships the real `espnLeagueId` ("303458") and the
real 10-manager `espnTeamMapping`, instead of `null`/`null`. Combined with the
League ID field's existing lock-once-set behavior (`readOnly` when truthy),
a fresh install now shows the League ID pre-filled and already locked.

**"New Post" no longer force-blocks on missing manager mapping.**
`lib/compose.ts`'s `buildMatchupSections` had a hard `throw` if
`espnTeamMapping` was null — meaning a fresh install (before this session's
default-mapping change, or after a real roster change resets it) couldn't
create a post at all until a trip through Settings. Removed the throw;
falls back to `{}`, and the per-team `mapping[id] ?? \`espn-${id}\`` fallback
that already existed for a *partial* mapping now also covers a fully-missing
one — confirmed via a one-off check (real ESPN data, mapping forced to
`null`) that all 5 real matchups came back labeled `espn-<id>` instead of
throwing. `Compose.tsx` now shows a soft, non-blocking nudge ("some teams
aren't matched yet — run matching in Settings for full names") only when a
matchup actually falls back, instead of a hard requirement every time.

**App icon**: owner supplied `KROOKD_Logo_Final.svg` (Downloads). No local
SVG→ICO tool available (no ImageMagick/Inkscape/rsvg-convert on this
machine), so rasterized via a throwaway `sharp` + `png-to-ico` script in the
scratch directory (temporary devDependencies, not added to the app's own
`package.json`) — produced a proper multi-resolution `.ico` (16 through 256px,
confirmed via its file header: type 1, 7 embedded images). Placed at
`kompanion-app/resources/AppIcon.ico` (+ a 512px `icon.png` alongside, for any
future non-Windows/doc use), wired into `main/index.ts`'s `BrowserWindow`
icon and `package.json`'s `build.win.icon`, matching podcast-app's exact
existing pattern. Updated the real desktop shortcut's `IconLocation` to
match — no new shortcut needed.

**New self-test**: `settingsscreenshot` (permanent — same click-through-nav
screenshot pattern as `historyscreenshot`/`composescreenshot`), used to
visually confirm the locked field + new defaults + icon wiring together.

**Owner action**: none blocking. All of this is app-side and already live in
the owner's real install (settings correction) or ready for the next launch
(code changes, rebuilt). No Firebase deploys this pass — the permissions fix
was entirely local (renderer timing), not a rules change.

---

## 2026-07-27 (7) — Beta review: desktop shortcut, uninstall/reinstall data preservation

Direct continuation, same day. Owner began reviewing the app in beta ahead of
calling "confident v1" (the `npm run dist` go-ahead, still not given — matches
podcast-app's precedent).

**Desktop shortcut**: `Kommissioner's Kompanion (Beta).lnk` on the Desktop,
mirroring the existing podcast-app shortcut's structure (target
`node_modules/electron/dist/electron.exe`, args pointing at `kompanion-app/`,
no custom icon since none exists yet). Flagged explicitly to the owner:
unlike podcast-app, this app has no dev/real database split — every launch
talks to real production Firebase, so "Post to Website"/"Update Post" publish
for real, visible to all 10 league members.

**Uninstall/reinstall data preservation**, designed and built ahead of the
eventual real installer (owner's framing: the app runs on the commissioner's
own machine long-term, not this dev machine, so update/reinstall cycles need
to actually work, not just happen to work by accident). New
`services/backup.ts`: a `backup.json` (settings + all local drafts)
maintained continuously — written after every settings/draft mutation, so
there's no "remember to export before uninstalling" step for a non-technical
end user to forget. Deliberately excludes `espn-auth.json` — the
`safeStorage` per-profile-key constraint found earlier this session (entry
(6) below) means an encrypted blob written now could never decrypt after
landing in a fresh `userData` profile, so the ESPN session can never be part
of a portable backup regardless of design; the in-app restore flow says so
explicitly rather than leaving the commissioner to discover it as a
confusing failure later.

**Two-sided mechanism**:
- *Uninstall side* (new `build/installer.nsh`, wired via `package.json`'s
  `build.nsis.include` + an explicit `deleteAppDataOnUninstall: false`): a
  `customUnInstall` macro prompts Yes/No, copies `backup.json` to a sibling
  `...Backup` folder on Yes, deletes both the live and backup folders on No
  (owner confirmed "No" should mean a genuinely clean uninstall, not a
  silent no-op). Written and reviewed against electron-builder's own
  documented mechanism and its actual `uninstaller.nsh` template (confirmed
  `${APP_FILENAME}` as the variable electron-builder's own built-in APPDATA
  cleanup uses, for consistency) — but **not executable or testable right
  now**: actually running an NSIS build/install/uninstall cycle means
  `npm run dist`, still off-limits pending the owner's v1 go-ahead. Flagged
  plainly as unverified, not implied as done.
- *Install/launch side* (all in-app, fully testable now): `App.tsx` checks
  for a restorable backup on boot; if found (and settings still look
  unconfigured), shows a banner with the backup's date and Restore/Not now.
  Restoring writes settings + drafts back verbatim and shows a persistent
  note that the ESPN connection specifically needs to be redone.

**New self-tests, both passing**: `backuprestore` (pure local-file
round-trip — seed two test drafts, verify `backup.json` reflects real
settings + both drafts, simulate the uninstaller's copy to the sibling
folder, simulate a fresh install via `checkForRestorableBackup`, restore,
verify; deliberately non-destructive to real data — never fakes settings,
only round-trips whatever real settings already exist, only creates/cleans
up its own two fresh-UUID drafts) and `restorebannerscreenshot` (loads the
real renderer against a seeded fake backup, screenshots the banner, clicks
Restore, screenshots the confirmation — both looked at directly, not just
trusted to compile). Both run with `KOMPANION_USE_EMULATOR=1` for isolation;
confirmed via file mtimes that real production `settings.json`/
`espn-auth.json` were untouched throughout.

**Owner action**: none blocking. The backup/restore mechanism is complete
and verified on the app side; the NSIS half is written but genuinely
unverified until a real installer build happens.

---

## 2026-07-27 (2) — Kompanion app: foundation built, ESPN integration blocked on real login

Second session on this project, moving to the brief's "Next steps: Kommissioner's
Kompanion App" item from the entry below. Per the brief's own explicit gate
("developer should research... and present tradeoffs... before implementation
begins"), this session opened with research + a written, owner-approved plan
before any code — see that plan for full architecture reasoning (colors, ESPN
access approach, Firestore write-access design, v1 scope) if picking this back
up. This entry covers what actually got built + verified against that plan.

**New: `kompanion-app/`** (sibling to `podcast-app/`, same Electron + React 19 +
TypeScript + electron-vite scaffold, `KOMPANION_SELFTEST=<mode>` convention —
deliberately a different env var than podcast-app's `NOCSBS_SELFTEST` so the
two never cross-talk in a shared shell). Deviates from podcast-app in one
deliberate way: **no `better-sqlite3`** — local data here (a handful of
drafts, one settings blob) is small and non-relational, so plain JSON files
under `userData` (atomic write-via-temp-then-rename, one file per draft) cover
it without the native-module rebuild tax. Ported near-verbatim from
podcast-app: `services/crypto.ts` (safeStorage/DPAPI secret encryption),
the `OutlineBuilder.tsx` rich-text pattern (not yet wired into a screen).

**Real architectural finding, verified empirically before any rule was
written against it**: Firebase (anonymous auth + Firestore + Storage + the
`sanitizeHtml` allowlist ported from `site/message-board.js`) has to live in
the renderer, not main — a deliberate, documented exception to "renderer
never touches the data layer." Two concrete reasons: anonymous-auth session
restore needs a real IndexedDB (exists in Electron's renderer, not in bare-Node
main — main would mint a new UID every relaunch, breaking the pinned-UID
rules design before it could ever work), and the sanitizer needs `DOMParser`
(also renderer-only). Confirmed via a real A/B: same UID across two clean
relaunches, a *different* UID after manually clearing IndexedDB/Local
Storage, and that new UID persisting again afterward — now the permanent
`authpersist` self-test.

**Manager-vs-manager history**: seeded a new `manager_history` Firestore
collection (`h2h`, `h2hFranchise`, `roster` docs) from `site/records-data.js`
+ `site/league-data.js`'s `MEMBERS`, via the Firestore MCP tools directly
(no throwaway script for the actual write — a local Node script only
*shaped* the ~90-entry nested data into Firestore's typed wire format, since
hand-authoring that literal wasn't tractable). **Resolved `h2h` vs
`h2hFranchise`** while doing this: `League-Manager-Records.dc.html`'s own
code comment says `h2hFranchise` "folds in inherited history" (a roster
slot's record across manager swaps) — the *opposite* of the brief's "tracked
by manager identity, not team name." Wired the new `getManagerHistory` Cloud
Function (new `functions/` folder, repo root, `firebase-functions/v2`
`onCall`, gated on any authenticated client) to `h2h` only; `h2hFranchise`
is seeded but unused, kept for possible later use.

**New self-test modes** (all passing): `boot` (window launches, IPC round-
trips), `draftroundtrip` (local JSON draft CRUD, including a real deleted-
means-gone check), `authpersist` (the UID-persistence A/B above), `manhist`
(calls the real `getManagerHistory` callable for brent-vs-josh — 11-20,
confirmed both directions mirror correctly — and an unknown-pair 0-0
fallback). `manhist`/`authpersist` run against the **Firebase Auth +
Functions emulators** (both pure Node) — the Functions emulator's Firestore
read in this configuration goes to the **real** `manager_history` data
(read-only, intentionally-seeded, non-sensitive — not a concern), since the
Firestore emulator itself needs Java and this machine doesn't have it.

**Owner approved both blockers below mid-session; both are now resolved.**

- **Anonymous Auth enabled live** on `my-project-3c848` via `firebase_init`
  (`auth.providers.anonymous: true`) + `firebase deploy --only auth` — same
  mechanism that enabled Google Sign-In for the message board. Verified with
  a direct `accounts:signUp` call before (real `ADMIN_ONLY_OPERATION` error)
  and after (real UID returned). Ran the actual app against production once
  (not the emulator) to mint its real permanent identity — confirmed stable
  across two separate launches: **`e5dxbVQmC2ZRKs4gW4PuMvBgA2a2`** — this is
  the UID now hardcoded into both rules files' `isKompanionApp()`.
- **Java installed** (Eclipse Temurin 21 JRE, via `winget`) — needed only for
  the local Firestore/Storage emulators (Auth and Functions are pure Node).
  Not on system PATH for already-running shells; emulator commands need
  `PATH="/c/Program Files/Eclipse Adoptium/jre-21.0.11.10-hotspot/bin:$PATH"`
  prefixed until a fresh shell picks up the real PATH update.

**`isKompanionApp()` added to both rules files** (`firestore.rules`:
`posts` create/update/delete scoped to `isCommissionerRecap` docs,
`gifLibrary` create, `posts/{id}/replies` delete scoped via a `get()` on the
parent post so a full recap deletion can cascade to "no visible trace left
behind" without a broader grant; `storage.rules`: the `message-board`
path's read/write/delete). **Two more real bugs found and fixed while
verifying, neither introduced by this session's own new code**:

- **Latent bug in the existing `isMember()`**: `request.auth.token.email`
  throws ("Property email is undefined on object") when the key is truly
  *absent* from the token map, not just `null` — and an anonymous-auth
  token genuinely omits `email` entirely, unlike every real member's Google
  Sign-In token, which always includes it. This line has existed since the
  message board shipped but was never exercised against a token shape
  without an email claim until Kompanion's anonymous identity started
  hitting these same rules. Fixed in both rules files:
  `request.auth.token.get('email', null) != null` instead of
  `request.auth.token.email != null` — safe on a missing key, short-circuits
  the rest of `isMember()` before any other unguarded `.token.email` access
  is reached.
- **Auth-session bleed between production and the emulator**: Electron's
  local Firebase Auth persistence (IndexedDB under this app's userData)
  doesn't know or care which backend a cached session came from — it just
  sees "already signed in" and skips re-authenticating. Discovered directly:
  after running `authpersist` once against real production to mint the
  permanent UID above, every *later* emulator-targeted run kept returning
  that same stale production UID instead of establishing a fresh emulator
  session, and `manhist` started failing once the Firestore emulator joined
  the mix (a related but separate issue below). Fixed with the exact same
  pattern `podcast-app` already uses for its own Dev-vs-Real DB split:
  `KOMPANION_USE_EMULATOR=1` now redirects `app.setPath('userData', ...)`
  to a separate `...Emulator` directory before anything touches storage.
  Reproduced the bug, applied the fix, then re-verified clean: a fresh
  emulator-only profile mints its own new UID and that UID persists
  correctly across relaunches, isolated from production.
- **Related, not a bug**: once the Firestore emulator ran alongside the
  Functions emulator (needed for the rules work above), `manhist` started
  failing (`0-0` instead of `11-20`) — the Functions emulator's Firestore
  reads now correctly go to the *local* emulator's Firestore instead of
  quietly falling through to real production the way the narrower
  `--only auth,functions` configuration used earlier in this session did.
  That fallthrough was flagged as intentional at the time but is exactly the
  kind of implicit behavior routine test runs shouldn't depend on — fixed by
  seeding the same `manager_history/h2h` data into the local Firestore
  emulator too, so `manhist` no longer needs production data to pass.
- **Verifying `isKompanionApp()` locally needed one more workaround**: the
  emulator's own `signInAnonymously()` mints a random UID from its isolated
  user store, which can never match the pinned production UID hardcoded
  into the rules. `firestorewrite` (new self-test: full create/read/update/
  delete through the real client SDK path, plus the negative case — a
  non-recap post must be *rejected*) signs in via `signInWithCustomToken`
  instead, using a token minted for the exact pinned UID against the Auth
  emulator's admin surface (`firebase-admin`, reused from `functions/`
  rather than added as an app dependency — test-only). All green, both the
  allow and deny paths confirmed, run twice for consistency.

**Not yet deployed**: the rules changes are verified locally only.
Deploying them to the real project (`firebase deploy --only firestore:rules,
storage`) is a separate, deliberate ask-first step — not done yet.

**One remaining blocker, unchanged**: ESPN integration needs the real league
ID and an interactive login (the cookie-capture design needs a human at the
keyboard for that one-time step) — not started.

**Owner action**: confirm whether to deploy the verified rules changes to
the live project now; provide the ESPN league ID and be available for the
one-time login capture when picked back up.

---

## 2026-07-27 (3) — Rules deployed live; ESPN integration built and proven against the real league

Direct continuation of the entry above, same day. Owner approved deploying
the rules, upgraded the project to Blaze, and provided the real ESPN league
ID (303458) and did the one-time login capture in person.

**Rules deployed live**: `firestore.rules` deployed cleanly first. `storage`
deploy failed once — Firebase Storage had never been "activated" as a
product on this project (separate from the bucket/config already existing),
and as of **Feb 3, 2026 this now requires the Blaze plan** (a policy change,
confirmed via research, not assumed) even to provision the very first
bucket. Owner upgraded to Blaze (a payment-method step only the owner could
do — outside what Claude Code can perform on anyone's behalf under any
circumstance); `storage` rules deployed successfully right after. Also
surfaced clearly for later: the `getManagerHistory` Cloud Function has the
exact same Blaze requirement and hasn't been deployed live yet — emulator-
only so far.

**Security incident — real ESPN credentials briefly printed to console
output**: while diagnosing an API 404, a debugging line logged
`request.requestHeaders` in full, including the real `Cookie` header —
i.e. the actual `espn_s2`/`SWID` values and Disney/ESPN OAuth access +
refresh tokens for the owner's real account, in plaintext, in tool output.
Caught and disclosed to the owner immediately; the logging line was deleted
and replaced with a permanent redaction map (`REDACT_HEADERS`, covers
`cookie`/`authorization`/`x-fantasy-authorization`) so header-dumping
diagnostics can never do this again. Exposure was contained to this
session's own transcript and the owner's local machine — never sent
anywhere external — but it was real plaintext credential exposure and is
recorded here as exactly that, not softened. **Lesson for any future
session touching request/response headers for any external API**: redact
before logging, never log raw header objects on the assumption "it's just
a diagnostic."

**ESPN integration — built and empirically proven, with one real gap
remaining**:
- `services/espnAuth.ts` + `services/espn.ts` (new): cookie capture via a
  real, visible login window (`session.fromPartition('persist:espn')`,
  navigates to ESPN's actual login page — no password ever touches app
  code), `espn_s2`/`SWID` read off that session afterward and encrypted at
  rest via the ported `crypto.ts`. Minimal Settings screen (league ID,
  season, commissioner display name, Connect/Capture/Disconnect ESPN
  buttons) — first real renderer screen beyond the bare scaffold.
- **Three escalating fixes were needed to get real JSON back, each
  confirmed empirically against the real league, not assumed**:
  1. Node's global `fetch()` (even with valid cookies manually attached)
     got HTTP 202, redirected to a generic landing page, empty body.
  2. Electron's `net.request` bound to the same session (Chromium's real
     network/TLS stack) — **identical** 202/empty/redirect result, which
     ruled out "TLS fingerprint" as the actual cause.
  3. **Fix**: execute `fetch()` from inside an actual loaded ESPN page's JS
     context via `webContents.executeJavaScript` — indistinguishable from
     the site's own JS making the same call, because it is that, just
     triggered by the app instead of a click. This is what finally worked.
- **The API host itself was stale**: `fantasy.espn.com/apis/v3/...` (the
  pattern from training-era community libraries) has no real backend at
  that path anymore — it silently serves the SPA's own app-shell HTML
  regardless of query params, which is what every earlier attempt was
  actually hitting. **Confirmed the real current host by sniffing the live
  site's own network traffic** (`session.webRequest.onBeforeRequest` while
  loading a real league page): `lm-api-reads.fantasy.espn.com`. Once
  corrected, the current-season league endpoint
  (`/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{leagueId}`)
  returned full, real, correctly-shaped JSON on the first try — confirmed
  against the real "No CSBS" league (id 303458): PPR scoring, 10 teams,
  auction draft not yet held, full roster/waiver/schedule settings, all
  correct.
- **Known gap, not launch-blocking**: past/completed-season data needs a
  *different* endpoint (`leagueHistory/{leagueId}`, confirmed via the same
  traffic-sniffing — the real site calls this, not the current-season
  shape, for anything historical), which still 404s despite matching the
  real request's host, exact view param, absent `seasonId`, and even the
  two custom headers real traffic showed (`X-Fantasy-Source: kona`,
  `X-Fantasy-Platform: espn-fantasy-web`). Not resolved this session — not
  worth further blind iteration given the actual feature only needs
  **current-season** data once real games exist (Sept+), which is already
  proven working. Revisit only if historical-season testing before the
  season starts turns out to matter.
- New self-test modes (manual/diagnostic, not yet part of a routine
  regression sweep): `espn` (full connection + data-shape dump against the
  real league), `espnsniff` (loads a real league page, logs every outgoing
  URL that looks API-shaped — this is what found the correct host).

**Owner action**: none blocking — next up is Task #9 (Compose screen read
path).

---

## 2026-07-27 (4) — ESPN-to-manager matching: automatic, no manual UI needed

Direct continuation, same day. Owner corrected two assumptions from the
prior entry before this work started: (1) historical ESPN data is a non-
issue — the site's own database (already populated from ESPN via prior
sessions) is the intended source for anything historical, and this app was
never meant to query ESPN for it; the only historical need
("manager vs. record") is exactly what `manager_history`/`getManagerHistory`
already serves. (2) The ESPN-ID-to-real-name matching this session assumed
would need a manual dropdown UI **doesn't** — real names already exist on
both sides.

**Confirmed by searching, not assumed**: no raw ESPN-ID-to-manager table
exists anywhere in `site/` (grepped the whole directory, `draft-data.js`
specifically, and for GUID-shaped strings — nothing). What actually makes
this easy: `league-data.js`'s `MEMBERS` has everyone's real name, and
ESPN's own `mTeam` API view returns each owner's real `firstName`/`lastName`
alongside their GUID. **Matching by name closes the gap entirely** — no
stored mapping artifact was ever needed.

**Built**: `shared/espnMatch.ts` (pure, no I/O — normalizes names, matches
first-name-exact + last-name-exact-or-first-letter, so ESPN's "Casey S"
correctly matches the roster's "Casey Schannauer"), a new
`services/espn.ts` `fetchEspnTeams()`, a Settings-screen review UI (auto-
runs the match, shows each ESPN team's matched manager with a dropdown
override, confidence badge, explicit Save). **Verified against the real
league — all 10 current managers matched automatically** (9 exact, 1 fuzzy:
Casey), including the co-owned "Pat Mgroin"/Brandon Jasperson team matching
via whichever owner in the list actually hits the roster.

**New Firestore rule needed and deployed**: `manager_history` was
deliberately read-only-via-Cloud-Function-only (see the entry above) — the
matching feature needs the roster doc directly from the renderer, so added
a narrow `allow read: if isKompanionApp()` block scoped to that collection
only. Confirmed with the owner before deploying (same live-rules caution as
every other deploy this session).

**A second real bug found while verifying this**: the pinned UID from the
earlier entry (`e5dxbVQmC2ZRKs4gW4PuMvBgA2a2`) no longer matched what the
app actually authenticated as in production — **root cause: repeatedly
force-killing the Electron process mid-session during rapid test iteration
corrupted the local IndexedDB** (real symptom seen in earlier stderr output:
"Database IO error" / "Could not open the quota database, resetting"),
which silently reset the persisted anonymous session to a brand-new UID on
next launch instead of restoring the old one. ESPN's own session was
unaffected (separate storage partition). Diagnosed by adding explicit UID
logging to a failing self-test, confirmed the new UID
(`FlOBcCHWiNc1jPx55IJaDHnOYej2`) was genuinely stable across two clean
(non-force-killed) relaunches, re-pinned both rules files, redeployed,
re-verified end-to-end. **Lesson recorded directly in the rules file's own
comment**: prefer graceful shutdown over force-killing this app's process
during local testing.

**Owner action**: none blocking — Task #9 (Compose screen) is next.

---

## 2026-07-27 (5) — Compose screen built: the full "New Post" pipeline works end-to-end

Direct continuation, same day. This closes out the plan's original 9-task
list — every task from the approved plan is now built and verified.

**Built**: `services/matchupCompute.ts` (pure transformation, ESPN's raw
`mMatchupScore`/`mScoreboard`/`mBoxscore` JSON -> locked stat blocks: score/
winner, top-3 starters by actual points, biggest over/under-performer vs.
projection), `espn.fetchWeekMatchups()`, `lib/compose.ts` (merges the ESPN
side with real Firestore manager-history per matchup — the main/renderer
split this whole app has used throughout), a real `screens/Compose.tsx`
("New Post" pulls a week, renders each matchup's locked stats read-only —
rich text/media/publish is still Phase 3b, not built yet), and basic
Compose/Settings nav in `App.tsx` (previously hardcoded to Settings only).

**Two more real, empirically-found issues, both fixed and reverified**:
- **The pinned UID had drifted again** between the last entry and this one
  — a background Firebase-emulator shell process died across a session
  restart (unrelated to the app itself), and separately the real anonymous
  session needed reconfirming was still `FlOBcCHWiNc1jPx55IJaDHnOYej2` from
  the prior entry's fix. Confirmed still correct and stable — no further
  action needed, but worth knowing this UID is a real, monitorable value,
  not a one-time constant to forget about.
- **`schedule` covers the WHOLE SEASON, not the requested week** — first
  real end-to-end run of the "New Post" flow returned 70 matchups instead
  of 5 for a 10-team league. Root cause: ESPN's `schedule` array in the
  league object holds every matchup across all 14 matchup periods; the
  field that actually identifies which week an entry belongs to is
  `matchupPeriodId`, confirmed by inspecting the real response directly
  (first 5 of 70 entries all show `matchupPeriodId: 1`, `id: 1..5`) — this
  filter was simply missing. Fixed, rebuilt, reverified: exactly 5
  matchups for Week 1, matching the league's real 10-team roster with no
  duplicates.

**Also deployed live this session, both confirmed working end-to-end
against production** (both required explicit confirmation first, per
CLAUDE.md's hard rule, same as every other live change this session):
- `getManagerHistory` Cloud Function — was emulator-only until now; the
  first real "New Post" attempt failed with a clean `not-found` error
  (the callable genuinely didn't exist in the deployed project), which is
  what prompted the deploy. Confirmed via `manhist` and the full
  `composenewpost` flow immediately after.
- The Cloud Functions deploy surfaced one harmless warning worth knowing
  about: no artifact-registry cleanup policy is set for `us-central1`,
  which just means old container build images will accumulate a small
  storage cost over many future deploys. Not fixed this session — cheap to
  address later via `firebase functions:artifacts:setpolicy` whenever
  convenient, not urgent at this deploy volume.

**Current real state of the pipeline, tested against the real league
(303458)**: since the 2026 season hasn't drafted yet (late July), every
score comes back 0-0 (no real games played) — but the full chain is
proven correct end-to-end with real data: real ESPN teams/rosters/
projections, real starters vs. bench filtering, real top-scorer/over-
under-performer computation, real Firestore manager-history merge, real
saved draft. **Once real games exist (Sept+), this should produce genuinely
correct recap content without further changes** — though the `BENCH_SLOTS`
lineup-slot-id assumption in `matchupCompute.ts` is still flagged
unconfirmed against a real played week (see that file's own comment) and
is worth a quick sanity check once real actual-points data exists.

**What's left, not part of the original 9-task plan** (Phase 3b/4 from the
plan doc): rich-text commentary editing per matchup section (port of
`OutlineBuilder.tsx`'s pattern, already identified as the right approach),
GIF/image media, the live preview pane, autosave, "Post to Website"
(create/update/delete against the real `posts` collection — the rules
already support this, just not wired to real UI yet), post history/edit/
delete, and the deferred `mailto:` notification opt-in.

**Owner action**: none blocking. All 9 originally-planned tasks are done;
next phase is the follow-on work listed above whenever picked back up.

---

## 2026-07-27 (6) — Follow-on features built: the app is now a complete v1

Direct continuation, same day. Owner asked to build out everything listed as
"still ahead" in the entry above. All of it is now built and verified.

**Built**: `components/RichNotesBox.tsx` (ported from `podcast-app`'s
`OutlineBuilder.tsx` execCommand pattern), wired into Intro/Standings/
Conclusion and each matchup's commentary. `lib/postAssembly.ts`
(`assembleBodyHtml`) combines the structured draft into the one HTML blob
the site actually stores — reused by both the preview pane and the real
publish call, so they can never drift apart. `lib/gifs.ts` + `components/
GifPicker.tsx` (Giphy search + shared library tab, same SDK key and
`gifLibrary` collection the message board already uses). `lib/media.ts` +
`components/ImageUploader.tsx` (Storage upload, same path convention).
`components/PreviewPane.tsx` (mirrors `Post.dc.html`'s real inline styles).
`lib/compose.ts`'s `publishDraft` (wraps the already-proven `createRecapPost`/
`updateRecapPost`), `loadDraftForEditing` (local draft first, raw-bodyHtml
fallback per the plan's structured-edit design), `deletePublishedPost`
(cascades to the matching local draft too, so a stale `firestorePostId`
can't later break a republish). `screens/History.tsx` (list/edit/delete).
Debounced autosave in `Compose.tsx` (2s after typing stops). `lib/
notifications.ts` (opt-in `mailto:` BCC using real `league_members` emails,
appears only after a successful publish).

**A real bug caught by an actual screenshot, not just typecheck**: the
first version of `assembleBodyHtml` used inline styles (bordered/colored
stat cards) — rendered as completely plain unstyled text. Root cause:
`sanitizeHtml.ts`'s allowlist (a real stored-XSS defense shared across 10
accounts) strips every attribute except `href` on `<a>`, including every
`style` attribute. Fixed by redesigning the generated markup to use only
the tags the sanitizer actually keeps (`p`/`strong`/`ul`/`li`) instead of
loosening that security boundary for visual polish — confirmed via a
second screenshot showing clean, correctly-sanitized output. **Lesson**:
verify anything passing through `sanitizeHtml` by actually looking at the
rendered result, not just trusting styled markup will survive.

**A second real bug, this time in test infrastructure, not the app**:
copying the real `espn-auth.json` into the emulator's isolated userData
directory (to test the full pipeline against real ESPN data) silently
failed to decrypt. Root cause: Electron's `safeStorage` on Windows wraps
DPAPI with a *per-profile* key stored in that profile's own `Local State`
file, not a portable OS-user-wide key — ciphertext genuinely cannot cross
`userData` directories even for the same Windows user. Not a bug in the
app; a real constraint on how `safeStorage` works. Fixed by rescoping the
publish self-test to a hand-built draft instead of chaining real ESPN data
through it — arguably the more correctly-scoped test anyway, since
Task #9's `composenewpost` test already fully covers the ESPN side.

**Two more narrow Firestore rule additions, each confirmed with the owner
before deploying** (same discipline as every other live change this
session): `manager_history` read access (needed the roster doc directly in
the renderer for ESPN-name matching) and `league_members` read access
(real email addresses — flagged explicitly as more sensitive than prior
grants, since it's contact PII rather than league-internal display data;
the app only ever uses it to build a local `mailto:` link, nothing is
transmitted by the app itself). Both live and verified against production.

**Minor, lower-stakes than the earlier credential leak but worth noting**:
a self-test log line printed a partial real member email address while
verifying the notifications feature. Not a secret and not an account-access
risk, but real PII that didn't need to be shown — the test's own pass/fail
assertion already covered what needed verifying. Being more careful about
this going forward, same spirit as the earlier (more serious) ESPN
credential-logging incident.

**Verified end-to-end, all passing**: `boot`, `draftroundtrip`,
`authpersist`, `manhist`, `espnmatch`, `composenewpost`, `composepublish`
(emulator, full create → verify → update → verify → delete cycle),
`autosave` (confirmed via the real local draft file, no explicit save
click), `notifications` (real `league_members` query, 10 active emails,
correct `mailto:` construction) — plus two real screenshots (Compose
screen with rich text/matchup cards/GIF-and-image UI; the live Preview
pane) actually looked at, not just trusted to compile.

**Not done, explicitly out of scope for this pass**: no real recap has
actually been published live (all publish-flow testing was against the
emulator, deliberately, to avoid putting test content on the real board);
the `BENCH_SLOTS` lineup-slot assumption in `matchupCompute.ts` is still
unconfirmed against a real played week; the artifact-registry cleanup
policy warning from the Cloud Function deploy is still unaddressed (low
urgency, cosmetic cost only).

**Owner action**: none blocking. The app is a complete, verified v1 against
every feature in the brief. Real end-to-end use (an actual live game week)
is the next natural checkpoint — worth revisiting the `BENCH_SLOTS`
assumption then.

---

## 2026-07-27 — Message board built, deployed, and fixed live

First session on this project. Two briefs kicked it off: a Fantasy Football
Website Brief (`C:\Users\micha\Downloads\Fantasy Football Website Brief.pdf`)
covering the site's stack/palette/message-board spec, and a Kommissioner's
Kompanion App Brief (`C:\Users\micha\Downloads\
Kommissioners_Kompanion_App_Brief.pdf`) for a not-yet-built desktop app. Full
detail on every decision and bug lives in this repo's Claude Code transcript
for this date; this entry is the durable summary.

**Discovery, before any building**: neither brief's assumptions matched what
was actually on disk.
- The real site wasn't in this repo — found it as
  `C:\Users\micha\Desktop\League Website\NO CSBS Fantasy Football League
  07.08.26.zip`, confirmed byte-identical to the live nocsbs.com (diffed
  against a direct fetch; the only differences were Netlify's own "Pretty
  URLs" serve-time rewriting, not real content drift). Extracted into this
  repo as `site/`.
- Hosting is Netlify (confirmed via DNS SOA record + `server: Netlify`
  response header), deployed via Netlify CLI, not git-connected CI.
- The site runs on a real hand-built templating runtime (`support.js`, a
  "dc-runtime"): `.dc.html` pages with `{{ }}` interpolation / `<sc-if>` /
  `<sc-for>`, compiled to real React (18.3.1, loaded dynamically by
  `support.js` itself from unpkg). No build step by design.
- A Firebase project (`my-project-3c848`) already existed, created one day
  after the site zip's date, with a Firestore DB + registered web app but no
  rules deployed — a prior session had clearly started down the Firebase
  path and stopped. Repurposed it rather than creating a new one; deleted
  the unrelated, untouched Vite+React scaffold that was sitting at this
  repo's root.
- The "manager-vs-manager history" data the Kompanion brief wants a
  read-only endpoint for **already exists**: `site/records-data.js`'s
  `h2h`/`h2hFranchise` objects, keyed by manager ID (survives team
  renames/manager swaps).

**Decisions locked in with the owner**: Firebase (Auth + Firestore +
Storage) as the message board's backend; Google Sign-In only; commissioner
adds members to an allowlist (no open self-signup); real Giphy SDK search
(official `@giphy/js-fetch-api`, not hand-rolled REST calls) using a Giphy
**SDK Key** the owner provided.

**What got built**:
- `site/Message-Board.dc.html` (list page) and `site/Post.dc.html` (full
  post + replies) — new pages, following the site's existing `.dc.html`/
  `DCLogic` component convention.
- `site/message-board.js` — Firebase init (modular SDK via gstatic CDN
  ESM imports, no bundler), Google auth + roster-allowlist check, Firestore
  CRUD for `posts`/`posts/{id}/replies`/`gifLibrary`, Storage image upload,
  Giphy search, and an HTML sanitizer (post bodies are rich HTML from a
  shared contentEditable editor across 10 accounts — a real stored-XSS
  surface; sanitized on both write and read via an allowlist walk).
- Firestore/Storage security rules (`firestore.rules`/`storage.rules`, repo
  root): everything gated through `league_members/{email}` (`active` +
  `role`/`isAdmin`). Two distinct privilege levels: `role:"commissioner"`
  (Brent only) gates posting the pinned Commissioner Recap; `isAdmin:true`
  (Josh + Brent) gates moderating/deleting *any* post, reply, or
  gif-library entry — everyone else only their own.
- Nav updated on all pages: "Message Board" sits right after Home.
- Feature set: title + rich-text (execCommand toolbar, matching the
  podcast app's own notes-editor pattern) composer; GIF picker (live Giphy
  search + a shared library tab any member's picks add to automatically);
  image upload; pinned Commissioner Recap; reply threads (plain text, any
  member); a collapsible feed grouped by best-effort "Week N, Season" (see
  gotcha below); centered header; a floating account chip under the nav.
- All 10 league members seeded into `league_members` with real emails
  (Josh + Brent = `isAdmin`, Brent = `role:"commissioner"`).
- Deployed to production: `netlify deploy --prod --dir=site`, live on
  nocsbs.com. Firebase rules/indexes/auth-provider-config all deployed to
  the real project too.

**Real bugs found and fixed, each caught by actually testing rather than
assuming**:
- Giphy's SDK via esm.sh with the `?bundle` flag 404'd on a nested `uuid`
  dependency — switched to the resolved exact version with no `?bundle`
  (`@giphy/js-fetch-api@5.8.0`), confirmed a real search returns results.
- `seasonWeekOf()`'s year-boundary math mislabeled an August date as
  "Offseason 2025" instead of "Preseason 2026" — fixed by dropping the
  cross-year lookback entirely (a fantasy season runs Sept-Dec within one
  calendar year, so the season year is just the post date's own year).
  **This whole function is a calendar approximation** — there's no real NFL
  schedule data wired in yet; that's the Kompanion app's ESPN integration to
  build, and should replace this heuristic once it exists.
- `Post.dc.html` showed "Post Not Found" for every real post. Root cause:
  the list page linked via a query string (`Post.dc.html?id=...`), and
  Netlify's clean-URL redirect (confirmed also reproducing on the local
  `serve`-based dev server) strips query strings on redirect but leaves the
  path rewritten — `window.location.search` came back completely empty.
  Fixed by switching to a URL fragment (`Post.dc.html#<id>`), which is never
  sent to the server and survives any redirect.
- The pinned-recap Firestore query needs a composite index
  (`isCommissionerRecap` + `createdAt`); `firebase deploy --only
  firestore:indexes` reported success twice without the index actually
  existing (confirmed via `firestore_list_indexes` coming back empty both
  times). Created it directly via the `firestore_create_index` MCP tool
  instead, which worked and is now `state: READY`. **Don't trust
  `firebase deploy --only firestore:indexes`'s success message in this
  environment — verify with `firestore_list_indexes`.**
- Sign-in gate flashed briefly on every navigation even for an already
  signed-in member. Cause: `renderVals()` decided what to show as soon as
  the Firebase module object existed, before `onAuthStateChanged` had
  actually resolved — during that window `mb.user` was still its initial
  `null`. Fixed by additionally gating on `mb.ready` (only set `true` once,
  inside the auth callback itself), rendering nothing during that brief
  window instead of the wrong screen.
- The Google OAuth consent screen showed the raw project number instead of
  a friendly name — fixed via `firebase_init`'s `oAuthBrandDisplayName`
  (now "No CSBS FF Website") + `firebase deploy --only auth`. Note: the
  *separate*, earlier "Sign in to continue to my-project-3c848
  .firebaseapp.com" domain-disclosure screen is Google's own anti-phishing
  UI and is not customizable to an arbitrary name — owner chose to leave it
  (would require a custom auth domain, e.g. `auth.nocsbs.com`, to change).
- `auth/operation-not-allowed` on first live sign-in attempt: Google
  Sign-In was never actually enabled as a provider (separate from the
  consent-screen branding). Fixed via `firebase_init`'s
  `auth.providers.googleSignIn`, but note **`firebase_init` alone only
  stages the config — needed an explicit `firebase deploy --only auth`
  after it to actually push live.**
- Composer's contentEditable body area had no background of its own
  (inherited the card's color, unreadable) and its `data-placeholder`
  attribute did nothing because the `:empty:before{content:attr(...)}` CSS
  rule to actually render it was never added — both fixed to match the
  title field's treatment.

**Owner action / still open**:
- Giphy dashboard login issues were the owner's to resolve — key was
  obtained and wired in, working.
- Netlify auth is persisted on this machine (`AppData\Roaming\netlify`) and
  the project is linked (`.netlify/state.json`) — future deploys can run
  directly via `netlify deploy --prod --dir=site` without a login step, but
  **always ask before actually pushing live**, per the hard rule in
  `CLAUDE.md`.
- Week/season grouping is a calendar approximation (see above) — replace
  once the Kompanion app's ESPN integration exists.

## Next steps: Kommissioner's Kompanion App (not started)

New, separate desktop app — not part of `podcast-app/` (different tool,
different intended user: the commissioner's recap-publishing tool vs. the
podcast host's production tool). Recommend scaffolding as its own sibling
folder (e.g. `kompanion-app/`), following `podcast-app/`'s Electron + React
+ TypeScript precedent unless the owner wants otherwise.

In the order the brief itself specifies:

1. **Investigate the ESPN data-access approach first, before writing app
   code** — the brief requires this explicitly: research authenticated-
   session browser automation (reusing the commissioner's existing ESPN
   login) vs. a screenshot-capture-and-parse fallback, and present the
   tradeoffs (reliability, maintenance burden, breakage risk) to the owner
   before implementation begins.
2. **Manager-vs-manager history is easier than the brief assumes** — already
   exists in `site/records-data.js`'s `h2h`/`h2hFranchise` (see above). The
   "scoped read-only endpoint" the brief wants can be a narrow Firestore
   read (or a small Cloud Function) against this same Firebase project —
   no new backend needed from scratch.
3. **Open architecture question, worth resolving early**: the brief wants
   "no login required" for the desktop app, but it also needs scoped write
   access to the *same* Firestore `posts` collection the website uses.
   Firestore's security model fundamentally wants an authenticated identity
   to check rules against — reconcile these before building the publish
   flow (a scoped service-style credential with tightly-written rules
   recognizing it is one option; there may be better ones).
4. **Core features per brief**: New Post Creation (ESPN-populated matchup
   sections — score/winner, top 3 scorers/team, over/under-performers vs.
   projections, manager-vs-manager history — all locked/non-editable, with
   freeform commissioner commentary around them); Draft & Preview + autosave;
   Rich Text Formatting (reuse the same execCommand toolbar already built
   for the message board); Media (reuse the Giphy SDK + Firebase Storage
   patterns already built); Publishing ("Post to Website" writes to `posts`
   with `isCommissionerRecap:true`); optional opt-in email notifications
   (email service not yet chosen; check ESPN for roster contact info,
   manual-entry fallback); Post Management (view/edit/delete history);
   Visual Design — the app brief specifies dark green-black `#0B1710` /
   cream `#F4EFE1` / gold `#C9A227`, which is **close but not identical** to
   the message board's actual shipped colors (`#0c2b17`/`#e8ddc3`/
   `#f2c94c`) — worth confirming with the owner whether the app should
   match the site exactly or use its own brief-specified values.
5. **Open/optional per brief** (explicitly "still open for consideration,"
   not committed scope): weekly awards/superlatives auto-suggested from the
   data; a second admin/co-commissioner login.
