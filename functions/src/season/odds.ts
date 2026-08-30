// Playoff + championship odds via Monte Carlo simulation.
//
// ESPN exposes NO odds field for this league -- confirmed across
// mTeam+mStatus+mStandings in a prior session (unlike some other ESPN
// fantasy sports, there is no currentSimulationResults/playoffPct here). So
// this is computed from scratch off real scoring data.
//
// The league's real rules drive the model, read from mSettings rather than
// assumed: 10 teams, 14-week regular season, 6 playoff teams, 1-week
// playoff rounds (weeks 15-17), and seeding tiebreak TOTAL_POINTS_SCORED.
import type { EspnRawScheduleEntry } from './types'

export interface TeamSeasonState {
  espnTeamId: number
  wins: number
  losses: number
  ties: number
  pointsFor: number
  /** Every completed week's score, in week order. */
  weeklyScores: number[]
}

export interface OddsResult {
  espnTeamId: number
  madePlayoffsPct: number
  titlePct: number
}

const SIM_COUNT = 20_000

// How much a team's own scoring average is trusted vs. the league average.
// With n games played the team's own mean gets weight n/(n+K). At K=4 a team
// is ~20% "itself" after 1 week and ~78% after 14 -- deliberately heavy
// regression early, because a 1-2 game sample says almost nothing and
// unregressed odds after Week 1 would swing absurdly.
const REGRESSION_K = 4

/** Deterministic PRNG (mulberry32). Seeded so that re-running the weekly
 *  refresh on unchanged data produces identical odds instead of jittering by
 *  a few tenths of a percent each time -- keeps the whole pipeline
 *  idempotent, same as the week docs. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller. Fantasy weekly scores aren't perfectly normal (they're mildly
 *  right-skewed), but normal is more than good enough at this sample size
 *  and keeps the model explainable. */
function normalSample(rng: () => number, mean: number, stdev: number): number {
  const u1 = Math.max(rng(), 1e-12)
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdev
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

function stdev(xs: number[], m: number): number {
  if (xs.length < 2) return 0
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

interface TeamModel {
  espnTeamId: number
  mean: number
  stdev: number
}

/** Blends each team toward the league average based on how much has actually
 *  been played. With zero games played every team is identical, which is the
 *  honest answer pre-season. */
function buildModels(teams: TeamSeasonState[]): TeamModel[] {
  const allScores = teams.flatMap((t) => t.weeklyScores)
  // Sensible priors for a 1-PPR league if literally nothing has been played.
  const leagueMean = allScores.length ? mean(allScores) : 110
  const leagueStdev = allScores.length >= 2 ? stdev(allScores, leagueMean) : 25

  return teams.map((t) => {
    const n = t.weeklyScores.length
    const teamMean = n ? mean(t.weeklyScores) : leagueMean
    const weight = n / (n + REGRESSION_K)
    const blendedMean = weight * teamMean + (1 - weight) * leagueMean
    // Team-level stdev needs more data than the mean does to mean anything,
    // so lean on the league-wide spread until a team has a real sample.
    const teamStdev = n >= 4 ? stdev(t.weeklyScores, teamMean) : leagueStdev
    const blendedStdev = Math.max(weight * teamStdev + (1 - weight) * leagueStdev, 5)
    return { espnTeamId: t.espnTeamId, mean: blendedMean, stdev: blendedStdev }
  })
}

interface SimTeam {
  espnTeamId: number
  wins: number
  ties: number
  pointsFor: number
}

/** Seeding: wins desc, then TOTAL POINTS SCORED desc -- the league's real
 *  playoffSeedingRule. Ties count as half a win, matching how the standings
 *  themselves order. */
function seedOrder(sim: SimTeam[]): SimTeam[] {
  return [...sim].sort((a, b) => {
    const aw = a.wins + a.ties * 0.5
    const bw = b.wins + b.ties * 0.5
    if (bw !== aw) return bw - aw
    return b.pointsFor - a.pointsFor
  })
}

function playGame(rng: () => number, a: TeamModel, b: TeamModel): 0 | 1 {
  const sa = normalSample(rng, a.mean, a.stdev)
  const sb = normalSample(rng, b.mean, b.stdev)
  return sa >= sb ? 0 : 1
}

export function simulateOdds(
  teams: TeamSeasonState[],
  schedule: EspnRawScheduleEntry[],
  regSeasonWeeks: number,
  latestCompletedWeek: number,
  playoffTeamCount: number
): OddsResult[] {
  const models = buildModels(teams)
  const modelById = new Map(models.map((m) => [m.espnTeamId, m]))

  // Only regular-season games that haven't been played yet.
  const remaining = schedule.filter(
    (m) =>
      m.matchupPeriodId > latestCompletedWeek &&
      m.matchupPeriodId <= regSeasonWeeks &&
      m.home?.teamId !== undefined &&
      m.away?.teamId !== undefined
  )

  const madePlayoffs = new Map<number, number>()
  const titles = new Map<number, number>()
  for (const t of teams) {
    madePlayoffs.set(t.espnTeamId, 0)
    titles.set(t.espnTeamId, 0)
  }

  const rng = makeRng(0x5eed ^ (latestCompletedWeek * 7919))

  for (let sim = 0; sim < SIM_COUNT; sim++) {
    const state = new Map<number, SimTeam>(
      teams.map((t) => [
        t.espnTeamId,
        { espnTeamId: t.espnTeamId, wins: t.wins, ties: t.ties, pointsFor: t.pointsFor }
      ])
    )

    for (const game of remaining) {
      const homeId = game.home!.teamId
      const awayId = game.away!.teamId
      const hm = modelById.get(homeId)
      const am = modelById.get(awayId)
      const hs = state.get(homeId)
      const as = state.get(awayId)
      if (!hm || !am || !hs || !as) continue

      const homeScore = normalSample(rng, hm.mean, hm.stdev)
      const awayScore = normalSample(rng, am.mean, am.stdev)
      hs.pointsFor += homeScore
      as.pointsFor += awayScore
      if (homeScore > awayScore) hs.wins++
      else if (awayScore > homeScore) as.wins++
      else {
        hs.ties++
        as.ties++
      }
    }

    const seeded = seedOrder([...state.values()]).slice(0, playoffTeamCount)
    for (const t of seeded) madePlayoffs.set(t.espnTeamId, (madePlayoffs.get(t.espnTeamId) ?? 0) + 1)

    const champion = simulateBracket(rng, seeded, modelById)
    if (champion !== null) titles.set(champion, (titles.get(champion) ?? 0) + 1)
  }

  return teams.map((t) => ({
    espnTeamId: t.espnTeamId,
    madePlayoffsPct: round1(((madePlayoffs.get(t.espnTeamId) ?? 0) / SIM_COUNT) * 100),
    titlePct: round1(((titles.get(t.espnTeamId) ?? 0) / SIM_COUNT) * 100)
  }))
}

/** The league's real 6-team, 1-week-per-round bracket over weeks 15-17:
 *  seeds 1-2 get a bye, 3v6 and 4v5 play the opening round, then the top
 *  remaining seed is re-paired against the lowest surviving seed. Falls back
 *  to a straight single-elimination pairing for any other playoff size so a
 *  settings change doesn't break the refresh outright. */
function simulateBracket(
  rng: () => number,
  seeded: SimTeam[],
  modelById: Map<number, TeamModel>
): number | null {
  if (seeded.length === 0) return null
  if (seeded.length === 1) return seeded[0].espnTeamId

  // seedRank: index in `seeded` (0 = 1 seed). Carried through so re-pairing
  // by seed works after each round.
  let alive = seeded.map((t, i) => ({ id: t.espnTeamId, seed: i }))

  if (alive.length === 6) {
    const byes = alive.slice(0, 2)
    const round1 = [
      [alive[2], alive[5]],
      [alive[3], alive[4]]
    ]
    const winners = round1.map(([a, b]) => {
      const ma = modelById.get(a.id)
      const mb = modelById.get(b.id)
      if (!ma || !mb) return a
      return playGame(rng, ma, mb) === 0 ? a : b
    })
    alive = [...byes, ...winners].sort((a, b) => a.seed - b.seed)
  }

  while (alive.length > 1) {
    const next: typeof alive = []
    // Re-pair highest seed vs. lowest surviving seed each round.
    const ordered = [...alive].sort((a, b) => a.seed - b.seed)
    while (ordered.length > 1) {
      const high = ordered.shift()!
      const low = ordered.pop()!
      const mh = modelById.get(high.id)
      const ml = modelById.get(low.id)
      if (!mh || !ml) {
        next.push(high)
        continue
      }
      next.push(playGame(rng, mh, ml) === 0 ? high : low)
    }
    // Odd bracket size -- the leftover team advances on a bye.
    if (ordered.length === 1) next.push(ordered[0])
    alive = next
  }

  return alive[0]?.id ?? null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
