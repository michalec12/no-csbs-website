import { createHash, timingSafeEqual } from 'crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

initializeApp()

// In-season ESPN data pipeline (scheduled refresh + in-game live scores).
// Exported from here so `firebase deploy --only functions` picks them up;
// the implementation lives in ./season. Must come after initializeApp().
export { refreshSeasonData, refreshLiveScores, triggerSeasonRefresh } from './season'

interface GetManagerHistoryRequest {
  managerA: string
  managerB: string
}

interface GetManagerHistoryResponse {
  managerA: string
  managerB: string
  wins: number
  losses: number
}

/**
 * Scoped read-only endpoint for manager-vs-manager head-to-head history, per
 * the Kompanion app brief. Backed by the `manager_history/h2h` doc (seeded
 * from site/records-data.js's h2h object -- NOT h2hFranchise, which folds in
 * inherited roster-slot history across manager swaps, the opposite of what
 * the brief wants: "tracked by manager identity, not team name").
 *
 * Gated on any authenticated client in this project (not narrowed to the
 * pinned Kompanion UID) -- this is small, non-sensitive aggregate data
 * (10x10 win/loss records), same bar the rest of the app's read paths use.
 */
export const getManagerHistory = onCall<GetManagerHistoryRequest, Promise<GetManagerHistoryResponse>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required.')
    }
    const { managerA, managerB } = request.data
    if (!managerA || !managerB) {
      throw new HttpsError('invalid-argument', 'managerA and managerB are required.')
    }

    const snap = await getFirestore().doc('manager_history/h2h').get()
    const record = snap.get(`${managerA}.${managerB}`) as { w: number; l: number } | undefined

    return {
      managerA,
      managerB,
      wins: record?.w ?? 0,
      losses: record?.l ?? 0
    }
  }
)

const KOMPANION_APP_UID = 'kompanion-app-service-account'
const kompanionAppSecret = defineSecret('KOMPANION_APP_SHARED_SECRET')

// SHA-256 both sides first so timingSafeEqual always compares equal-length
// buffers -- a raw length mismatch on the submitted secret would otherwise
// either throw or require a length short-circuit that leaks timing info.
function secretsMatch(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest()
  const digestB = createHash('sha256').update(b).digest()
  return timingSafeEqual(digestA, digestB)
}

/**
 * Mints a Firebase custom token asserting the Kompanion desktop app's
 * identity, gated on a fixed shared secret baked into the built app (never
 * typed in by a user -- keeps the app's "no login required" design intact).
 * Replaces the old design of hardcoding one specific client-generated
 * anonymous-auth UID into the security rules, which drifted and broke the
 * app repeatedly (see firestore.rules' isKompanionApp() history) -- this
 * identity is assigned by the server instead, so it's identical on every
 * machine and every reinstall, forever.
 *
 * setCustomUserClaims (not just the token's own developerClaims arg) makes
 * the claim durable on the user record itself, so it survives the session's
 * later silent token refreshes too, not just the initial sign-in.
 */
export const mintKompanionAppToken = onRequest({ secrets: [kompanionAppSecret] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  const submitted = req.body?.sharedSecret
  if (typeof submitted !== 'string' || !submitted) {
    res.status(400).json({ error: 'sharedSecret is required' })
    return
  }
  if (!secretsMatch(submitted, kompanionAppSecret.value())) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const auth = getAuth()
  const claims = { kompanionApp: true }
  try {
    await auth.setCustomUserClaims(KOMPANION_APP_UID, claims)
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/user-not-found') {
      await auth.createUser({ uid: KOMPANION_APP_UID })
      await auth.setCustomUserClaims(KOMPANION_APP_UID, claims)
    } else {
      throw e
    }
  }
  const token = await auth.createCustomToken(KOMPANION_APP_UID, claims)
  res.status(200).json({ token })
})
