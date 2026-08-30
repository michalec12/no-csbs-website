// Turns raw ESPN responses into the exact documents the website reads.
// Pure functions only -- no Firestore, no network. That keeps every piece
// here testable against a saved ESPN payload without touching production.
import { computeWeekMatchups, starterLinesByTeam } from './matchupCompute'
import type { TeamSeasonState } from './odds'
import type {
  ComputedMatchup,
  EspnRawScheduleEntry,
  EspnRawTeam,
  H2hMap,
  LogoOverrides,
  PlayerStatLine,
  PowerRankRow,
  ResolvedMatchup,
  StandingsRow,
  WeekAwards,
  WeekDoc,
  WeekHighScore
} from './types'

export interface TeamInfo {
  espnTeamId: number
  name: string
  logo: string
  managerId: string | null
}

export function buildTeamInfo(
  teams: EspnRawTeam[],
  managerIds: Map<number, string | null>,
  logos: LogoOverrides = {}
): Map<number, TeamInfo> {
  const out = new Map<number, TeamInfo>()
  for (const t of teams) {
    out.set(t.id, {
      espnTeamId: t.id,
      name: (t.name ?? '').trim() || `Team ${t.id}`,
      // A seeded override always wins. Most ESPN logos are plain public URLs,
      // but some point at mystique-api.fantasy.espn.com, which 401s without an
      // ESPN session -- this function has none, so those would render broken
      // for every site visitor. The Kompanion app (which does have a session)
      // seeds them as data: URLs into season_data/{id}/logos.
      logo: logos[t.id] ?? t.logo ?? '',
      managerId: managerIds.get(t.id) ?? null
    })
  }
  return out
}

/** Ties count as half a win for ordering; the displayed tiebreak below the
 *  win column is total points scored, matching the league's real
 *  playoffSeedingRule (TOTAL_POINTS_SCORED). */
export function buildStandings(teams: EspnRawTeam[], info: Map<number, TeamInfo>): StandingsRow[] {
  const rows = teams.map((t) => {
    const o = t.record?.overall ?? {}
    const ti = info.get(t.id)
    return {
      managerId: ti?.managerId ?? null,
      espnTeamId: t.id,
      team: ti?.name ?? `Team ${t.id}`,
      logoUrl: ti?.logo ?? '',
      wins: o.wins ?? 0,
      losses: o.losses ?? 0,
      ties: o.ties ?? 0,
      pointsFor: round2(o.pointsFor ?? 0),
      pointsAgainst: round2(o.pointsAgainst ?? 0),
      rank: 0,
      streak: formatStreak(o.streakType, o.streakLength)
    }
  })

  rows.sort((a, b) => {
    const aw = a.wins + a.ties * 0.5
    const bw = b.wins + b.ties * 0.5
    if (bw !== aw) return bw - aw
    return b.pointsFor - a.pointsFor
  })
  rows.forEach((r, i) => (r.rank = i + 1))
  return rows
}

/** ESPN reports streakType WIN/LOSS/NONE with a length. Pre-season every
 *  team is NONE/0, which renders as an em dash rather than "W0". */
function formatStreak(type: string | undefined, length: number | undefined): string {
  if (!type || type === 'NONE' || !length) return '—'
  const letter = type === 'WIN' ? 'W' : type === 'LOSS' ? 'L' : 'T'
  return `${letter}${length}`
}

/** Per-team weekly scores pulled straight from the schedule's totalPoints.
 *  Deliberately does NOT need the heavy per-week boxscore payloads -- one
 *  mMatchupScore call carries every week's final totals, which is all the
 *  odds model and power rankings need. */
export function buildSeasonStates(
  teams: EspnRawTeam[],
  schedule: EspnRawScheduleEntry[],
  latestCompletedWeek: number
): TeamSeasonState[] {
  const scores = new Map<number, number[]>()
  for (const t of teams) scores.set(t.id, [])

  const completed = schedule
    .filter((m) => m.matchupPeriodId <= latestCompletedWeek)
    .sort((a, b) => a.matchupPeriodId - b.matchupPeriodId)

  for (const m of completed) {
    for (const side of [m.home, m.away]) {
      if (!side || side.teamId === undefined) continue
      const arr = scores.get(side.teamId)
      if (arr) arr.push(side.totalPoints ?? 0)
    }
  }

  return teams.map((t) => {
    const o = t.record?.overall ?? {}
    return {
      espnTeamId: t.id,
      wins: o.wins ?? 0,
      losses: o.losses ?? 0,
      ties: o.ties ?? 0,
      pointsFor: o.pointsFor ?? 0,
      weeklyScores: scores.get(t.id) ?? []
    }
  })
}

/** All-time head-to-head from managerIdA's side. Same lookup shape as the
 *  getManagerHistory callable (functions/src/index.ts) -- h2h[a][b] = {w,l} --
 *  but resolved here, once at write time, so consumers get it pre-joined. */
function historyFor(h2h: H2hMap, a: string | null, b: string | null): { wins: number; losses: number } | null {
  if (!a || !b) return null
  const record = h2h[a]?.[b]
  if (!record) return null
  return { wins: record.w ?? 0, losses: record.l ?? 0 }
}

export function buildWeekDoc(
  raw: unknown,
  week: number,
  info: Map<number, TeamInfo>,
  h2h: H2hMap = {}
): WeekDoc {
  const matchups = computeWeekMatchups(raw, week)
  const linesByTeam = starterLinesByTeam(raw, week)

  const resolved: ResolvedMatchup[] = matchups.map((m) => {
    const managerIdA = info.get(m.espnTeamIdA)?.managerId ?? null
    const managerIdB = info.get(m.espnTeamIdB)?.managerId ?? null
    return {
      ...m,
      managerIdA,
      managerIdB,
      teamA: info.get(m.espnTeamIdA)?.name ?? `Team ${m.espnTeamIdA}`,
      teamB: info.get(m.espnTeamIdB)?.name ?? `Team ${m.espnTeamIdB}`,
      history: historyFor(h2h, managerIdA, managerIdB)
    }
  })

  return {
    week,
    matchups: resolved,
    highScore: buildHighScore(resolved, linesByTeam, info),
    awards: buildAwards(resolved, linesByTeam, info),
    computedAt: new Date().toISOString()
  }
}

/** Matches site/pot-data.js's existing record shape (top 5 players), so the
 *  Home page's pot tracker can render historical and in-season records
 *  through the same code path. */
function buildHighScore(
  matchups: ResolvedMatchup[],
  linesByTeam: Map<number, PlayerStatLine[]>,
  info: Map<number, TeamInfo>
): WeekHighScore | null {
  let best: { id: number; score: number; oppId: number; oppScore: number } | null = null

  for (const m of matchups) {
    const sides = [
      { id: m.espnTeamIdA, score: m.scoreA, oppId: m.espnTeamIdB, oppScore: m.scoreB },
      { id: m.espnTeamIdB, score: m.scoreB, oppId: m.espnTeamIdA, oppScore: m.scoreA }
    ]
    for (const s of sides) {
      if (!best || s.score > best.score) best = s
    }
  }
  if (!best || best.score <= 0) return null

  const players = [...(linesByTeam.get(best.id) ?? [])]
    .sort((a, b) => b.actualPoints - a.actualPoints)
    .slice(0, 5)
    .map((p) => ({ name: p.playerName, pos: p.position, pts: round2(p.actualPoints) }))

  return {
    managerId: info.get(best.id)?.managerId ?? null,
    team: info.get(best.id)?.name ?? `Team ${best.id}`,
    score: round2(best.score),
    oppManagerId: info.get(best.oppId)?.managerId ?? null,
    oppTeam: info.get(best.oppId)?.name ?? `Team ${best.oppId}`,
    oppScore: round2(best.oppScore),
    players
  }
}

function buildAwards(
  matchups: ResolvedMatchup[],
  linesByTeam: Map<number, PlayerStatLine[]>,
  info: Map<number, TeamInfo>
): WeekAwards {
  const played = matchups.filter((m) => m.scoreA > 0 || m.scoreB > 0)

  let blowout: WeekAwards['blowout'] = null
  let nailbiter: WeekAwards['nailbiter'] = null
  for (const m of played) {
    const margin = Math.abs(m.scoreA - m.scoreB)
    const winnerTeam = m.scoreA >= m.scoreB ? m.teamA : m.teamB
    const loserTeam = m.scoreA >= m.scoreB ? m.teamB : m.teamA
    const entry = { margin: round2(margin), winnerTeam, loserTeam }
    if (!blowout || margin > blowout.margin) blowout = entry
    if (!nailbiter || margin < nailbiter.margin) nailbiter = entry
  }

  let topPerformer: WeekAwards['topPerformer'] = null
  let bust: WeekAwards['bust'] = null
  for (const [teamId, lines] of linesByTeam) {
    const teamName = info.get(teamId)?.name ?? `Team ${teamId}`
    for (const l of lines) {
      if (!topPerformer || l.actualPoints > topPerformer.pts) {
        topPerformer = { name: l.playerName, pos: l.position, pts: round2(l.actualPoints), team: teamName }
      }
      if (l.projectedPoints === null) continue
      const diff = l.actualPoints - l.projectedPoints
      // Only a starter projected to do real work counts as a bust -- a
      // player projected for 2 points scoring 0 isn't a story.
      if (l.projectedPoints < 5) continue
      const currentWorst = bust ? bust.pts - bust.projected : 0
      if (!bust || diff < currentWorst) {
        bust = {
          name: l.playerName,
          pos: l.position,
          pts: round2(l.actualPoints),
          projected: round2(l.projectedPoints),
          team: teamName
        }
      }
    }
  }

  // Nothing has actually been played -- don't invent a 0-point "winner".
  if (topPerformer && topPerformer.pts <= 0) topPerformer = null

  return { blowout, nailbiter, topPerformer, bust }
}

/** Power rating, deliberately simple enough to explain in one line on the
 *  page: how much you score, how much you win, and how you've been playing
 *  lately. Scores are min-max normalized within the league, so the rating is
 *  explicitly RELATIVE -- 100 means best in the league this week, not "good"
 *  in any absolute sense. */
export function buildPowerRank(
  states: TeamSeasonState[],
  info: Map<number, TeamInfo>,
  odds: Map<number, { madePlayoffsPct: number; titlePct: number }>,
  previousRanks: Map<number, number>
): PowerRankRow[] {
  const ppg = new Map<number, number>()
  const recent = new Map<number, number>()
  const winPct = new Map<number, number>()

  for (const s of states) {
    const games = s.weeklyScores.length
    ppg.set(s.espnTeamId, games ? s.pointsFor / games : 0)
    const last3 = s.weeklyScores.slice(-3)
    recent.set(s.espnTeamId, last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0)
    const decided = s.wins + s.losses + s.ties
    winPct.set(s.espnTeamId, decided ? (s.wins + s.ties * 0.5) / decided : 0)
  }

  const norm = (m: Map<number, number>) => {
    const vals = [...m.values()]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    return (id: number) => (hi === lo ? 0.5 : ((m.get(id) ?? 0) - lo) / (hi - lo))
  }
  const nPpg = norm(ppg)
  const nRecent = norm(recent)

  const rows = states.map((s) => {
    const rating =
      100 * (0.45 * nPpg(s.espnTeamId) + 0.3 * (winPct.get(s.espnTeamId) ?? 0) + 0.25 * nRecent(s.espnTeamId))
    const o = odds.get(s.espnTeamId)
    return {
      managerId: info.get(s.espnTeamId)?.managerId ?? null,
      espnTeamId: s.espnTeamId,
      team: info.get(s.espnTeamId)?.name ?? `Team ${s.espnTeamId}`,
      rank: 0,
      delta: 0,
      rating: round2(rating),
      madePlayoffsPct: o?.madePlayoffsPct ?? 0,
      titlePct: o?.titlePct ?? 0
    }
  })

  rows.sort((a, b) => b.rating - a.rating)
  rows.forEach((r, i) => {
    r.rank = i + 1
    const prev = previousRanks.get(r.espnTeamId)
    // Positive delta = moved UP the board (rank number went down).
    r.delta = prev === undefined ? 0 : prev - r.rank
  })
  return rows
}

/** Ranks by ESPN team id from a previously stored powerRank array. */
export function previousRankMap(rows: PowerRankRow[] | undefined): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of rows ?? []) out.set(r.espnTeamId, r.rank)
  return out
}

export function resolvedMatchupsAreEmpty(matchups: ComputedMatchup[]): boolean {
  return matchups.every((m) => m.scoreA === 0 && m.scoreB === 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
