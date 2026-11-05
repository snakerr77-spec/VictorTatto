import { randomUUID } from 'node:crypto'
import { toMin, wallMinutes, weekday } from '../shared/time'
import type { AccessToken, Booking, PublicBooking, PublicToken } from '../shared/types'
import { localNow, type LocalNow } from './clock'
import { db } from './db'
import { availableStarts, type Interval } from './schedule'
import { nowIso, randomCode } from './util'

export const studioNow = (): LocalNow => localNow(db.settings.timezone)

/** Sessões que ocupam a agenda de um dia (confirmadas ou já realizadas). */
export function busyFor(date: string, exceptId?: string): Interval[] {
  return db.bookings
    .filter((b) => b.date === date && (b.status === 'confirmed' || b.status === 'done') && b.id !== exceptId)
    .map((b) => ({ start: toMin(b.start), end: toMin(b.end) }))
}

/** Horários de início livres em `date` para uma sessão de `durationMin`. */
export function startsFor(date: string, durationMin: number): string[] {
  const windows = db.schedule[date]
  if (!windows?.length) return []
  const s = db.settings
  return availableStarts({
    date,
    windows,
    busy: busyFor(date),
    durationMin,
    stepMin: s.slotStepMin,
    bufferMin: s.bufferMin,
    now: studioNow(),
    minLeadMin: s.minLeadHours * 60,
  })
}

export const bookingCode = (): string => `FT-${randomCode(5)}`

export const protocolOf = (id: string): string => `FT-${id.slice(0, 6).toUpperCase()}`

export const publicBooking = (b: Booking): PublicBooking => ({
  code: b.code,
  status: b.status,
  date: b.date,
  start: b.start,
  end: b.end,
  durationMin: b.durationMin,
  clientName: b.clientName,
})

export function publicToken(t: AccessToken): PublicToken {
  const req = t.requestId ? db.requests.find((r) => r.id === t.requestId) : undefined
  return {
    clientName: t.clientName,
    clientPhone: t.clientPhone,
    durationMin: t.durationMin,
    note: t.note,
    dateFrom: t.dateFrom,
    dateTo: t.dateTo,
    expiresAt: t.expiresAt,
    categoryId: req?.categoryId ?? '',
    bodyArea: req?.bodyArea ?? '',
  }
}

/** O cliente ainda pode remarcar/cancelar sozinho? (respeita o prazo configurado) */
export function clientCanCancel(b: Booking): boolean {
  if (b.status !== 'confirmed') return false
  const now = studioNow()
  const left = wallMinutes(b.date, toMin(b.start)) - wallMinutes(now.date, now.minutes)
  return left >= db.settings.cancelWindowHours * 60
}

/** Devolve o token ao cliente (para ele escolher outro horário). */
export function reopenToken(t: AccessToken) {
  t.status = 'active'
  t.usedAt = null
  t.bookingId = null
  const minExpiry = Date.now() + db.settings.tokenValidityHours * 3_600_000
  if (Date.parse(t.expiresAt) < minExpiry) t.expiresAt = new Date(minExpiry).toISOString()
  const req = t.requestId ? db.requests.find((r) => r.id === t.requestId) : undefined
  if (req && req.status === 'booked') req.status = 'approved'
}

export function createTokenRecord(input: {
  requestId: string | null
  clientName: string
  clientPhone: string
  durationMin: number
  validityHours: number
  note: string
  dateFrom: string | null
  dateTo: string | null
  code: string
}): AccessToken {
  return {
    id: randomUUID(),
    code: input.code,
    status: 'active',
    requestId: input.requestId,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    durationMin: input.durationMin,
    note: input.note,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + input.validityHours * 3_600_000).toISOString(),
    usedAt: null,
    bookingId: null,
  }
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "sex, 12/10" */
export const brDate = (date: string): string => `${WEEKDAYS[weekday(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`

export const categoryName = (id: string): string => db.categories.find((c) => c.id === id)?.name ?? ''

/** "10:00 · Ana Souza · Realismo · Antebraço" */
export const describeBooking = (b: Booking): string =>
  [b.start, b.clientName, categoryName(b.categoryId), b.bodyArea].filter(Boolean).join(' · ')
