// ── World Cup 2026 data model ───────────────────────────────────────────────
// Group results are generated deterministically (seeded) so standings are
// stable across reloads and devices. Knockout matches carry no scores — they
// are upcoming, and their participants flow from group standings + user picks.

// ── Host venues (16 cities) ─────────────────────────────────────────────────
export const VENUES = {
  atlanta: { city: 'Atlanta', stadium: 'Mercedes-Benz Stadium' },
  boston: { city: 'Boston', stadium: 'Gillette Stadium' },
  dallas: { city: 'Dallas', stadium: 'AT&T Stadium' },
  guadalajara: { city: 'Guadalajara', stadium: 'Estadio Akron' },
  houston: { city: 'Houston', stadium: 'NRG Stadium' },
  kansas: { city: 'Kansas City', stadium: 'Arrowhead Stadium' },
  la: { city: 'Los Angeles', stadium: 'SoFi Stadium' },
  mexico: { city: 'Mexico City', stadium: 'Estadio Azteca' },
  miami: { city: 'Miami', stadium: 'Hard Rock Stadium' },
  monterrey: { city: 'Monterrey', stadium: 'Estadio BBVA' },
  newyork: { city: 'New York / NJ', stadium: 'MetLife Stadium' },
  philadelphia: { city: 'Philadelphia', stadium: 'Lincoln Financial Field' },
  bayarea: { city: 'SF Bay Area', stadium: "Levi's Stadium" },
  seattle: { city: 'Seattle', stadium: 'Lumen Field' },
  toronto: { city: 'Toronto', stadium: 'BMO Field' },
  vancouver: { city: 'Vancouver', stadium: 'BC Place' },
}
const VKEYS = Object.keys(VENUES)

// ── Flags ───────────────────────────────────────────────────────────────────
// ISO 3166-1 alpha-2 codes (gb-eng / gb-sct for the home nations) → rendered as
// flagcdn images so flags look identical on every platform (Windows Chrome does
// not render emoji flags). The emoji is kept only as alt/fallback text.
const ISO = {
  Mexico: 'mx', 'South Korea': 'kr', Czechia: 'cz', 'South Africa': 'za',
  Canada: 'ca', Qatar: 'qa', Switzerland: 'ch', 'Bosnia and Herzegovina': 'ba',
  Brazil: 'br', Morocco: 'ma', Haiti: 'ht', Scotland: 'gb-sct',
  USA: 'us', Paraguay: 'py', Australia: 'au', 'Türkiye': 'tr',
  Germany: 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', Ecuador: 'ec',
  Netherlands: 'nl', Japan: 'jp', Sweden: 'se', Tunisia: 'tn',
  Belgium: 'be', Egypt: 'eg', Iran: 'ir', 'New Zealand': 'nz',
  Spain: 'es', 'Cabo Verde': 'cv', 'Saudi Arabia': 'sa', Uruguay: 'uy',
  France: 'fr', Senegal: 'sn', Iraq: 'iq', Norway: 'no',
  Argentina: 'ar', Algeria: 'dz', Austria: 'at', Jordan: 'jo',
  Portugal: 'pt', 'DR Congo': 'cd', Uzbekistan: 'uz', Colombia: 'co',
  England: 'gb-eng', Croatia: 'hr', Ghana: 'gh', Panama: 'pa',
}

// ── Groups (A–L), team order ≈ pot strength ─────────────────────────────────
const GROUP_TEAMS = {
  A: ['Mexico', 'South Korea', 'Czechia', 'South Africa'],
  B: ['Canada', 'Qatar', 'Switzerland', 'Bosnia and Herzegovina'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cabo Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
}

// Per-group accent (Tailwind gradient stops applied inline to avoid purge).
export const GROUP_ACCENT = {
  A: ['#f43f5e', '#fb7185'], B: ['#f97316', '#fb923c'], C: ['#eab308', '#facc15'],
  D: ['#84cc16', '#a3e635'], E: ['#22c55e', '#4ade80'], F: ['#10b981', '#34d399'],
  G: ['#06b6d4', '#22d3ee'], H: ['#3b82f6', '#60a5fa'], I: ['#6366f1', '#818cf8'],
  J: ['#8b5cf6', '#a78bfa'], K: ['#d946ef', '#e879f9'], L: ['#ec4899', '#f472b6'],
}

export const LETTERS = Object.keys(GROUP_TEAMS)

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
// Poisson sample for a goal count given an expected value lambda.
function poisson(rng, lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return Math.min(k - 1, 6)
}

// ── Build teams ─────────────────────────────────────────────────────────────
// strength: pot1 strongest → pot4 weakest, plus a little per-team variance.
function buildTeams() {
  const teams = {}
  for (const L of LETTERS) {
    GROUP_TEAMS[L].forEach((name, idx) => {
      const base = [1.05, 0.45, 0.05, -0.55][idx]
      const noise = ((hash(name) % 100) / 100 - 0.5) * 0.4
      teams[name] = {
        id: name,
        name,
        iso: ISO[name] || 'un',
        group: L,
        seed: idx + 1,
        strength: base + noise,
      }
    })
  }
  return teams
}
export const TEAMS = buildTeams()
export const teamById = (id) => TEAMS[id] || null

// ── Kickoff helper ──────────────────────────────────────────────────────────
// All matches are in June/July 2026 → Pacific is UTC-7. We store the absolute
// instant and always render it in America/Los_Angeles, labeled PST per spec.
const kickoff = (date, time) => `${date}T${time}:00-07:00`

const TIME_SLOTS = ['09:00', '12:00', '15:00', '18:00']

// ── Group matches + standings ───────────────────────────────────────────────
// Round-robin order for 4 teams (indices into the group array).
const RR = [
  [[0, 1], [2, 3]], // matchday 1
  [[0, 2], [3, 1]], // matchday 2
  [[3, 0], [1, 2]], // matchday 3
]
const MD_DATES = [
  ['2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15', '2026-06-16'],
  ['2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22'],
  ['2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-23'],
]

function buildGroups() {
  const groups = {}
  let venueTick = 0
  LETTERS.forEach((L, gi) => {
    const names = GROUP_TEAMS[L]
    const matches = []
    RR.forEach((day, mdIdx) => {
      const date = MD_DATES[mdIdx][gi % MD_DATES[mdIdx].length]
      day.forEach(([hi, ai], j) => {
        const home = TEAMS[names[hi]]
        const away = TEAMS[names[ai]]
        const rng = mulberry32(hash(L + home.id + away.id))
        const hg = poisson(rng, Math.max(0.25, 1.35 + (home.strength - away.strength) * 0.75))
        const ag = poisson(rng, Math.max(0.25, 1.15 + (away.strength - home.strength) * 0.75))
        matches.push({
          id: `g-${L}-${mdIdx}-${j}`,
          group: L,
          home,
          away,
          homeGoals: hg,
          awayGoals: ag,
          status: 'completed',
          kickoff: kickoff(date, TIME_SLOTS[(mdIdx * 2 + j) % TIME_SLOTS.length]),
          venue: VENUES[VKEYS[venueTick++ % VKEYS.length]],
        })
      })
    })
    groups[L] = {
      letter: L,
      accent: GROUP_ACCENT[L],
      teams: names.map((n) => TEAMS[n]),
      matches,
      standings: computeStandings(names.map((n) => TEAMS[n]), matches),
    }
  })
  return groups
}

export function computeStandings(teams, matches) {
  const row = {}
  teams.forEach((t) => {
    row[t.id] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
  })
  matches.forEach((m) => {
    if (m.status !== 'completed') return
    const h = row[m.home.id]
    const a = row[m.away.id]
    h.p++; a.p++
    h.gf += m.homeGoals; h.ga += m.awayGoals
    a.gf += m.awayGoals; a.ga += m.homeGoals
    if (m.homeGoals > m.awayGoals) { h.w++; a.l++; h.pts += 3 }
    else if (m.homeGoals < m.awayGoals) { a.w++; h.l++; a.pts += 3 }
    else { h.d++; a.d++; h.pts++; a.pts++ }
  })
  return Object.values(row)
    .map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) =>
      y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name),
    )
}

export const GROUPS = buildGroups()

// ── Qualification → seeded R32 order ────────────────────────────────────────
function qualifiedOrder() {
  const winners = []
  const runners = []
  const thirdsAll = []
  LETTERS.forEach((L) => {
    const s = GROUPS[L].standings
    winners.push({ ...s[0], code: `1${L}` })
    runners.push({ ...s[1], code: `2${L}` })
    thirdsAll.push({ ...s[2], code: `3${L}` })
  })
  const bestThirds = [...thirdsAll]
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf)
    .slice(0, 8)
  // 32-team seeded order: winners, runners-up, then the 8 best third-placed.
  return [...winners, ...runners, ...bestThirds]
}
export const SEED_ORDER = qualifiedOrder()

// ── Knockout bracket (a binary tree of matches) ─────────────────────────────
const KO_DATES = {
  r32: ['2026-06-28', '2026-06-28', '2026-06-29', '2026-06-29', '2026-06-30', '2026-06-30',
        '2026-07-01', '2026-07-01', '2026-07-02', '2026-07-02', '2026-07-03', '2026-07-03',
        '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01'],
  r16: ['2026-07-04', '2026-07-04', '2026-07-05', '2026-07-05', '2026-07-06', '2026-07-06', '2026-07-07', '2026-07-07'],
  qf: ['2026-07-09', '2026-07-09', '2026-07-10', '2026-07-11'],
  sf: ['2026-07-14', '2026-07-15'],
  third: ['2026-07-18'],
  final: ['2026-07-19'],
}
const KO_TIME = ['12:00', '15:00', '16:00']
const koVenue = (i) => VENUES[VKEYS[(i * 3 + 5) % VKEYS.length]]

function teamSlot(seed) {
  return { type: 'team', code: seed.code, teamId: seed.team.id }
}
function winnerSlot(matchId) {
  return { type: 'winner', matchId }
}
function loserSlot(matchId) {
  return { type: 'loser', matchId }
}

function buildKnockouts() {
  // Round of 32 — seeded 1-vs-32 pairing.
  const r32 = []
  for (let i = 0; i < 16; i++) {
    const a = SEED_ORDER[i]
    const b = SEED_ORDER[31 - i]
    r32.push({
      id: `r32-${i + 1}`,
      label: `Match ${i + 1}`,
      round: 'r32',
      slotA: teamSlot(a),
      slotB: teamSlot(b),
      kickoff: kickoff(KO_DATES.r32[i], KO_TIME[i % KO_TIME.length]),
      venue: koVenue(i),
    })
  }
  const pairUp = (prev, round, dates, prefix) => {
    const out = []
    for (let i = 0; i < prev.length / 2; i++) {
      out.push({
        id: `${prefix}-${i + 1}`,
        label: `${round.toUpperCase()} ${i + 1}`,
        round,
        slotA: winnerSlot(prev[i * 2].id),
        slotB: winnerSlot(prev[i * 2 + 1].id),
        kickoff: kickoff(dates[i], KO_TIME[i % KO_TIME.length]),
        venue: koVenue(i + 20),
      })
    }
    return out
  }
  const r16 = pairUp(r32, 'r16', KO_DATES.r16, 'r16')
  const qf = pairUp(r16, 'qf', KO_DATES.qf, 'qf')
  const sf = pairUp(qf, 'sf', KO_DATES.sf, 'sf')
  const third = [{
    id: 'third-1',
    label: 'Third Place',
    round: 'third',
    slotA: loserSlot(sf[0].id),
    slotB: loserSlot(sf[1].id),
    kickoff: kickoff(KO_DATES.third[0], '12:00'),
    venue: VENUES.miami,
  }]
  const final = [{
    id: 'final-1',
    label: 'Final',
    round: 'final',
    slotA: winnerSlot(sf[0].id),
    slotB: winnerSlot(sf[1].id),
    kickoff: kickoff(KO_DATES.final[0], '12:00'),
    venue: VENUES.newyork,
  }]
  return [
    { key: 'r32', title: 'Round of 32', icon: '🎯', matches: r32 },
    { key: 'r16', title: 'Round of 16', icon: '⚔️', matches: r16 },
    { key: 'qf', title: 'Quarter-Finals', icon: '🥊', matches: qf },
    { key: 'sf', title: 'Semi-Finals', icon: '🔥', matches: sf },
    { key: 'third', title: 'Third Place', icon: '🥉', matches: third },
    { key: 'final', title: 'Final', icon: '🏆', matches: final },
  ]
}
export const KNOCKOUTS = buildKnockouts()

// Flat lookup of every knockout match by id (for slot resolution).
export const KO_BY_ID = {}
KNOCKOUTS.forEach((r) => r.matches.forEach((m) => { KO_BY_ID[m.id] = m }))

// ── Date / time formatting (always Pacific, labeled PST) ────────────────────
const LA = 'America/Los_Angeles'
export function fmtDate(iso, opts = {}) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: opts.weekday || 'short', month: 'short', day: 'numeric', timeZone: LA,
  })
}
export function fmtTime(iso) {
  const t = new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: LA,
  })
  return `${t} PST`
}
export function fmtDayKey(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: LA })
}
