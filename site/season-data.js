/* ============================================================
   NO CSBS In-Season Data — Firebase module.
   Loaded as <script type="module"> from This-Season.dc.html.
   Publishes reactive state onto window.NOCSBS_SEASON; the page's
   Component subscribes to it, exactly like message-board.js does
   for window.NOCSBS_MB.

   Written by the refreshSeasonData / refreshLiveScores scheduled
   Cloud Functions (functions/src/season). Read-only here — there
   is no client write path, and firestore.rules denies one.

   Unlike message-board.js there is NO auth here: season_data is
   public-read, matching the rest of the site's public historical
   pages. Nothing signs in, and nothing needs to.
   ============================================================ */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Same config as message-board.js — not a secret (Firebase's security model
// is the deployed rules, not hiding this object). Reuses the already-
// initialized app if the message board module happens to be on the page too.
const firebaseConfig = {
  apiKey: "AIzaSyCHV8rr-jN3-_9ixKyg2dbw4h0qxNcnDEU",
  authDomain: "my-project-3c848.firebaseapp.com",
  projectId: "my-project-3c848",
  storageBucket: "my-project-3c848.firebasestorage.app",
  messagingSenderId: "27985261340",
  appId: "1:27985261340:web:99deb18e50d553226f00d9",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---- season id -------------------------------------------------------
   ESPN labels a season by the year it STARTS, so Jan–Jul still belongs to
   the previous ESPN season. Must match currentEspnSeason() in
   functions/src/season/espnClient.ts or the page reads a document the
   pipeline never writes.

   Note the site's own long-standing display convention adds 1 to the
   stored year (league-data.js's champYear, Home.dc.html's potSeason). We
   keep the raw ESPN id in `seasonId` and expose `displaySeason` for
   rendering — never mix the two. */
function currentEspnSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() < 7 ? year - 1 : year;
}

const seasonId = currentEspnSeason();

const state = {
  ready: false,
  seasonId,
  displaySeason: seasonId + 1,
  meta: null,        // { currentWeek, latestCompletedWeek, isActive, oddsAreSeed, ... }
  standings: [],
  powerRank: [],     // includes madePlayoffsPct / titlePct per team
  live: null,        // { week, inProgress, updatedAt, scores: [...] }
  week: null,        // which week the page is currently showing
  weekDoc: null,     // that week's matchups / highScore / awards
  weekLoading: false,
  error: null,
};

const listeners = new Set();
function notify() {
  for (const fn of listeners) fn(state);
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---- season document -------------------------------------------------
   Small (meta + standings + powerRank). The 10-minute live poll writes its
   `live` field, so this listener is what refreshes in-game scores — cheap
   precisely because the big per-week player detail lives in a subcollection
   that this snapshot never touches. */
let unsubWeek = null;

onSnapshot(
  doc(db, "season_data", String(seasonId)),
  (snap) => {
    const data = snap.exists() ? snap.data() : null;
    state.meta = data?.meta ?? null;
    state.standings = data?.standings ?? [];
    state.powerRank = data?.powerRank ?? [];
    state.live = data?.live ?? null;
    state.error = null;

    // Default to the newest week that has real data; before Week 1 finishes
    // there is nothing to show, so fall back to the week being played.
    if (state.week === null && state.meta) {
      const latest = state.meta.latestCompletedWeek || 0;
      setWeek(latest > 0 ? latest : (state.meta.currentWeek || 1));
    }

    state.ready = true;
    notify();
  },
  (err) => {
    state.error = err?.message || String(err);
    state.ready = true;
    notify();
  }
);

/* ---- week document ---------------------------------------------------
   Swapped on demand by the page's week selector. Only one week is
   subscribed at a time — these documents carry every starter's stat line
   for 5 matchups, so holding all 14 open would be wasteful for no gain. */
function setWeek(week) {
  const n = Number(week);
  if (!Number.isFinite(n) || n < 1) return;
  if (state.week === n && unsubWeek) return;

  state.week = n;
  state.weekLoading = true;
  notify();

  if (unsubWeek) { unsubWeek(); unsubWeek = null; }

  unsubWeek = onSnapshot(
    doc(db, "season_data", String(seasonId), "weeks", String(n)),
    (snap) => {
      // A week with no document yet is a normal state (not played, or the
      // refresh hasn't run) — not an error. The page renders an empty-state.
      state.weekDoc = snap.exists() ? snap.data() : null;
      state.weekLoading = false;
      notify();
    },
    (err) => {
      state.weekDoc = null;
      state.weekLoading = false;
      state.error = err?.message || String(err);
      notify();
    }
  );
}

/** Live in-progress score for a team, or null when nothing is live. Falls
 *  back to the stored week result everywhere it returns null. */
function liveScoreFor(espnTeamId) {
  if (!state.live || !state.live.inProgress) return null;
  if (state.week !== state.live.week) return null;
  const hit = (state.live.scores || []).find((s) => s.espnTeamId === espnTeamId);
  return hit ? hit.points : null;
}

window.NOCSBS_SEASON = {
  subscribe,
  getState: () => state,
  setWeek,
  liveScoreFor,
};
