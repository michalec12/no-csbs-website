// Originally lifted verbatim (only the type import path changed) from the
// Kompanion app's src/shared/espnMatch.ts. That file no longer exists -- it was
// deleted app-side once this pipeline owned ESPN matching -- so this is the
// only copy and there is nothing left to drift against. Kept as a note on
// provenance, not as a sync instruction. The app now lives at
// github.com/michalec12/kommissioners-kompanion.
//
// Matches by real name rather than needing a persisted ESPN-ID-to-manager
// table: ESPN's own mTeam response already returns each owner's real
// first+last name, and the site's roster (manager_history/roster in
// Firestore, seeded from league-data.js's MEMBERS) has real names too --
// confirmed against the real league (303458): every one of the 10 current
// managers matches automatically, including the co-owned "Pat Mgroin" /
// Brandon Jasperson franchise (matches via Brandon Jasperson's own entry,
// since a team's owners are tried in order until one matches).
import type { EspnManagerMatch, EspnTeam, EspnTeamMember, RosterEntry } from './types'

function normalizeName(name: string): string {
  return name
    .replace(/"[^"]*"/g, '') // strip quoted nicknames, e.g. 'Brandon "Soy" Swoyer'
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** First name must match exactly (post-normalize); last name may be a
 *  single-letter abbreviation of the other (handles ESPN's "Casey S" vs.
 *  the site's "Casey Schannauer") or missing entirely on either side. */
function namesMatch(espnName: string, siteName: string): boolean {
  const e = normalizeName(espnName)
  const s = normalizeName(siteName)
  if (!e || !s) return false
  if (e === s) return true
  const [eFirst, eLast = ''] = e.split(' ')
  const [sFirst, sLast = ''] = s.split(' ')
  if (eFirst !== sFirst) return false
  if (!eLast || !sLast) return true
  return eLast === sLast || eLast[0] === sLast[0]
}

export function matchEspnTeamsToRoster(
  teams: EspnTeam[],
  members: EspnTeamMember[],
  roster: RosterEntry[]
): EspnManagerMatch[] {
  const memberByEspnId = new Map(members.map((m) => [m.espnId, m]))

  return teams.map((team) => {
    for (const ownerId of team.ownerEspnIds) {
      const espnMember = memberByEspnId.get(ownerId)
      if (!espnMember) continue
      const rosterMatch = roster.find((r) => namesMatch(espnMember.name, r.name))
      if (rosterMatch) {
        return {
          espnTeamId: team.espnTeamId,
          managerId: rosterMatch.id,
          managerName: rosterMatch.name,
          matchedEspnName: espnMember.name,
          confidence:
            normalizeName(espnMember.name) === normalizeName(rosterMatch.name)
              ? ('exact' as const)
              : ('fuzzy' as const)
        }
      }
    }
    return {
      espnTeamId: team.espnTeamId,
      managerId: null,
      managerName: null,
      matchedEspnName: null,
      confidence: 'none' as const
    }
  })
}

// Ships pre-filled, same reasoning as the Kompanion app's settings.ts DEFAULTS:
// this pipeline serves exactly one league, so the current 10 managers are
// known. Name matching above is the primary path; this is the fallback for
// when ESPN's owner names don't resolve (a renamed account, a new co-owner),
// so a franchise change only needs an edit here rather than breaking the
// weekly refresh.
//
// THIS IS THE ONLY COPY. An earlier version of this comment said to keep it in
// sync with the app's -- but the app's espnTeamMapping setting was deleted when
// this pipeline took the mapping over, so there has been nothing to sync with
// for some time. Editing here is the whole job; do not re-add it app-side.
export const ESPN_TEAM_MAPPING: Record<string, string> = {
  '1': 'brent',
  '2': 'brandonJ',
  '4': 'josh',
  '5': 'alexBoone',
  '6': 'casey',
  '7': 'soy',
  '8': 'alexLam',
  '9': 'buser',
  '10': 'nick',
  '11': 'jake'
}

/** Name matching first, hardcoded mapping as fallback. Returns null only if
 *  both miss -- callers render the ESPN team name alone in that case rather
 *  than failing the whole refresh. */
export function resolveManagerIds(
  matches: EspnManagerMatch[]
): Map<number, string | null> {
  const out = new Map<number, string | null>()
  for (const m of matches) {
    out.set(m.espnTeamId, m.managerId ?? ESPN_TEAM_MAPPING[String(m.espnTeamId)] ?? null)
  }
  return out
}
