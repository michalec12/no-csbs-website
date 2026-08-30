// Originally lifted verbatim (only the type import path changed) from the
// Kompanion app's src/main/services/matchupCompute.ts. That file was pure --
// its only dependency was `import type` -- which is exactly why it lifted into
// a Cloud Function unchanged.
//
// The two-copies problem an earlier version of this comment warned about is
// RESOLVED: the app's copy is gone, and the app reads this function's
// already-computed output out of Firestore instead of recomputing it. This is
// the single source of truth for matchup compute. The app is now a separate
// repo, github.com/michalec12/kommissioners-kompanion.
//
// What the app still owns is ORIENTATION, and that coupling is live. This
// function keeps ESPN's real away/home order with a real 'A' | 'B' | 'tie'
// winner, because the website's scoreboard wants that. The app flips every
// matchup so the winner is always side A (its seasonMapping.ts winnerLeft())
// and inverts the head-to-head record along with it. Do not "fix" the order
// here to match what the app displays -- the flip is the app's job, and doing
// it on both sides publishes the record from the wrong manager's point of view.
//
// Pure transformation: raw ESPN mMatchupScore/mScoreboard/mBoxscore JSON ->
// ComputedMatchup[]. Field names confirmed directly against the real league
// (303458): schedule[].away/home.rosterForCurrentScoringPeriod.entries[],
// each with playerPoolEntry.player.stats[] keyed by scoringPeriodId +
// statSourceId (0 = actual, 1 = projected) + appliedTotal (already scored
// for this league's own settings -- no need to decode raw stat categories).
//
// BENCH_SLOTS confirmed against the real league's own roster config
// (mSettings, settings.rosterSettings.lineupSlotCounts): {"20":6,"21":2} --
// exactly the league's 6 bench + 2 IR slots -- alongside starter counts
// {"0":1,"2":2,"4":2,"6":1,"16":1,"17":1,"23":2} (1 QB, 2 RB, 2 WR, 1 TE,
// 1 D/ST, 1 K, 2 FLEX = 10 starters).
//
// STILL OPEN, must be verified at Week 1: this confirms the slot *counts*
// only, not that a real scored player's own rosterForCurrentScoringPeriod
// entry reports the same lineupSlotId. If it's wrong, every score and every
// "top performer" on the website is wrong. See the plan's Phase 3.
import type { ComputedMatchup, PlayerStatLine } from './types'

const BENCH_SLOTS = new Set([20, 21]) // BENCH (6 slots), IR (2 slots)

// id 1, not 0, is what real quarterbacks actually report in this league's
// live data -- confirmed directly against real QBs (Josh Allen, Jalen Hurts,
// Caleb Williams, Drake Maye, Trevor Lawrence, Dak Prescott, Brock Purdy),
// none of whom are "Team QB" -- just ordinary starters.
const POSITION_NAMES: Record<number, string> = {
  0: 'QB',
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'D/ST',
  17: 'K',
  23: 'FLEX'
}

interface EspnPlayerStat {
  scoringPeriodId: number
  statSourceId: number
  appliedTotal: number
}

interface EspnRosterEntry {
  lineupSlotId: number
  playerPoolEntry?: {
    player?: {
      fullName?: string
      defaultPositionId?: number
      stats?: EspnPlayerStat[]
    }
  }
}

interface EspnTeamSide {
  teamId: number
  rosterForCurrentScoringPeriod?: { entries?: EspnRosterEntry[] }
}

interface EspnScheduleEntry {
  away: EspnTeamSide
  home: EspnTeamSide
  matchupPeriodId: number
}

function statFor(entry: EspnRosterEntry, scoringPeriodId: number, statSourceId: number): number | null {
  const stat = entry.playerPoolEntry?.player?.stats?.find(
    (s) => s.scoringPeriodId === scoringPeriodId && s.statSourceId === statSourceId
  )
  return stat ? stat.appliedTotal : null
}

function extractStarterLines(entries: EspnRosterEntry[], scoringPeriodId: number): PlayerStatLine[] {
  return entries
    .filter((e) => !BENCH_SLOTS.has(e.lineupSlotId))
    .map((e) => ({
      playerName: e.playerPoolEntry?.player?.fullName ?? 'Unknown Player',
      position: POSITION_NAMES[e.playerPoolEntry?.player?.defaultPositionId ?? -1] ?? '?',
      actualPoints: statFor(e, scoringPeriodId, 0) ?? 0,
      projectedPoints: statFor(e, scoringPeriodId, 1)
    }))
}

function topScorers(lines: PlayerStatLine[], n = 3): PlayerStatLine[] {
  return [...lines].sort((a, b) => b.actualPoints - a.actualPoints).slice(0, n)
}

function biggestOverUnder(lines: PlayerStatLine[]): { over: PlayerStatLine | null; under: PlayerStatLine | null } {
  const withProjection = lines.filter((l) => l.projectedPoints !== null)
  if (withProjection.length === 0) return { over: null, under: null }
  const byDiff = [...withProjection].sort(
    (a, b) => b.actualPoints - b.projectedPoints! - (a.actualPoints - a.projectedPoints!)
  )
  // A single data point can't be both the best AND worst performer -- only
  // show it once (as the over-performer, arbitrarily) rather than twice.
  if (byDiff.length === 1) return { over: byDiff[0], under: null }
  return { over: byDiff[0], under: byDiff[byDiff.length - 1] }
}

export function computeWeekMatchups(rawLeagueData: unknown, week: number): ComputedMatchup[] {
  const data = rawLeagueData as { schedule?: EspnScheduleEntry[] }

  // `schedule` covers the WHOLE SEASON (confirmed against the real league:
  // 70 entries for a 10-team/14-matchup-period league, 5 per week), not just
  // the requested week -- matchupPeriodId is what identifies which week each
  // entry belongs to. Missing this filter was a real bug caught by a
  // self-test returning 70 matchups instead of 5.
  return (data.schedule ?? [])
    .filter((m) => m.matchupPeriodId === week)
    .map((m) => {
      const aEntries = m.away?.rosterForCurrentScoringPeriod?.entries ?? []
      const bEntries = m.home?.rosterForCurrentScoringPeriod?.entries ?? []
      const aLines = extractStarterLines(aEntries, week)
      const bLines = extractStarterLines(bEntries, week)
      const scoreA = Math.round(aLines.reduce((sum, l) => sum + l.actualPoints, 0) * 100) / 100
      const scoreB = Math.round(bLines.reduce((sum, l) => sum + l.actualPoints, 0) * 100) / 100
      const overUnderA = biggestOverUnder(aLines)
      const overUnderB = biggestOverUnder(bLines)

      const result: ComputedMatchup = {
        espnTeamIdA: m.away?.teamId,
        espnTeamIdB: m.home?.teamId,
        scoreA,
        scoreB,
        winner: scoreA === scoreB ? 'tie' : scoreA > scoreB ? 'A' : 'B',
        topScorersA: topScorers(aLines),
        topScorersB: topScorers(bLines),
        overPerformerA: overUnderA.over,
        underPerformerA: overUnderA.under,
        overPerformerB: overUnderB.over,
        underPerformerB: overUnderB.under
      }
      return result
    })
    .filter((m) => m.espnTeamIdA !== undefined && m.espnTeamIdB !== undefined)
}

/** All starter lines for a week, keyed by ESPN team id -- needed for the
 *  weekly high-score record (top 5 players) and the "top performer" award,
 *  which need more than the top-3 ComputedMatchup already carries. */
export function starterLinesByTeam(rawLeagueData: unknown, week: number): Map<number, PlayerStatLine[]> {
  const data = rawLeagueData as { schedule?: EspnScheduleEntry[] }
  const out = new Map<number, PlayerStatLine[]>()
  for (const m of data.schedule ?? []) {
    if (m.matchupPeriodId !== week) continue
    for (const side of [m.away, m.home]) {
      if (!side || side.teamId === undefined) continue
      out.set(side.teamId, extractStarterLines(side.rosterForCurrentScoringPeriod?.entries ?? [], week))
    }
  }
  return out
}
