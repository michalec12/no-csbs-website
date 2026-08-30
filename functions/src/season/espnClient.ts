// Unauthenticated ESPN fantasy API client.
//
// This league is PUBLIC (settings.isPublic === true), which is why no
// cookies, no browser and no custom headers are needed -- verified directly
// against the real league with a bare curl: HTTP 200 + real JSON.
//
// The host matters and is easy to get wrong: lm-api-reads.fantasy.espn.com,
// NOT fantasy.espn.com. The latter has no API backend at this path and
// silently serves the SPA app shell instead, which historically read as a
// bot-detection block and sent the Kompanion app down a much more
// complicated path (see src/main/services/espn.ts's corrected comment in
// github.com/michalec12/kommissioners-kompanion). The JSON content-type
// assertion below exists to make that exact
// failure loud rather than silent if it ever recurs.
//
// NEVER log raw request or response headers here. A prior session leaked
// real credentials into tool output doing exactly that while debugging ESPN
// (WEBSITE_SESSIONS.md). Nothing in this file needs header contents.
import type { EspnLeagueResponse } from './types'

const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons'
export const LEAGUE_ID = '303458'

const REQUEST_TIMEOUT_MS = 20_000

/** Payload sizes measured against the real league, gzipped over the wire:
 *  mSettings+mStatus 1.7 KB, mTeam 7 KB, mMatchupScore 62 KB,
 *  mBoxscore 55 KB. mRoster is 1.1 MB uncompressed -- never request it. */
export async function fetchLeague(
  season: number,
  views: string[],
  extraParams: Record<string, string> = {}
): Promise<EspnLeagueResponse> {
  const params = new URLSearchParams()
  for (const v of views) params.append('view', v)
  for (const [k, v] of Object.entries(extraParams)) params.append(k, v)

  const url = `${ESPN_API_BASE}/${season}/segments/0/leagues/${LEAGUE_ID}?${params.toString()}`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })

  if (!res.ok) {
    throw new Error(`ESPN API ${res.status} for views=[${views.join(',')}]`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    // Almost certainly means the base URL regressed to a host that serves
    // the SPA shell -- see this file's header comment.
    throw new Error(
      `ESPN API returned non-JSON (contentType=${contentType}) for views=[${views.join(',')}] -- check ESPN_API_BASE`
    )
  }

  return (await res.json()) as EspnLeagueResponse
}

/** Cheapest possible call (1.7 KB) -- used to decide whether there is any
 *  work to do before pulling anything heavy. */
export async function fetchStatus(season: number): Promise<EspnLeagueResponse> {
  return fetchLeague(season, ['mSettings', 'mStatus'])
}

/** Standings, team names, logos, records. */
export async function fetchTeams(season: number): Promise<EspnLeagueResponse> {
  return fetchLeague(season, ['mTeam'])
}

/** Full player-level detail for one week. */
export async function fetchWeekBoxscore(season: number, week: number): Promise<EspnLeagueResponse> {
  return fetchLeague(season, ['mMatchupScore', 'mScoreboard', 'mBoxscore'], {
    scoringPeriodId: String(week)
  })
}

/** Team totals only -- what the in-game live poll uses. Deliberately does
 *  NOT request mBoxscore: live scoring only needs each side's totalPoints,
 *  and this keeps the polled payload to ~62 KB. */
export async function fetchLiveScores(season: number): Promise<EspnLeagueResponse> {
  return fetchLeague(season, ['mMatchupScore'])
}

/** The ESPN season id for "right now". The NFL season spans a calendar-year
 *  boundary: ESPN labels it by the year it STARTS, so Jan-Jul belongs to the
 *  previous ESPN season. Note the website separately displays seasonId + 1
 *  (see league-data.js) -- that conversion happens at render, never here. */
export function currentEspnSeason(now: Date = new Date()): number {
  const year = now.getUTCFullYear()
  // Through July, the most recent season is still last year's.
  return now.getUTCMonth() < 7 ? year - 1 : year
}
