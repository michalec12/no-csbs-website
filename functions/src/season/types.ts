// Types for the in-season ESPN pipeline.
//
// The first block came from the Kompanion app, which since 2026-08-29 lives in
// its own repo: github.com/michalec12/kommissioners-kompanion, file
// src/shared/types.ts. Having them identical is what let the compute logic come
// across unchanged (see matchupCompute.ts / espnMatch.ts in this folder).
//
// Three of these names still exist there and are still structurally identical
// -- PlayerStatLine, RosterEntry, ComputedMatchup -- and if either side changes
// they must change together. Nothing enforces that across two repos. The other
// three (EspnTeam, EspnTeamMember, EspnManagerMatch) were deleted app-side when
// this pipeline took ESPN matching over, so this is now their only home; the
// heading below used to over-claim by covering all six.
//
// The second block is the Firestore document shapes the website reads. The app
// mirrors five of them under a Season* prefix -- SeasonMeta is its
// SeasonMetaDoc, StandingsRow its SeasonStandingsRow, PowerRankRow its
// SeasonPowerRankRow, ResolvedMatchup its SeasonResolvedMatchup, WeekDoc its
// SeasonWeekDoc -- so grepping the same name across the two repos will not find
// them. A field added here and not there is read as undefined and renders blank
// in a published recap, with no error on either side.

// ---- Shared with kommissioners-kompanion's src/shared/types.ts -----------

export interface PlayerStatLine {
  playerName: string
  position: string
  actualPoints: number
  projectedPoints: number | null
}

export interface EspnTeamMember {
  espnId: string // ESPN owner GUID, e.g. "{2762C1D8-...}"
  name: string // real first+last name, as ESPN itself returns it
}

export interface EspnTeam {
  espnTeamId: number
  ownerEspnIds: string[] // usually one; two for a co-owned franchise
}

/** Mirrors manager_history/roster's shape in Firestore (seeded from the
 *  site's own league-data.js MEMBERS). */
export interface RosterEntry {
  id: string
  name: string
  team: string
  handle: string
}

export interface EspnManagerMatch {
  espnTeamId: number
  managerId: string | null
  managerName: string | null
  matchedEspnName: string | null
  confidence: 'exact' | 'fuzzy' | 'none'
}

/** A single matchup's stats, still keyed by ESPN team id (not yet resolved
 *  to manager id) -- see matchupCompute.ts. */
export interface ComputedMatchup {
  espnTeamIdA: number
  espnTeamIdB: number
  scoreA: number
  scoreB: number
  winner: 'A' | 'B' | 'tie'
  topScorersA: PlayerStatLine[]
  topScorersB: PlayerStatLine[]
  overPerformerA: PlayerStatLine | null
  underPerformerA: PlayerStatLine | null
  overPerformerB: PlayerStatLine | null
  underPerformerB: PlayerStatLine | null
}

// ---- Raw ESPN response slices -------------------------------------------

/** Confirmed live against the real league (mTeam view), not assumed from
 *  generic ESPN docs: record.overall carries pointsAgainst / streakLength /
 *  streakType alongside the obvious wins/losses/ties/pointsFor, and `name`
 *  is a real top-level field (NOT the location+nickname pair older ESPN
 *  league responses used). */
export interface EspnRawTeam {
  id: number
  name?: string
  abbrev?: string
  logo?: string
  playoffSeed?: number
  owners?: string[]
  record?: {
    overall?: {
      wins?: number
      losses?: number
      ties?: number
      pointsFor?: number
      pointsAgainst?: number
      streakLength?: number
      streakType?: string
    }
  }
}

export interface EspnRawScheduleSide {
  teamId: number
  totalPoints?: number
}

export interface EspnRawScheduleEntry {
  id?: number
  matchupPeriodId: number
  winner?: string
  playoffTierType?: string
  home?: EspnRawScheduleSide
  away?: EspnRawScheduleSide
}

export interface EspnStatus {
  currentMatchupPeriod?: number
  latestScoringPeriod?: number
  finalScoringPeriod?: number
  firstScoringPeriod?: number
  isActive?: boolean
}

export interface EspnLeagueResponse {
  seasonId?: number
  status?: EspnStatus
  teams?: EspnRawTeam[]
  members?: { id: string; firstName?: string; lastName?: string }[]
  schedule?: EspnRawScheduleEntry[]
  settings?: {
    name?: string
    isPublic?: boolean
    scheduleSettings?: {
      matchupPeriodCount?: number
      playoffTeamCount?: number
    }
  }
}

// ---- Firestore document shapes (what the website reads) ------------------

export interface SeasonMeta {
  seasonId: number
  /** The week currently being played. */
  currentWeek: number
  /** Last week with real, finished data. 0 before Week 1 completes. */
  latestCompletedWeek: number
  regSeasonWeeks: number
  playoffTeamCount: number
  isActive: boolean
  /** Set by refreshSeasonData (the weekly full compute). */
  lastRefreshed: string | null
  /** Set by refreshLiveScores (the in-game poll). */
  lastLiveUpdate: string | null
  /** True while odds are still the pre-season historical seed rather than a
   *  real simulation off actual scoring data. */
  oddsAreSeed: boolean
}

export interface StandingsRow {
  managerId: string | null
  espnTeamId: number
  team: string
  logoUrl: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  rank: number
  streak: string
}

export interface PowerRankRow {
  managerId: string | null
  espnTeamId: number
  team: string
  rank: number
  /** Change vs. last week's power rank. Positive = moved up. */
  delta: number
  rating: number
  madePlayoffsPct: number
  titlePct: number
}

export interface LiveScoreEntry {
  espnTeamId: number
  points: number
}

export interface LiveDoc {
  week: number
  inProgress: boolean
  updatedAt: string
  scores: LiveScoreEntry[]
}

export interface ResolvedMatchup extends ComputedMatchup {
  managerIdA: string | null
  managerIdB: string | null
  teamA: string
  teamB: string
  /** All-time head-to-head, from managerIdA's point of view. Pre-joined here
   *  so a consumer needs one read instead of a callable per matchup -- the
   *  Kompanion app used to fetch this itself via the getManagerHistory
   *  callable, once per matchup, on every "New Post". Null when either
   *  manager is unresolved or the pair has no recorded history. */
  history: { wins: number; losses: number } | null
}

/** Nested map from the `manager_history/h2h` doc: h2h[a][b] = { w, l }. */
export type H2hMap = Record<string, Record<string, { w?: number; l?: number }>>

/** ESPN team id -> logo, seeded by the Kompanion app for logos on ESPN's
 *  auth-gated host (which this function cannot fetch -- it has no session).
 *  See season_data/{seasonId}/logos in firestore.rules. */
export type LogoOverrides = Record<number, string>

export interface WeekHighScore {
  managerId: string | null
  team: string
  score: number
  oppManagerId: string | null
  oppTeam: string
  oppScore: number
  players: { name: string; pos: string; pts: number }[]
}

export interface WeekAwards {
  blowout: { margin: number; winnerTeam: string; loserTeam: string } | null
  nailbiter: { margin: number; winnerTeam: string; loserTeam: string } | null
  topPerformer: { name: string; pos: string; pts: number; team: string } | null
  bust: { name: string; pos: string; pts: number; projected: number; team: string } | null
}

export interface WeekDoc {
  week: number
  matchups: ResolvedMatchup[]
  highScore: WeekHighScore | null
  awards: WeekAwards
  computedAt: string
}
