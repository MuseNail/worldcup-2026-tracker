// ── Official, validated FIFA 2026 knockout bracket ──────────────────────────
// Verified against the official bracket (en.wikipedia.org/wiki/2026_FIFA_World
// _Cup_knockout_stage): nodes r32-1..16 correspond to FIFA matches 73..88, and
// the advancement wiring below matched ESPN's own feed wiring on all 8 R16, 4
// QF, 2 SF, Final and Third-place matches. ESPN's "Round of 32 N" === FIFA match
// number (72+N) — NOT the event-id order, which is jumbled.
//
// We hardcode the structure and overlay the live ESPN fixtures onto it by
// identity (R32 by group-slot, later rounds by their feeder references).

// R32 slot codes per node. '1X' = winner of group X, '2X' = runner-up X,
// '3' = a best-third slot (wildcard — not needed to identify the match).
export const R32_DEF = {
  1: ['2A', '2B'], 2: ['1E', '3'], 3: ['1F', '2C'], 4: ['1C', '2F'],
  5: ['1I', '3'], 6: ['2E', '2I'], 7: ['1A', '3'], 8: ['1L', '3'],
  9: ['1D', '3'], 10: ['1G', '3'], 11: ['2K', '2L'], 12: ['1H', '2J'],
  13: ['1B', '3'], 14: ['1J', '2H'], 15: ['1K', '3'], 16: ['2D', '2G'],
}

// Default feeder wiring (node → its two source nodes). Home/away alignment is
// taken from the live ESPN fixture when available; this is the fallback order.
export const FEEDERS = {
  'r16-1': ['r32-2', 'r32-5'], 'r16-2': ['r32-1', 'r32-3'],
  'r16-3': ['r32-4', 'r32-6'], 'r16-4': ['r32-7', 'r32-8'],
  'r16-5': ['r32-11', 'r32-12'], 'r16-6': ['r32-9', 'r32-10'],
  'r16-7': ['r32-14', 'r32-16'], 'r16-8': ['r32-13', 'r32-15'],
  'qf-1': ['r16-1', 'r16-2'], 'qf-2': ['r16-5', 'r16-6'],
  'qf-3': ['r16-3', 'r16-4'], 'qf-4': ['r16-7', 'r16-8'],
  'sf-1': ['qf-1', 'qf-2'], 'sf-2': ['qf-3', 'qf-4'],
  'final': ['sf-1', 'sf-2'],
  'third': ['sf-1', 'sf-2'], // losers
}

export const ROUND_KEYS = ['r32', 'r16', 'qf', 'sf', 'final', 'third']
const roundOf = (key) => key.split('-')[0]

// R32 identity key (non-third slot codes, sorted) → node number.
const R32_KEY_TO_N = {}
for (const n in R32_DEF) {
  const key = R32_DEF[n].filter((c) => c !== '3').sort().join(',')
  R32_KEY_TO_N[key] = Number(n)
}
// Feeder-set → node, per later round (to map an ESPN fixture by its references).
const FEEDERSET_TO_NODE = {}
for (const node in FEEDERS) {
  if (node === 'final' || node === 'third') continue
  FEEDERSET_TO_NODE[`${roundOf(node)}|${[...FEEDERS[node]].sort().join(',')}`] = node
}

// Parse a placeholder slot string into a feeder reference.
function parseRef(name) {
  let m
  if ((m = /Round of 32\s+(\d+)\s+(Winner|Loser)/i.exec(name))) return { feeder: `r32-${m[1]}`, side: m[2].toLowerCase() }
  if ((m = /Round of 16\s+(\d+)\s+(Winner|Loser)/i.exec(name))) return { feeder: `r16-${m[1]}`, side: m[2].toLowerCase() }
  if ((m = /Quarterfinal\s+(\d+)\s+(Winner|Loser)/i.exec(name))) return { feeder: `qf-${m[1]}`, side: m[2].toLowerCase() }
  if ((m = /Semifinal\s+(\d+)\s+(Winner|Loser)/i.exec(name))) return { feeder: `sf-${m[1]}`, side: m[2].toLowerCase() }
  return null
}

// Group-position code for an R32 slot (from placeholder text or a real team).
function slotCode(team, posOf) {
  if (team.logo && team.id && posOf[team.id]) {
    const p = posOf[team.id]
    return p.pos >= 3 ? '3' : `${p.pos}${p.group}`
  }
  const name = team.name || ''
  let m
  if ((m = /Group\s+([A-L])\s+Winner/i.exec(name))) return `1${m[1].toUpperCase()}`
  if ((m = /Group\s+([A-L])\s+(2nd|Runner)/i.exec(name))) return `2${m[1].toUpperCase()}`
  if (/Third Place|3rd/i.test(name)) return '3'
  return '?'
}

// Build the bracket: hardcoded nodes with the live ESPN fixture overlaid.
export function buildBracket(matches, groups) {
  const posOf = {}
  groups.forEach((g) => g.standings.forEach((r, i) => { posOf[r.team.id] = { group: g.letter, pos: i + 1 } }))

  const nodes = {}
  const make = (key) => ({ key, round: roundOf(key), espn: null, slotA: null, slotB: null })
  for (let n = 1; n <= 16; n++) nodes[`r32-${n}`] = make(`r32-${n}`)
  for (let n = 1; n <= 8; n++) nodes[`r16-${n}`] = make(`r16-${n}`)
  for (let n = 1; n <= 4; n++) nodes[`qf-${n}`] = make(`qf-${n}`)
  nodes['sf-1'] = make('sf-1'); nodes['sf-2'] = make('sf-2')
  nodes['final'] = make('final'); nodes['third'] = make('third')

  // ── Map ESPN R32 fixtures → r32 nodes by group-slot identity ──
  const r32 = matches.filter((m) => m.round === 'r32')
  const usedR32 = new Set()
  const leftover = []
  for (const m of r32) {
    const codes = [slotCode(m.home, posOf), slotCode(m.away, posOf)].filter((c) => c !== '3' && c !== '?')
    const key = codes.sort().join(',')
    const n = R32_KEY_TO_N[key]
    if (n && !usedR32.has(n)) {
      usedR32.add(n)
      attachR32(nodes[`r32-${n}`], m)
    } else {
      leftover.push(m)
    }
  }
  // Fallback: any unmatched R32 fixtures fill remaining nodes by date order.
  if (leftover.length) {
    const free = []
    for (let n = 1; n <= 16; n++) if (!usedR32.has(n)) free.push(n)
    leftover.sort((a, b) => new Date(a.date) - new Date(b.date))
    leftover.forEach((m, i) => { if (free[i]) attachR32(nodes[`r32-${free[i]}`], m) })
  }

  // ── Map later-round ESPN fixtures → nodes by their feeder references ──
  for (const m of matches) {
    if (!['r16', 'qf', 'sf', 'final', 'third'].includes(m.round)) continue
    const a = parseRef(m.home.name)
    const b = parseRef(m.away.name)
    let nodeKey
    if (m.round === 'final') nodeKey = 'final'
    else if (m.round === 'third') nodeKey = 'third'
    else if (a && b) nodeKey = FEEDERSET_TO_NODE[`${m.round}|${[a.feeder, b.feeder].sort().join(',')}`]
    if (!nodeKey || !nodes[nodeKey]) continue
    const node = nodes[nodeKey]
    node.espn = espnMeta(m)
    node.slotA = feederSlot(a, m.home, FEEDERS[nodeKey][0])
    node.slotB = feederSlot(b, m.away, FEEDERS[nodeKey][1])
  }
  // Ensure every later node has slots even if its ESPN fixture wasn't found.
  for (const key in FEEDERS) {
    const node = nodes[key]
    const side = key === 'third' ? 'loser' : 'winner'
    if (!node.slotA) node.slotA = { feeder: FEEDERS[key][0], side, team: null }
    if (!node.slotB) node.slotB = { feeder: FEEDERS[key][1], side, team: null }
  }
  return nodes
}

function attachR32(node, m) {
  node.espn = espnMeta(m)
  node.slotA = { team: real(m.home), label: m.home.name }
  node.slotB = { team: real(m.away), label: m.away.name }
}
function feederSlot(ref, team, fallbackFeeder) {
  return {
    feeder: ref ? ref.feeder : fallbackFeeder,
    side: ref ? ref.side : 'winner',
    team: real(team),
  }
}
function real(t) {
  return t && t.logo && t.name !== 'TBD' ? { id: t.id, name: t.name, logo: t.logo, abbrev: t.abbrev } : null
}
function espnMeta(m) {
  return {
    id: m.id, date: m.date, state: m.state, status: m.status, completed: m.completed,
    venue: m.venue, home: m.home, away: m.away,
  }
}

// Winner team-id of a decided ESPN fixture on a node, else null.
export function realWinnerId(node) {
  const e = node.espn
  if (!e || e.state !== 'post') return null
  if (e.home.winner) return e.home.id
  if (e.away.winner) return e.away.id
  if (e.home.score != null && e.away.score != null) {
    if (e.home.score > e.away.score) return e.home.id
    if (e.away.score > e.home.score) return e.away.id
  }
  return null
}
export function realLoserId(node) {
  const w = realWinnerId(node)
  if (!w || !node.espn) return null
  return node.espn.home.id === w ? node.espn.away.id : node.espn.home.id
}

// ── Resolve the two participants of a node (real teams flow in via ESPN;
//    undecided ones flow in from the user's predictions of feeder nodes) ──────
export function resolveNodeTeams(key, nodes, preds, cache = {}) {
  if (cache[key]) return cache[key]
  cache[key] = { a: null, b: null } // guard against cycles
  const node = nodes[key]
  if (!node) return cache[key]
  const r = node.round === 'r32'
    ? { a: (node.slotA && node.slotA.team) || null, b: (node.slotB && node.slotB.team) || null }
    : { a: resolveSlot(node.slotA, nodes, preds, cache), b: resolveSlot(node.slotB, nodes, preds, cache) }
  cache[key] = r
  return r
}
function resolveSlot(slot, nodes, preds, cache) {
  if (!slot) return null
  if (slot.team) return slot.team // ESPN already placed the real team
  if (!slot.feeder) return null
  return slot.side === 'loser'
    ? loserTeamOf(slot.feeder, nodes, preds, cache)
    : winnerTeamOf(slot.feeder, nodes, preds, cache)
}
export function winnerTeamOf(key, nodes, preds, cache = {}) {
  const { a, b } = resolveNodeTeams(key, nodes, preds, cache)
  const rw = realWinnerId(nodes[key])
  if (rw) return a && a.id === rw ? a : b && b.id === rw ? b : null
  const pick = preds[key]
  if (pick) return a && a.id === pick ? a : b && b.id === pick ? b : null
  return null
}
export function loserTeamOf(key, nodes, preds, cache = {}) {
  const { a, b } = resolveNodeTeams(key, nodes, preds, cache)
  const rl = realLoserId(nodes[key])
  if (rl) return a && a.id === rl ? a : b && b.id === rl ? b : null
  const pick = preds[key]
  if (pick && a && b) return a.id === pick ? b : b.id === pick ? a : null
  return null
}
// Like resolveNodeTeams, but tags WHY each team is in its slot:
//   'real' = an actual qualified team / real result;  'pred' = your prediction.
export function resolveNodeInfo(key, nodes, preds, cache = {}) {
  const node = nodes[key]
  if (!node) return { a: { team: null, source: null }, b: { team: null, source: null } }
  if (node.round === 'r32') {
    return {
      a: { team: (node.slotA && node.slotA.team) || null, source: node.slotA && node.slotA.team ? 'real' : null },
      b: { team: (node.slotB && node.slotB.team) || null, source: node.slotB && node.slotB.team ? 'real' : null },
    }
  }
  return { a: slotInfo(node.slotA, nodes, preds, cache), b: slotInfo(node.slotB, nodes, preds, cache) }
}
function slotInfo(slot, nodes, preds, cache) {
  if (!slot) return { team: null, source: null }
  if (slot.team) return { team: slot.team, source: 'real' }
  if (!slot.feeder) return { team: null, source: null }
  const realId = slot.side === 'loser' ? realLoserId(nodes[slot.feeder]) : realWinnerId(nodes[slot.feeder])
  const team = slot.side === 'loser'
    ? loserTeamOf(slot.feeder, nodes, preds, cache)
    : winnerTeamOf(slot.feeder, nodes, preds, cache)
  if (!team) return { team: null, source: null }
  return { team, source: realId ? 'real' : 'pred' }
}

// Drop picks whose chosen team is no longer a participant (after an upstream change).
export function prunePicks(nodes, preds) {
  let cur = { ...preds }
  for (let pass = 0; pass < 8; pass++) {
    const cache = {}
    const dead = []
    for (const key in cur) {
      if (!cur[key]) { dead.push(key); continue }
      const { a, b } = resolveNodeTeams(key, nodes, cur, cache)
      if (!((a && a.id === cur[key]) || (b && b.id === cur[key]))) dead.push(key)
    }
    if (!dead.length) break
    dead.forEach((k) => delete cur[k])
  }
  return cur
}
