import { useEffect, useMemo, useState } from 'react'
import {
  Trophy, Calendar, CalendarDays, MapPin, ChevronDown, Clock, RotateCcw,
  Eye, EyeOff, Sparkles, Crown, Target, Radio,
} from 'lucide-react'
import {
  GROUPS, LETTERS, KNOCKOUTS, KO_BY_ID, TEAMS, teamById,
  fmtDate, fmtTime, fmtDayKey,
} from './data.js'

const PRED_KEY = 'wc2026_predictions'
const totalKoMatches = KNOCKOUTS.reduce((n, r) => n + r.matches.length, 0)

// ── Match live status from the ticking clock ────────────────────────────────
function matchStatus(iso, now) {
  const start = new Date(iso).getTime()
  const end = start + 2 * 60 * 60 * 1000 // ~2h window
  if (now < start) return 'upcoming'
  if (now < end) return 'live'
  return 'past'
}

// ── Prediction resolution across the bracket ────────────────────────────────
function resolveSlot(slot, preds) {
  if (!slot) return null
  if (slot.type === 'team') return teamById(slot.teamId)
  if (slot.type === 'winner') {
    const pick = preds[slot.matchId]
    return pick ? teamById(pick) : null
  }
  if (slot.type === 'loser') {
    const pick = preds[slot.matchId]
    if (!pick) return null
    const { a, b } = resolveMatch(KO_BY_ID[slot.matchId], preds)
    if (!a || !b) return null
    return a.id === pick ? b : a
  }
  return null
}
function resolveMatch(match, preds) {
  return { a: resolveSlot(match.slotA, preds), b: resolveSlot(match.slotB, preds) }
}
// Drop any pick whose team is no longer a participant (after an upstream change).
function prune(preds) {
  let cur = { ...preds }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    for (const round of KNOCKOUTS) {
      for (const m of round.matches) {
        const pick = cur[m.id]
        if (!pick) continue
        const { a, b } = resolveMatch(m, cur)
        if ((!a || a.id !== pick) && (!b || b.id !== pick)) {
          delete cur[m.id]
          changed = true
        }
      }
    }
    if (!changed) break
  }
  return cur
}

// ── Small shared bits ───────────────────────────────────────────────────────
function Flag({ team, className = 'h-4 w-6' }) {
  if (!team) return <span className={`${className} inline-block rounded-[2px] bg-slate-700`} />
  return (
    <img
      src={`https://flagcdn.com/${team.iso}.svg`}
      alt={team.name}
      loading="lazy"
      className={`${className} inline-block shrink-0 rounded-[2px] object-cover ring-1 ring-black/30`}
    />
  )
}

function VenueLine({ venue, iso }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" /> {fmtDate(iso)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> {fmtTime(iso)}
      </span>
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" /> {venue.stadium}, {venue.city}
      </span>
    </div>
  )
}

function StatusPill({ status }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/40">
        <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-rose-400" /> Live
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="rounded-full bg-slate-600/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300 ring-1 ring-slate-500/40">
        Final
      </span>
    )
  }
  return (
    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300 ring-1 ring-sky-500/30">
      Upcoming
    </span>
  )
}

// ── Group stage ─────────────────────────────────────────────────────────────
function GroupMatchRow({ m }) {
  const homeWin = m.homeGoals > m.awayGoals
  const awayWin = m.awayGoals > m.homeGoals
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <VenueLine venue={m.venue} iso={m.kickoff} />
        <StatusPill status="completed" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex flex-1 items-center gap-2 ${homeWin ? 'font-bold text-white' : 'text-slate-300'}`}>
          <Flag team={m.home} />
          <span className="truncate">{m.home.name}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/70 px-3 py-1 font-mono text-base font-bold tabular-nums">
          <span className={homeWin ? 'text-emerald-400' : 'text-slate-200'}>{m.homeGoals}</span>
          <span className="text-slate-500">:</span>
          <span className={awayWin ? 'text-emerald-400' : 'text-slate-200'}>{m.awayGoals}</span>
        </div>
        <div className={`flex flex-1 items-center justify-end gap-2 ${awayWin ? 'font-bold text-white' : 'text-slate-300'}`}>
          <span className="truncate text-right">{m.away.name}</span>
          <Flag team={m.away} />
        </div>
      </div>
    </div>
  )
}

function StandingsTable({ standings, accent }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/70 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Team</th>
            <th className="px-1.5 py-2 text-center font-semibold">P</th>
            <th className="px-1.5 py-2 text-center font-semibold">W</th>
            <th className="px-1.5 py-2 text-center font-semibold">D</th>
            <th className="px-1.5 py-2 text-center font-semibold">L</th>
            <th className="px-1.5 py-2 text-center font-semibold">GD</th>
            <th className="px-2 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r, i) => {
            const qualifies = i < 2
            const playoff = i === 2
            return (
              <tr
                key={r.team.id}
                className={`border-t border-slate-700/40 ${
                  qualifies ? 'bg-emerald-500/[0.07]' : playoff ? 'bg-amber-500/[0.06]' : ''
                }`}
              >
                <td className="px-2 py-2">
                  <span
                    className="inline-flex h-5 w-1.5 rounded-full align-middle"
                    style={{
                      background: qualifies ? '#34d399' : playoff ? '#fbbf24' : 'transparent',
                    }}
                  />
                  <span className="ml-1.5 text-slate-400">{i + 1}</span>
                </td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <Flag team={r.team} className="h-3.5 w-5" />
                    <span className="font-medium text-slate-100">{r.team.name}</span>
                  </span>
                </td>
                <td className="px-1.5 py-2 text-center text-slate-300">{r.p}</td>
                <td className="px-1.5 py-2 text-center text-slate-300">{r.w}</td>
                <td className="px-1.5 py-2 text-center text-slate-300">{r.d}</td>
                <td className="px-1.5 py-2 text-center text-slate-300">{r.l}</td>
                <td className="px-1.5 py-2 text-center tabular-nums text-slate-300">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className="font-bold tabular-nums" style={{ color: accent[1] }}>{r.pts}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GroupCard({ group, open, onToggle, showMatches }) {
  const [a1, a2] = group.accent
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50 shadow-lg shadow-black/20 backdrop-blur">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-800/40"
        style={{ background: `linear-gradient(90deg, ${a1}1f, transparent 70%)` }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${a1}, ${a2})` }}
        >
          {group.letter}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Group {group.letter}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {group.teams.map((t) => (
              <Flag key={t.id} team={t} className="h-3 w-[18px]" />
            ))}
          </div>
        </div>
        <span
          className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30 sm:inline"
        >
          {group.standings[0].team.name} leads
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`collapsible ${open ? 'open' : ''}`}>
        <div className="collapsible-inner">
          <div className="space-y-4 px-4 pb-4 pt-1">
            <StandingsTable standings={group.standings} accent={group.accent} />
            {showMatches && (
              <div className="animate-fade-in space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Group matches
                </div>
                {group.matches.map((m) => (
                  <GroupMatchRow key={m.id} m={m} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupsView({ showCompleted, setShowCompleted }) {
  const [openSet, setOpenSet] = useState(() => new Set(['A']))
  const allOpen = openSet.size === LETTERS.length
  const toggle = (L) =>
    setOpenSet((s) => {
      const n = new Set(s)
      n.has(L) ? n.delete(L) : n.add(L)
      return n
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="inline-flex h-3 w-1.5 rounded-full bg-emerald-400" /> Advance
          <span className="ml-2 inline-flex h-3 w-1.5 rounded-full bg-amber-400" /> Best-3rd race
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenSet(allOpen ? new Set() : new Set(LETTERS))}
            className="rounded-lg border border-slate-600/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              showCompleted
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'border border-slate-600/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Completed matches
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {LETTERS.map((L) => (
          <GroupCard
            key={L}
            group={GROUPS[L]}
            open={openSet.has(L)}
            onToggle={() => toggle(L)}
            showMatches={showCompleted}
          />
        ))}
      </div>
    </div>
  )
}

// ── Knockouts ───────────────────────────────────────────────────────────────
function placeholder(slot) {
  if (!slot) return 'TBD'
  if (slot.type === 'team') return slot.code
  const m = KO_BY_ID[slot.matchId]
  return `${slot.type === 'winner' ? 'Winner' : 'Loser'} · ${m?.label || '?'}`
}

function TeamSlot({ team, slot, picked, isOther, onPick, now, iso }) {
  const status = matchStatus(iso, now)
  const clickable = !!team
  const base =
    'group/slot flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition w-full'
  let cls
  if (picked) {
    cls = 'bg-gradient-to-r from-violet-500/30 to-fuchsia-500/20 ring-2 ring-violet-400/70 text-white shadow-lg shadow-violet-900/30'
  } else if (isOther) {
    cls = 'bg-slate-800/30 text-slate-400 ring-1 ring-slate-700/50'
  } else if (clickable) {
    cls = 'bg-slate-800/50 text-slate-200 ring-1 ring-slate-700/60 hover:ring-violet-400/60 hover:bg-slate-800'
  } else {
    cls = 'bg-slate-800/20 text-slate-500 ring-1 ring-dashed ring-slate-700/50 cursor-not-allowed'
  }
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onPick}
      className={`${base} ${cls} ${picked ? 'animate-pop' : ''}`}
    >
      {team ? <Flag team={team} className="h-5 w-7" /> : <span className="text-xl leading-none">⚽</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {team ? team.name : placeholder(slot)}
        </span>
        {team && slot.type === 'team' && (
          <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Seed {slot.code}
          </span>
        )}
      </span>
      {picked && (
        <span className="flex items-center gap-1 rounded-full bg-violet-400/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-950">
          <Sparkles className="h-3 w-3" /> Pick
        </span>
      )}
      {status === 'live' && !picked && <Radio className="h-4 w-4 animate-live-pulse text-rose-400" />}
    </button>
  )
}

function KOMatchCard({ match, preds, onPick, now }) {
  const { a, b } = resolveMatch(match, preds)
  const pick = preds[match.id]
  const status = matchStatus(match.kickoff, now)
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-3 shadow-md shadow-black/20 backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{match.label}</span>
        <StatusPill status={status === 'live' ? 'live' : 'upcoming'} />
      </div>
      <div className="space-y-1.5">
        <TeamSlot
          team={a} slot={match.slotA} now={now} iso={match.kickoff}
          picked={pick && a && pick === a.id}
          isOther={pick && a && pick !== a.id}
          onPick={() => a && onPick(match.id, a.id)}
        />
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">vs</span>
        </div>
        <TeamSlot
          team={b} slot={match.slotB} now={now} iso={match.kickoff}
          picked={pick && b && pick === b.id}
          isOther={pick && b && pick !== b.id}
          onPick={() => b && onPick(match.id, b.id)}
        />
      </div>
      <div className="mt-2.5 border-t border-slate-700/40 pt-2">
        <VenueLine venue={match.venue} iso={match.kickoff} />
      </div>
    </div>
  )
}

function KnockoutRound({ round, preds, onPick, now }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{round.icon}</span>
        <h3 className="text-lg font-extrabold text-white">{round.title}</h3>
        <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {round.matches.map((m) => (
          <KOMatchCard key={m.id} match={m} preds={preds} onPick={onPick} now={now} />
        ))}
      </div>
    </section>
  )
}

function PredictionSummary({ preds, now }) {
  const made = Object.keys(preds).length
  const champ = preds['final-1'] ? teamById(preds['final-1']) : null
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/15 via-slate-900/40 to-fuchsia-600/10 p-4 shadow-lg shadow-violet-900/20">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-violet-300" />
        <h3 className="text-base font-extrabold text-white">Your Predictions</h3>
        <span className="ml-auto rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-bold text-violet-200 ring-1 ring-violet-400/40">
          {made} / {totalKoMatches}
        </span>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all duration-500"
          style={{ width: `${(made / totalKoMatches) * 100}%` }}
        />
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
        <Crown className="h-6 w-6 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">Predicted Champion</div>
          {champ ? (
            <div className="flex items-center gap-2 text-lg font-black text-white">
              <Flag team={champ} className="h-5 w-7" />
              <span className="truncate">{champ.name}</span>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Pick your way through to the Final 🏆</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {KNOCKOUTS.map((round) => {
          const picks = round.matches.filter((m) => preds[m.id])
          if (!picks.length) return null
          return (
            <div key={round.key}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {round.icon} {round.title}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {picks.map((m) => {
                  const t = teamById(preds[m.id])
                  return (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-100 ring-1 ring-violet-500/30"
                    >
                      <Flag team={t} className="h-3 w-[18px]" /> {t.name}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
        {made === 0 && (
          <p className="text-sm text-slate-400">
            Tap a team in any knockout match to predict the winner. Your picks flow forward through
            the bracket and are saved on this device.
          </p>
        )}
      </div>
    </div>
  )
}

function KnockoutView({ preds, onPick, onReset, showUpcoming, setShowUpcoming, now }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="order-2 space-y-7 lg:order-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-3">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">Round of 32 → Final.</span>{' '}
            Tap a team to predict the winner — picks advance automatically.
          </p>
          <button
            onClick={() => setShowUpcoming((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              showUpcoming
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                : 'border border-slate-600/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {showUpcoming ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Upcoming matches
          </button>
        </div>

        {showUpcoming ? (
          <div className="space-y-7">
            {KNOCKOUTS.map((round) => (
              <KnockoutRound key={round.key} round={round} preds={preds} onPick={onPick} now={now} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 p-8 text-center text-sm text-slate-400">
            Upcoming matches hidden. Toggle them back on to make predictions.
          </div>
        )}
      </div>

      <div className="order-1 lg:order-2">
        <div className="space-y-3 lg:sticky lg:top-4">
          <PredictionSummary preds={preds} now={now} />
          <button
            onClick={onReset}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
          >
            <RotateCcw className="h-4 w-4" /> Reset all predictions
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Schedule (all matches, grouped by day) ──────────────────────────────────
function buildSchedule() {
  const rows = []
  for (const L of LETTERS) {
    for (const m of GROUPS[L].matches) {
      rows.push({
        id: m.id,
        kickoff: m.kickoff,
        venue: m.venue,
        roundLabel: `Group ${L}`,
        accent: GROUPS[L].accent,
        group: m, // completed group match (has score)
      })
    }
  }
  for (const round of KNOCKOUTS) {
    for (const m of round.matches) {
      rows.push({
        id: m.id,
        kickoff: m.kickoff,
        venue: m.venue,
        roundLabel: round.title,
        roundIcon: round.icon,
        accent: ['#a78bfa', '#e879f9'],
        ko: m,
      })
    }
  }
  rows.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
  return rows
}
const SCHEDULE = buildSchedule()

function dayLabel(dayKey, todayKey) {
  const diff = Math.round(
    (new Date(`${dayKey}T12:00:00-07:00`) - new Date(`${todayKey}T12:00:00-07:00`)) / 86400000,
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return null
}

function ScheduleTeam({ team, slot, align, win }) {
  const name = team ? team.name : placeholder(slot)
  return (
    <div
      className={`flex flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${
        win ? 'font-bold text-white' : team ? 'text-slate-200' : 'text-slate-500'
      }`}
    >
      <Flag team={team} />
      <span className="truncate text-sm">{name}</span>
    </div>
  )
}

function ScheduleRow({ row, preds, now }) {
  const [a1] = row.accent
  let home, away, homeGoals, awayGoals, completed, status, slotA, slotB
  if (row.group) {
    home = row.group.home; away = row.group.away
    homeGoals = row.group.homeGoals; awayGoals = row.group.awayGoals
    completed = true; status = 'completed'
  } else {
    const r = resolveMatch(row.ko, preds)
    home = r.a; away = r.b; slotA = row.ko.slotA; slotB = row.ko.slotB
    status = matchStatus(row.kickoff, now)
  }
  const homeWin = completed && homeGoals > awayGoals
  const awayWin = completed && awayGoals > homeGoals
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-800/40 p-3 sm:flex-row sm:items-center">
      <div className="flex w-full items-center justify-between gap-2 sm:w-44 sm:flex-col sm:items-start sm:justify-center">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-bold tabular-nums text-white">
            {new Date(row.kickoff).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
          </span>
          <span className="text-[10px] font-bold text-slate-500">PST</span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: `${a1}26`, color: a1 }}
        >
          {row.roundIcon ? `${row.roundIcon} ` : ''}{row.roundLabel}
        </span>
      </div>

      <div className="flex flex-1 items-center gap-2">
        <ScheduleTeam team={home} slot={slotA} align="right" win={homeWin} />
        <div className="flex shrink-0 items-center justify-center">
          {completed ? (
            <span className="flex items-center gap-1 rounded-lg bg-slate-900/70 px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
              <span className={homeWin ? 'text-emerald-400' : 'text-slate-200'}>{homeGoals}</span>
              <span className="text-slate-500">:</span>
              <span className={awayWin ? 'text-emerald-400' : 'text-slate-200'}>{awayGoals}</span>
            </span>
          ) : (
            <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">vs</span>
          )}
        </div>
        <ScheduleTeam team={away} slot={slotB} align="left" win={awayWin} />
      </div>

      <div className="flex items-center justify-between gap-2 sm:w-52 sm:justify-end">
        <span className="inline-flex items-center gap-1 truncate text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {row.venue.city}
        </span>
        <StatusPill status={status} />
      </div>
    </div>
  )
}

function UpNext({ row, preds, now }) {
  if (!row) return null
  const isKo = !!row.ko
  let home, away, slotA, slotB
  if (isKo) {
    const r = resolveMatch(row.ko, preds); home = r.a; away = r.b; slotA = row.ko.slotA; slotB = row.ko.slotB
  } else { home = row.group.home; away = row.group.away }
  const ms = new Date(row.kickoff) - now
  const hrs = Math.max(0, Math.floor(ms / 3600000))
  const days = Math.floor(hrs / 24)
  const countdown = days > 0 ? `in ${days}d ${hrs % 24}h` : hrs > 0 ? `in ${hrs}h` : 'starting soon'
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-600/15 via-slate-900/40 to-violet-600/10 p-4 shadow-lg shadow-sky-900/20">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-300">
          <Clock className="h-4 w-4" /> Up next · {countdown}
        </span>
        <span className="text-xs font-semibold text-slate-300">{row.roundLabel}</span>
      </div>
      <div className="flex items-center justify-center gap-3 py-1">
        <div className="flex flex-1 items-center justify-end gap-2 text-right text-base font-bold text-white">
          <span className="truncate">{home ? home.name : placeholder(slotA)}</span>
          <Flag team={home} className="h-5 w-7" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">vs</span>
        <div className="flex flex-1 items-center gap-2 text-base font-bold text-white">
          <Flag team={away} className="h-5 w-7" />
          <span className="truncate">{away ? away.name : placeholder(slotB)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(row.kickoff, { weekday: 'long' })}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtTime(row.kickoff)}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {row.venue.stadium}, {row.venue.city}</span>
      </div>
    </div>
  )
}

function ScheduleView({ preds, now }) {
  const [showPast, setShowPast] = useState(false)
  const todayKey = fmtDayKey(now)

  const days = useMemo(() => {
    const map = new Map()
    for (const row of SCHEDULE) {
      const key = fmtDayKey(row.kickoff)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    }
    return [...map.entries()].map(([key, rows]) => ({ key, rows }))
  }, [])

  // Next *unplayed* match: group games are all completed (have scores), so the
  // next real fixture is the soonest knockout that hasn't kicked off yet.
  const upNext = useMemo(
    () => SCHEDULE.find((r) => r.ko && new Date(r.kickoff).getTime() > now),
    [now],
  )

  const visibleDays = showPast ? days : days.filter((d) => d.key >= todayKey)

  return (
    <div className="space-y-5">
      <UpNext row={upNext} preds={preds} now={now} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-3">
        <p className="text-sm text-slate-300">
          Every match in kickoff order — <span className="font-semibold text-white">all times PST</span>.
        </p>
        <button
          onClick={() => setShowPast((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            showPast
              ? 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40'
              : 'border border-slate-600/60 text-slate-400 hover:bg-slate-800'
          }`}
        >
          {showPast ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Past days
        </button>
      </div>

      {visibleDays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 p-8 text-center text-sm text-slate-400">
          No matches to show.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleDays.map((day) => {
            const rel = dayLabel(day.key, todayKey)
            const isToday = day.key === todayKey
            return (
              <section key={day.key}>
                <div className="mb-2.5 flex items-center gap-2">
                  {rel && (
                    <span
                      className={`rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide ${
                        isToday
                          ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-700/50 text-slate-300'
                      }`}
                    >
                      {rel}
                    </span>
                  )}
                  <h3 className="text-base font-bold text-white">
                    {fmtDate(day.rows[0].kickoff, { weekday: 'long' })}
                  </h3>
                  <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                    {day.rows.length} {day.rows.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                <div className="space-y-2">
                  {day.rows.map((row) => (
                    <ScheduleRow key={row.id} row={row} preds={preds} now={now} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Live clock in the header ────────────────────────────────────────────────
function LiveClock({ now }) {
  const time = new Date(now).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles',
  })
  const date = new Date(now).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles',
  })
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1.5 backdrop-blur">
      <span className="h-2 w-2 animate-live-pulse rounded-full bg-emerald-400" />
      <span className="text-xs font-semibold text-slate-300">{date}</span>
      <span className="font-mono text-xs font-bold tabular-nums text-white">{time}</span>
      <span className="text-[10px] font-bold text-slate-500">PST</span>
    </div>
  )
}

// ── Root ────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('groups')
  const [showCompleted, setShowCompleted] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [preds, setPreds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PRED_KEY)) || {}
    } catch {
      return {}
    }
  })

  // Live tick — drives the clock and any "live" match windows.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(PRED_KEY, JSON.stringify(preds))
  }, [preds])

  const onPick = (matchId, teamId) =>
    setPreds((p) => prune({ ...p, [matchId]: teamId }))

  const onReset = () => {
    if (window.confirm('Clear all knockout predictions?')) setPreds({})
  }

  const completedCount = useMemo(
    () => LETTERS.reduce((n, L) => n + GROUPS[L].matches.length, 0),
    [],
  )

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      {/* Header */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-2xl shadow-lg shadow-orange-900/40">
              🏆
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight text-white sm:text-2xl">
                World Cup <span className="bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">2026</span>
              </h1>
              <p className="text-xs text-slate-400">Groups · Standings · Knockouts · Predictions</p>
            </div>
          </div>
          <LiveClock now={now} />
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-1.5 backdrop-blur sm:inline-grid sm:grid-flow-col">
        <TabButton active={tab === 'groups'} onClick={() => setTab('groups')} icon={<Trophy className="h-4 w-4" />}>
          Groups
        </TabButton>
        <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={<CalendarDays className="h-4 w-4" />}>
          Schedule
        </TabButton>
        <TabButton active={tab === 'knockouts'} onClick={() => setTab('knockouts')} icon={<Target className="h-4 w-4" />}>
          Knockouts
        </TabButton>
      </div>

      {/* Content */}
      <main className="animate-fade-in">
        {tab === 'groups' && (
          <>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <Stat label="Groups" value="12" />
              <Stat label="Teams" value="48" />
              <Stat label="Group matches" value={String(completedCount)} />
            </div>
            <GroupsView showCompleted={showCompleted} setShowCompleted={setShowCompleted} />
          </>
        )}
        {tab === 'schedule' && <ScheduleView preds={preds} now={now} />}
        {tab === 'knockouts' && (
          <KnockoutView
            preds={preds}
            onPick={onPick}
            onReset={onReset}
            showUpcoming={showUpcoming}
            setShowUpcoming={setShowUpcoming}
            now={now}
          />
        )}
      </main>

      <footer className="mt-12 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
        All times shown in PST · Predictions saved to this device · Group results are illustrative seed data
      </footer>
    </div>
  )
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
        active
          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/40'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-1.5">
      <span className="font-bold text-white">{value}</span>
      <span className="text-slate-400">{label}</span>
    </span>
  )
}
