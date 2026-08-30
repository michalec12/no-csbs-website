/* ============================================================
   NO CSBS Message Board — Firebase + Giphy data module.
   Loaded as <script type="module"> from Message-Board.dc.html.
   Publishes reactive state + actions onto window.NOCSBS_MB;
   the .dc.html page's Component subscribes to it, mirroring how
   Home.dc.html consumes window.NOCSBS_POT (and season-data.js
   consumes window.NOCSBS_SEASON the same way).
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { GiphyFetch } from "https://esm.sh/@giphy/js-fetch-api@5.8.0";

// Firebase web config is not a secret — Firebase's security model is the
// rules deployed alongside it (firestore.rules / storage.rules), not
// hiding this object. Safe to ship in a public static file by design.
const firebaseConfig = {
  apiKey: "AIzaSyCHV8rr-jN3-_9ixKyg2dbw4h0qxNcnDEU",
  authDomain: "my-project-3c848.firebaseapp.com",
  projectId: "my-project-3c848",
  storageBucket: "my-project-3c848.firebasestorage.app",
  messagingSenderId: "27985261340",
  appId: "1:27985261340:web:99deb18e50d553226f00d9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Set window.NOCSBS_GIPHY_KEY = "..." in the page <helmet> before this
// module loads. Uses Giphy's official SDK (GiphyFetch) rather than raw
// REST calls, per Giphy's own recommendation.
const GIPHY_SDK_KEY = window.NOCSBS_GIPHY_KEY || "";
const gf = GIPHY_SDK_KEY ? new GiphyFetch(GIPHY_SDK_KEY) : null;

// ---- HTML sanitizer ---------------------------------------------------
// Post bodies come from a contentEditable rich-text box (execCommand) and
// are shared across all 10 member accounts, so stored HTML is a real
// stored-XSS vector (a compromised/malicious account could inject
// <script>, onerror handlers, javascript: links, etc. against every other
// member who views the board). Allowlist-sanitize on both write and read
// rather than trusting either side alone.
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "DIV", "SPAN", "P", "A"]);
const ALLOWED_ATTRS = { A: new Set(["href"]) };
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  (function walk(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          const text = doc.createTextNode(child.textContent || "");
          node.replaceChild(text, child);
          continue;
        }
        for (const attr of [...child.attributes]) {
          const allowed = ALLOWED_ATTRS[child.tagName];
          if (!allowed || !allowed.has(attr.name)) {
            child.removeAttribute(attr.name);
          } else if (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) {
            child.removeAttribute(attr.name);
          }
        }
        if (child.tagName === "A") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    }
  })(doc.body);
  return doc.body.innerHTML;
}

const state = {
  ready: false,
  user: null, // { uid, name, email, photoURL }
  member: null, // { name, role, active } from league_members, or null
  authError: null,
  pinnedPost: null,
  feedPosts: [],
  gifLibrary: [],
};

const listeners = new Set();
function notify() {
  for (const fn of listeners) fn(state);
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- auth --------------------------------------------------------
async function signIn() {
  state.authError = null;
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (e && e.code !== "auth/popup-closed-by-user") {
      state.authError = e.message || String(e);
    }
    notify();
  }
}
function signOutUser() {
  return signOut(auth);
}

let feedsStarted = false;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const email = (user.email || "").toLowerCase();
    state.user = { uid: user.uid, name: user.displayName, email, photoURL: user.photoURL };
    try {
      const snap = await getDoc(doc(db, "league_members", email));
      state.member = snap.exists() ? snap.data() : null;
    } catch {
      state.member = null;
    }
    if (state.member && state.member.active && !feedsStarted) {
      feedsStarted = true;
      startFeeds();
      startGifLibrary();
    }
  } else {
    state.user = null;
    state.member = null;
  }
  state.ready = true;
  notify();
});

// ---- posts ---------------------------------------------------------
let unsubPinned = null;
let unsubFeed = null;

function startFeeds() {
  const pinnedQ = query(
    collection(db, "posts"),
    where("isCommissionerRecap", "==", true),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  unsubPinned = onSnapshot(pinnedQ, (snap) => {
    state.pinnedPost = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    notify();
  });

  const feedQ = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
  unsubFeed = onSnapshot(feedQ, (snap) => {
    state.feedPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  });
}

function createPost({ title, bodyHtml, isCommissionerRecap, gifUrl, imageUrls }) {
  return addDoc(collection(db, "posts"), {
    title: String(title || "").slice(0, 200),
    authorEmail: state.user.email,
    authorName: (state.member && state.member.name) || state.user.name || state.user.email,
    authorPhotoURL: state.user.photoURL || null,
    bodyHtml: sanitizeHtml(bodyHtml),
    isCommissionerRecap: !!isCommissionerRecap,
    gifUrl: gifUrl || null,
    imageUrls: imageUrls || [],
    createdAt: serverTimestamp(),
    editedAt: null,
  });
}

function updatePost(postId, { title, bodyHtml, gifUrl, imageUrls }) {
  return updateDoc(doc(db, "posts", postId), {
    title: String(title || "").slice(0, 200),
    bodyHtml: sanitizeHtml(bodyHtml),
    gifUrl: gifUrl || null,
    imageUrls: imageUrls || [],
    editedAt: serverTimestamp(),
  });
}

function deletePost(postId) {
  return deleteDoc(doc(db, "posts", postId));
}

function subscribeToPost(postId, cb) {
  return onSnapshot(doc(db, "posts", postId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ---- replies ---------------------------------------------------------
function subscribeReplies(postId, cb) {
  const q = query(collection(db, "posts", postId, "replies"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// A reply may be text, a GIF, or both — a GIF on its own is a perfectly good
// reply on this board, so the "must have text" guard only applies when there
// is no GIF either.
function addReply(postId, body, gifUrl) {
  const text = String(body || "").trim().slice(0, 2000);
  // gifUrl goes straight into an <img src>, and while the picker is the only
  // UI that sets it, the Firestore SDK is reachable from the console by any
  // signed-in member. Restrict to https:// so nothing else can be smuggled
  // into that attribute — same allowlist-don't-trust instinct as sanitizeHtml.
  const gif = typeof gifUrl === "string" && /^https:\/\//i.test(gifUrl) ? gifUrl : null;
  if (!text && !gif) return Promise.resolve();
  return addDoc(collection(db, "posts", postId, "replies"), {
    authorEmail: state.user.email,
    authorName: (state.member && state.member.name) || state.user.name || state.user.email,
    authorPhotoURL: state.user.photoURL || null,
    body: text,
    gifUrl: gif,
    createdAt: serverTimestamp(),
  });
}

function deleteReply(postId, replyId) {
  return deleteDoc(doc(db, "posts", postId, "replies", replyId));
}

// ---- season/week grouping ---------------------------------------------
// Best-effort approximation only — this site has no real NFL schedule data
// wired in yet (that's the future Kompanion app's ESPN integration). A
// fantasy season runs entirely within one calendar year (Sept-Dec, unlike
// the real NFL season which crosses into January/February), so the season
// year is just the post date's own year — no cross-year lookback needed.
// Week 1 is assumed to start the first Thursday on/after Sept 1; anything
// before that is "Preseason", anything past week 18 is "Postseason". Swap
// this out once real schedule data exists — callers only depend on
// {key, label, order}, not the math inside.
function seasonWeekOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const year = d.getFullYear();
  const sept1 = new Date(year, 8, 1);
  const daysToThu = (4 - sept1.getDay() + 7) % 7;
  const week1Start = new Date(year, 8, 1 + daysToThu);
  const diffDays = Math.floor((d - week1Start) / 86400000);
  if (diffDays < 0) {
    return { key: `pre-${year}`, label: `Preseason ${year}`, order: year * 100 };
  }
  const weekNum = Math.floor(diffDays / 7) + 1;
  if (weekNum > 18) {
    return { key: `post-${year}`, label: `Postseason ${year}`, order: year * 100 + 19 };
  }
  return { key: `wk-${year}-${weekNum}`, label: `Week ${weekNum}, ${year}`, order: year * 100 + weekNum };
}

// ---- shared GIF library ---------------------------------------------
let unsubGifs = null;
function startGifLibrary() {
  const q = query(collection(db, "gifLibrary"), orderBy("addedAt", "desc"), limit(60));
  unsubGifs = onSnapshot(q, (snap) => {
    state.gifLibrary = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  });
}

async function searchGifs(term, offset = 0) {
  if (!gf) throw new Error("Giphy SDK key not configured (window.NOCSBS_GIPHY_KEY)");
  const { data } = term
    ? await gf.search(term, { limit: 24, offset })
    : await gf.trending({ limit: 24, offset });
  return data;
}

function addGifToLibrary(gif) {
  return addDoc(collection(db, "gifLibrary"), {
    url: gif.images.fixed_height.url,
    giphyId: String(gif.id),
    addedByEmail: state.user.email,
    addedByName: (state.member && state.member.name) || state.user.name,
    addedAt: serverTimestamp(),
  });
}

// ---- storage ---------------------------------------------------------
async function uploadImage(postKey, file) {
  const path = `message-board/${postKey}/${Date.now()}-${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

window.NOCSBS_MB = {
  subscribe,
  getState: () => state,
  signIn,
  signOut: signOutUser,
  createPost,
  updatePost,
  deletePost,
  subscribeToPost,
  subscribeReplies,
  addReply,
  deleteReply,
  seasonWeekOf,
  searchGifs,
  addGifToLibrary,
  uploadImage,
  sanitizeHtml,
  hasGiphyKey: () => !!gf,
};
notify();
