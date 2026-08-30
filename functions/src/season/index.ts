// In-season ESPN data pipeline.
//
// Two scheduled functions write everything the website's "This Season" page
// reads. Nothing here is client-writable -- see firestore.rules'
// season_data block, which is public-read and write-denied; these run
// through the Admin SDK, which bypasses rules entirely.
//
// Cloud Scheduler's free tier is 3 jobs. This uses 2, which is why the live
// poll is ONE cron expression covering all three game days rather than three
// separate jobs. Don't split it without checking that budget.
import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { createHash, timingSafeEqual } from 'crypto'
import { currentEspnSeason, fetchLiveScores, fetchStatus, fetchTeams, fetchWeekBoxscore } from './espnClient'
import { matchEspnTeamsToRoster, resolveManagerIds } from './espnMatch'
import {
  buildPowerRank,
  buildSeasonStates,
  buildStandings,
  buildTeamInfo,
  buildWeekDoc,
  previousRankMap
} from './compute'
import { simulateOdds } from './odds'
import type {
  EspnRawTeam,
  H2hMap,
  LiveDoc,
  LogoOverrides,
  PowerRankRow,
  RosterEntry,
  SeasonMeta
} from './types'

const TIMEZONE = 'America/Chicago'

function db() {
  return getFirestore()
}

function seasonDoc(seasonId: number) {
  return db().doc(`season_data/${seasonId}`)
}

/** A week counts as complete only once ESPN has moved PAST it. Using
 *  latestScoringPeriod alone would treat an in-progress Sunday as finished
 *  (it advances as soon as the week's first game starts), which would lock
 *  in half-played scores and badly skew the odds model. */
function deriveWeeks(status: {
  latestScoringPeriod?: number
  currentMatchupPeriod?: number
}): { currentWeek: number; latestCompletedWeek: number } {
  const latest = status.latestScoringPeriod ?? 0
  const current = status.currentMatchupPeriod ?? 1
  return {
    currentWeek: current,
    latestCompletedWeek: Math.max(0, Math.min(latest, current - 1))
  }
}

async function loadRoster(): Promise<RosterEntry[]> {
  try {
    const snap = await db().doc('manager_history/roster').get()
    const data = snap.data() as Record<string, { name?: string; team?: string; handle?: string }> | undefined
    if (!data) return []
    return Object.entries(data).map(([id, v]) => ({
      id,
      name: v.name ?? '',
      team: v.team ?? '',
      handle: v.handle ?? ''
    }))
  } catch (err) {
    // Name matching is the nicety; ESPN_TEAM_MAPPING is the real fallback.
    // A roster read failure must not take down the whole weekly refresh.
    console.warn('roster load failed, falling back to hardcoded mapping', errMessage(err))
    return []
  }
}

/** All-time head-to-head, read ONCE per refresh rather than once per matchup.
 *  Same doc the getManagerHistory callable reads (functions/src/index.ts). */
async function loadH2h(): Promise<H2hMap> {
  try {
    const snap = await db().doc('manager_history/h2h').get()
    return (snap.data() as H2hMap | undefined) ?? {}
  } catch (err) {
    // History is a nice-to-have on a recap, not the point of the refresh.
    console.warn('h2h load failed, matchups will carry no all-time record', errMessage(err))
    return {}
  }
}

/** Logos seeded by the Kompanion app for ESPN's auth-gated image host, which
 *  this function cannot fetch. Absent is the normal case for most teams. */
async function loadLogoOverrides(seasonId: number): Promise<LogoOverrides> {
  try {
    const snap = await seasonDoc(seasonId).collection('logos').get()
    const out: LogoOverrides = {}
    for (const d of snap.docs) {
      const url = (d.data() as { dataUrl?: string }).dataUrl
      if (url) out[Number(d.id)] = url
    }
    return out
  } catch (err) {
    console.warn('logo overrides load failed, using raw ESPN logo urls', errMessage(err))
    return {}
  }
}

async function resolveTeamManagers(
  teams: EspnRawTeam[],
  members: { id: string; firstName?: string; lastName?: string }[]
) {
  const roster = await loadRoster()
  const matches = matchEspnTeamsToRoster(
    teams.map((t) => ({ espnTeamId: t.id, ownerEspnIds: t.owners ?? [] })),
    members.map((m) => ({ espnId: m.id, name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() })),
    roster
  )
  return resolveManagerIds(matches)
}

export async function runSeasonRefresh(): Promise<{ seasonId: number; latestCompletedWeek: number; weeksWritten: number }> {
  const seasonId = currentEspnSeason()
  const status = await fetchStatus(seasonId)
  const sched = status.settings?.scheduleSettings ?? {}
  const regSeasonWeeks = sched.matchupPeriodCount ?? 14
  const playoffTeamCount = sched.playoffTeamCount ?? 6
  const { currentWeek, latestCompletedWeek } = deriveWeeks(status.status ?? {})

  const baseMeta: Omit<SeasonMeta, 'lastLiveUpdate'> = {
    seasonId,
    currentWeek,
    latestCompletedWeek,
    regSeasonWeeks,
    playoffTeamCount,
    isActive: status.status?.isActive ?? false,
    lastRefreshed: new Date().toISOString(),
    oddsAreSeed: latestCompletedWeek === 0
  }

  // Pre-season / off-season: no games played yet. Record where we are and
  // stop -- this is a normal state, not an error. Everything below needs
  // real scoring data to mean anything.
  if (latestCompletedWeek === 0) {
    await seasonDoc(seasonId).set({ meta: baseMeta }, { merge: true })
    console.log(`season ${seasonId}: no completed weeks yet (currentWeek=${currentWeek}) -- meta only`)
    return { seasonId, latestCompletedWeek: 0, weeksWritten: 0 }
  }

  const [teamsRes, scheduleRes, h2h, logos] = await Promise.all([
    fetchTeams(seasonId),
    fetchLiveScores(seasonId),
    loadH2h(),
    loadLogoOverrides(seasonId)
  ])
  const teams = teamsRes.teams ?? []
  const schedule = scheduleRes.schedule ?? []
  const managerIds = await resolveTeamManagers(teams, teamsRes.members ?? [])
  const info = buildTeamInfo(teams, managerIds, logos)

  const standings = buildStandings(teams, info)
  const states = buildSeasonStates(teams, schedule, latestCompletedWeek)

  // Backfill any missing week, and ALWAYS recompute the most recent one --
  // ESPN applies stat corrections for a few days after a week ends, so
  // last week's numbers are not final at first write.
  const existing = await seasonDoc(seasonId).collection('weeks').listDocuments()
  const haveWeeks = new Set(existing.map((d) => Number(d.id)))
  let weeksWritten = 0
  for (let week = 1; week <= latestCompletedWeek; week++) {
    if (haveWeeks.has(week) && week !== latestCompletedWeek) continue
    const raw = await fetchWeekBoxscore(seasonId, week)
    const doc = buildWeekDoc(raw, week, info, h2h)
    await seasonDoc(seasonId).collection('weeks').doc(String(week)).set(doc)
    weeksWritten++
  }

  const oddsList = simulateOdds(states, schedule, regSeasonWeeks, latestCompletedWeek, playoffTeamCount)
  const oddsById = new Map(oddsList.map((o) => [o.espnTeamId, o]))

  const prevSnap = await seasonDoc(seasonId).get()
  const prevPower = (prevSnap.data()?.powerRank as PowerRankRow[] | undefined) ?? []
  const powerRank = buildPowerRank(states, info, oddsById, previousRankMap(prevPower))

  await seasonDoc(seasonId).set({ meta: baseMeta, standings, powerRank }, { merge: true })

  console.log(
    `season ${seasonId}: refreshed through week ${latestCompletedWeek} (${weeksWritten} week doc(s) written)`
  )
  return { seasonId, latestCompletedWeek, weeksWritten }
}

export async function runLiveRefresh(): Promise<{ seasonId: number; week: number; wrote: boolean }> {
  const seasonId = currentEspnSeason()
  const status = await fetchStatus(seasonId)
  const { currentWeek, latestCompletedWeek } = deriveWeeks(status.status ?? {})

  // Nothing in progress -- either the season hasn't started or the current
  // week is already finished and the weekly refresh owns it from here.
  if (!status.status?.isActive || currentWeek <= latestCompletedWeek) {
    return { seasonId, week: currentWeek, wrote: false }
  }

  const res = await fetchLiveScores(seasonId)
  const scores = (res.schedule ?? [])
    .filter((m) => m.matchupPeriodId === currentWeek)
    .flatMap((m) =>
      [m.home, m.away]
        .filter((s): s is NonNullable<typeof s> => !!s && s.teamId !== undefined)
        .map((s) => ({ espnTeamId: s.teamId, points: Math.round((s.totalPoints ?? 0) * 100) / 100 }))
    )

  const live: LiveDoc = {
    week: currentWeek,
    inProgress: true,
    updatedAt: new Date().toISOString(),
    scores
  }

  // Written as its own field rather than into the week docs so a 10-minute
  // poll never rewrites the large computed documents.
  await seasonDoc(seasonId).set({ live, meta: { lastLiveUpdate: live.updatedAt } }, { merge: true })
  return { seasonId, week: currentWeek, wrote: true }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Weekly full refresh. Tuesday morning: NFL games finish Monday night, and
 * this lands after ESPN has settled the week.
 */
export const refreshSeasonData = onSchedule(
  { schedule: '0 6 * * 2', timeZone: TIMEZONE, timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await runSeasonRefresh()
  }
)

/**
 * In-game score polling. One cron across all three game days (Thu/Sun/Mon)
 * to stay inside Cloud Scheduler's 3-job free tier. Self-gates: outside an
 * in-progress week it exits after the 1.7 KB status call.
 */
export const refreshLiveScores = onSchedule(
  { schedule: '*/10 12-23 * * 0,1,4', timeZone: TIMEZONE, timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    await runLiveRefresh()
  }
)

const kompanionAppSecret = defineSecret('KOMPANION_APP_SHARED_SECRET')

function secretsMatch(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest()
  const digestB = createHash('sha256').update(b).digest()
  return timingSafeEqual(digestA, digestB)
}

/**
 * Manual trigger for the weekly refresh -- needed to verify a deploy without
 * waiting for Tuesday, and to force a backfill after a missed run.
 *
 * Reuses the existing KOMPANION_APP_SHARED_SECRET rather than inventing a
 * second auth mechanism (same gate as mintKompanionAppToken). This endpoint
 * only writes public, recomputable league data -- it exposes no read path
 * and no user data.
 */
export const triggerSeasonRefresh = onRequest(
  { secrets: [kompanionAppSecret], timeoutSeconds: 540, memory: '512MiB' },
  async (req, res) => {
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
    try {
      const result = await runSeasonRefresh()
      res.status(200).json({ ok: true, ...result })
    } catch (err) {
      console.error('manual season refresh failed', errMessage(err))
      res.status(500).json({ ok: false, error: errMessage(err) })
    }
  }
)
