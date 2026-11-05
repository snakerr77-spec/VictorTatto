import { toMin } from '../shared/time'
import type { LocalNow } from './clock'
import { db, save } from './db'
import { describeBooking, studioNow } from './domain'
import { pushNotification } from './notify'

const inLabel = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`

/**
 * Roda a cada 30 s:
 *  - 1x por dia (a partir da hora configurada): resumo "Hoje você tem N clientes".
 *  - Lembrete X minutos antes de cada sessão.
 */
export function tick(now: LocalNow = studioNow()) {
  const s = db.settings
  const todays = db.bookings
    .filter((b) => b.date === now.date && b.status === 'confirmed')
    .sort((a, b) => a.start.localeCompare(b.start))

  if (now.minutes >= s.daySummaryHour * 60 && db.meta.lastSummaryDate !== now.date) {
    db.meta.lastSummaryDate = now.date
    const remaining = todays.filter((b) => toMin(b.end) > now.minutes)
    if (remaining.length) {
      pushNotification({
        kind: 'summary',
        title: remaining.length === 1 ? 'Hoje: 1 cliente' : `Hoje: ${remaining.length} clientes`,
        body: remaining.map(describeBooking).join('\n'),
        href: '/admin',
      })
    }
    save()
  }

  for (const b of todays) {
    const diff = toMin(b.start) - now.minutes
    if (s.reminderMin > 0 && diff > 0 && diff <= s.reminderMin && !db.meta.reminded.includes(b.id)) {
      db.meta.reminded.push(b.id)
      if (db.meta.reminded.length > 300) db.meta.reminded = db.meta.reminded.slice(-200)
      pushNotification({
        kind: 'reminder',
        title: `Em ${inLabel(diff)}: ${b.clientName}`,
        body: describeBooking(b),
        href: '/admin',
      })
      save()
    }
  }
}

export function startScheduler() {
  setTimeout(tick, 3000)
  setInterval(tick, 30_000)
}
