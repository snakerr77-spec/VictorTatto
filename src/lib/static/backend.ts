// "Servidor" do modo GitHub Pages, rodando no navegador. Os dados ficam em state.json (branch `data` do repositório).
// Dados sensíveis (códigos dos tokens, telefones) NÃO vão para o repositório: ficam só no aparelho do Victor.
import { addDays, addMonths, monthDates, monthOf, toMin, wallMinutes } from '../../../shared/time'
import type {
  AccessToken,
  AvailabilityResponse,
  Booking,
  BookingStatus,
  Category,
  Notice,
  Overview,
  PublicBooking,
  ScheduleMonth,
  ScheduleUpdateResult,
  Settings,
  SiteData,
  TimeWindow,
  ValidateResponse,
  Work,
} from '../../../shared/types'
import { localNow } from '../../../server/clock'
import { availableStarts, normalizeWindows, windowsCover } from '../../../server/schedule'
import { ApiError } from '../errors'
import { compressImage } from '../image'
import { BASE, withBase } from '../mode'

/* ---------- tipos do estado público ---------- */

interface PubToken {
  id: string
  codeHash: string
  status: 'active' | 'used' | 'revoked'
  durationMin: number
  dateFrom: string | null
  dateTo: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
  bookingId: string | null
}

interface PubBooking {
  id: string
  code: string
  status: BookingStatus
  date: string
  start: string
  end: string
  durationMin: number
  firstName: string
  tokenId: string | null
  source: 'token' | 'admin'
  createdAt: string
}

export interface State {
  v: 1
  settings: Settings
  categories: Category[]
  works: Work[]
  notices: Notice[]
  schedule: Record<string, TimeWindow[]>
  bookings: PubBooking[]
  tokens: PubToken[]
}

/* ---------- dados privados (só neste aparelho) ---------- */

interface Private {
  tokens: Record<string, { code: string; name: string; phone: string; note: string }>
  bookings: Record<string, { name: string; phone: string; email: string; notes: string }>
}
const PRIVATE_KEY = 'vt_private'
const readPrivate = (): Private => {
  try {
    const p = JSON.parse(localStorage.getItem(PRIVATE_KEY) ?? '{}') as Partial<Private>
    return { tokens: p.tokens ?? {}, bookings: p.bookings ?? {} }
  } catch {
    return { tokens: {}, bookings: {} }
  }
}
const writePrivate = (p: Private) => {
  try {
    localStorage.setItem(PRIVATE_KEY, JSON.stringify(p))
  } catch {
    // sem localStorage: nomes e códigos não ficam guardados neste aparelho
  }
}

/* ---------- utilidades ---------- */

const uid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const randomCode = (len: number) => Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => ALPHABET[b % ALPHABET.length]).join('')
const newCode = () => `VICT-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`

export const normalizeCode = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.startsWith('VICT') && raw.length === 16) raw = raw.slice(4)
  if (!/^[A-Z2-9]{12}$/.test(raw)) return null
  return `VICT-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
}

const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, '0')).join('')

const err = (status: number, code: string, message: string) => new ApiError(status, code, message)
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '')
const bool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d)
const int = (v: unknown, label: string, min: number, max: number) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw err(400, 'INVALID', `${label}: informe um número entre ${min} e ${max}.`)
  return n
}

/** Telefone BR: se vier só DDD+número, acrescenta o 55. */
const brPhone = (v: unknown) => {
  const d = digits(v)
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}

/* ---------- carregar / gravar o estado (modo demonstração: só neste navegador) ---------- */

/** Senha provisória do painel de demonstração. */
const DEMO_PASSWORD = 'Victor2026'
const STATE_KEY = 'vt_demo_state'
const SESSION_KEY = 'vt_demo_admin'

let cache: State | null = null

async function seedState(): Promise<State> {
  const res = await fetch(`${BASE}seed-state.json`)
  if (!res.ok) throw err(500, 'SEED', 'Não consegui carregar o conteúdo inicial do site.')
  return (await res.json()) as State
}

/** Estado do site: o que este navegador já alterou, ou o conteúdo inicial embutido. */
async function getState(): Promise<State> {
  if (cache) return cache
  let saved: State | null = null
  try {
    const text = localStorage.getItem(STATE_KEY)
    saved = text ? (JSON.parse(text) as State) : null
  } catch {
    saved = null
  }
  cache = saved ?? (await seedState())
  return cache
}

const isAdmin = () => {
  try {
    return localStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}
const setSession = (on: boolean) => {
  try {
    if (on) localStorage.setItem(SESSION_KEY, '1')
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // sem localStorage: a sessão dura só até recarregar
  }
}

const requireKey = () => {
  if (!isAdmin()) throw err(401, 'UNAUTHORIZED', 'Faça login para continuar.')
}

/** Rotas do painel: exigem login. */
async function adminState(): Promise<{ state: State }> {
  requireKey()
  return { state: await getState() }
}

/** Aplica uma mudança e guarda no navegador. */
async function mutate<T>(_message: string, fn: (s: State) => T): Promise<T> {
  const state = await getState()
  const out = fn(state)
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    cache = null
    throw err(507, 'STORAGE', 'Sem espaço no navegador para salvar. Apague fotos grandes ou limpe os dados do site.')
  }
  return out
}

/* ---------- regras (as mesmas do servidor) ---------- */

const studioNow = (s: State) => localNow(s.settings.timezone)
const tokenStatus = (t: PubToken) => (t.status === 'active' && Date.parse(t.expiresAt) < Date.now() ? 'expired' : t.status)
const inRange = (t: PubToken, day: string) => (!t.dateFrom || day >= t.dateFrom) && (!t.dateTo || day <= t.dateTo)
const live = (b: PubBooking) => b.status === 'confirmed' || b.status === 'done'

function startsFor(s: State, day: string, durationMin: number): string[] {
  const windows = s.schedule[day]
  if (!windows?.length) return []
  return availableStarts({
    date: day,
    windows,
    busy: s.bookings.filter((b) => b.date === day && live(b)).map((b) => ({ start: toMin(b.start), end: toMin(b.end) })),
    durationMin,
    stepMin: s.settings.slotStepMin,
    bufferMin: s.settings.bufferMin,
    now: studioNow(s),
    minLeadMin: s.settings.minLeadHours * 60,
  })
}

async function findToken(s: State, raw: unknown): Promise<PubToken> {
  const code = normalizeCode(raw)
  const hash = code ? await sha256(code) : ''
  const token = hash ? s.tokens.find((t) => t.codeHash === hash) : undefined
  if (!token) throw err(404, 'TOKEN_INVALID', 'Token não encontrado. Confira o código e tente de novo.')
  const st = tokenStatus(token)
  if (st === 'revoked') throw err(403, 'TOKEN_REVOKED', 'Este token foi cancelado. Fale com o estúdio para receber um novo.')
  if (st === 'expired') throw err(410, 'TOKEN_EXPIRED', 'Este token expirou. Peça um novo ao estúdio.')
  return token
}

const toPublicBooking = (b: PubBooking, name: string): PublicBooking => ({
  code: b.code,
  status: b.status,
  date: b.date,
  start: b.start,
  end: b.end,
  durationMin: b.durationMin,
  clientName: name,
})

const addMin = (hhmm: string, min: number) => {
  const t = toMin(hhmm) + min
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function fullBooking(b: PubBooking, p: Private): Booking {
  const priv = p.bookings[b.id]
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    date: b.date,
    start: b.start,
    end: b.end,
    durationMin: b.durationMin,
    clientName: priv?.name || b.firstName,
    clientPhone: priv?.phone ?? '',
    clientEmail: priv?.email ?? '',
    categoryId: '',
    bodyArea: '',
    idea: '',
    notes: priv?.notes ?? '',
    requestId: null,
    tokenId: b.tokenId,
    source: b.source,
    createdAt: b.createdAt,
  }
}

function fullToken(t: PubToken, p: Private): AccessToken {
  const priv = p.tokens[t.id]
  return {
    id: t.id,
    code: priv?.code ?? '',
    status: tokenStatus(t),
    requestId: null,
    clientName: priv?.name ?? '',
    clientPhone: priv?.phone ?? '',
    durationMin: t.durationMin,
    note: priv?.note ?? '',
    dateFrom: t.dateFrom,
    dateTo: t.dateTo,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    usedAt: t.usedAt,
    bookingId: t.bookingId,
  }
}

/** O cliente ainda pode remarcar/cancelar sozinho? (respeita o prazo configurado) */
function canCancel(s: State, b: PubBooking): boolean {
  if (b.status !== 'confirmed') return false
  const now = studioNow(s)
  const left = wallMinutes(b.date, toMin(b.start)) - wallMinutes(now.date, now.minutes)
  return left >= s.settings.cancelWindowHours * 60
}

const byTime = (a: PubBooking, b: PubBooking) => (a.date + a.start).localeCompare(b.date + b.start)

function reopen(s: State, t: PubToken) {
  t.status = 'active'
  t.usedAt = null
  t.bookingId = null
  const min = Date.now() + s.settings.tokenValidityHours * 3_600_000
  if (Date.parse(t.expiresAt) < min) t.expiresAt = new Date(min).toISOString()
}

/** Corpo do conteúdo público (o que o site mostra). */
function siteData(s: State): SiteData {
  const st = s.settings
  return {
    settings: {
      studioName: st.studioName,
      since: st.since,
      tagline: st.tagline,
      about: st.about,
      heroImage: st.heroImage,
      ctaImage: st.ctaImage,
      whatsapp: st.whatsapp,
      instagram: st.instagram,
      tiktok: st.tiktok,
      address: st.address,
      city: st.city,
      hoursText: st.hoursText,
      cancelWindowHours: st.cancelWindowHours,
    },
    categories: s.categories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    works: s.works.filter((w) => w.visible).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notices: s.notices.filter((n) => n.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

/** Imagens do conteúdo inicial usam caminhos como /works/1.jpg; ajusta para a subpasta do site. */
export function resolveSite(d: SiteData): SiteData {
  return {
    ...d,
    settings: { ...d.settings, heroImage: withBase(d.settings.heroImage), ctaImage: withBase(d.settings.ctaImage) },
    categories: d.categories.map((c) => ({ ...c, coverUrl: withBase(c.coverUrl) })),
    works: d.works.map((w) => ({ ...w, imageUrl: withBase(w.imageUrl) })),
  }
}

/* ---------- roteador ---------- */

type Body = Record<string, unknown>

export async function staticRequest(method: string, rawPath: string, rawBody?: unknown): Promise<unknown> {
  const [path, query = ''] = rawPath.split('?')
  const q = new URLSearchParams(query)
  const b = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Body
  const seg = path.split('/').filter(Boolean)

  /* ----- público ----- */
  if (method === 'GET' && path === '/site') return resolveSite(siteData(await getState()))

  if (method === 'POST' && path === '/booking/validate') {
    const s = await getState()
    const token = await findToken(s, b.code)
    if (token.status === 'used') {
      const booking = s.bookings.find((x) => x.id === token.bookingId)
      if (!booking || booking.status === 'canceled') throw err(409, 'TOKEN_USED', 'Este token já foi usado. Fale com o estúdio.')
      const out: ValidateResponse = { state: 'used', booking: toPublicBooking(booking, booking.firstName), canCancel: canCancel(s, booking) }
      return out
    }
    const out: ValidateResponse = {
      state: 'active',
      token: {
        clientName: '',
        clientPhone: '',
        durationMin: token.durationMin,
        note: '',
        dateFrom: token.dateFrom,
        dateTo: token.dateTo,
        expiresAt: token.expiresAt,
        categoryId: '',
        bodyArea: '',
      },
    }
    return out
  }

  if (method === 'POST' && path === '/booking/availability') {
    const s = await getState()
    const token = await findToken(s, b.code)
    if (token.status !== 'active') throw err(409, 'TOKEN_USED', 'Este token já foi usado em um agendamento.')
    const m = typeof b.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) ? b.month : ''
    if (!m) throw err(400, 'INVALID', 'Mês inválido.')
    const today = studioNow(s).date
    const days: Record<string, string[]> = {}
    for (const day of monthDates(m)) {
      if (day < today || !inRange(token, day)) continue
      const starts = startsFor(s, day, token.durationMin)
      if (starts.length) days[day] = starts
    }
    const out: AvailabilityResponse = { month: m, days }
    return out
  }

  if (method === 'POST' && path === '/booking/confirm') {
    const s = await getState()
    const token = await findToken(s, b.code)
    if (token.status !== 'active') throw err(409, 'TOKEN_USED', 'Este token já foi usado em um agendamento.')
    if (!isDate(b.date) || !isTime(b.start)) throw err(400, 'INVALID', 'Data ou horário inválido.')
    const day = b.date
    const start = b.start
    if (!inRange(token, day)) throw err(400, 'INVALID', 'Este token não vale para o dia escolhido.')
    if (!startsFor(s, day, token.durationMin).includes(start)) throw err(409, 'SLOT_TAKEN', 'Esse horário acabou de ser ocupado. Escolha outro.')
    const name = str(b.name, 80)
    if (name.length < 2) throw err(400, 'INVALID', 'Informe seu nome.')
    const phone = brPhone(b.phone)
    if (phone.length < 12) throw err(400, 'INVALID', 'Informe um WhatsApp com DDD.')
    const booking: PubBooking = {
      id: uid(),
      code: `FT-${randomCode(5)}`,
      status: 'confirmed',
      date: day,
      start,
      end: addMin(start, token.durationMin),
      durationMin: token.durationMin,
      firstName: name.split(/\s+/)[0],
      tokenId: token.id,
      source: 'token',
      createdAt: nowIso(),
    }
    await mutate('Novo agendamento', (st) => {
      st.bookings.push(booking)
      token.status = 'used'
      token.usedAt = nowIso()
      token.bookingId = booking.id
    })
    const priv = readPrivate()
    priv.bookings[booking.id] = { name, phone, email: str(b.email, 120), notes: str(b.notes, 300) }
    writePrivate(priv)
    return { booking: toPublicBooking(booking, booking.firstName) }
  }

  if (method === 'POST' && path === '/booking/cancel') {
    const s = await getState()
    const token = await findToken(s, b.code)
    const booking = s.bookings.find((x) => x.id === token.bookingId)
    if (token.status !== 'used' || !booking || booking.status !== 'confirmed') throw err(409, 'NOT_CANCELABLE', 'Não há agendamento ativo neste token.')
    if (!canCancel(s, booking)) {
      throw err(403, 'TOO_LATE', `Só é possível remarcar sozinho com ${s.settings.cancelWindowHours}h de antecedência. Fale com o estúdio pelo WhatsApp.`)
    }
    await mutate('Cliente cancelou', (st) => {
      booking.status = 'canceled'
      reopen(st, token)
    })
    return { ok: true }
  }

  /* ----- login (demonstração: senha fixa) ----- */
  if (method === 'POST' && path === '/admin/login') {
    if (b.password !== DEMO_PASSWORD) throw err(401, 'BAD_PASSWORD', 'Senha incorreta.')
    setSession(true)
    return { ok: true }
  }
  if (method === 'POST' && path === '/admin/logout') {
    setSession(false)
    return { ok: true }
  }
  if (method === 'GET' && path === '/admin/me') {
    requireKey()
    return { ok: true }
  }

  /* ----- painel ----- */
  if (seg[0] !== 'admin') throw err(404, 'NOT_FOUND', 'Rota não encontrada.')
  const { state: s } = await adminState()
  const p = readPrivate()
  const admin = seg.slice(1)
  const [res, id, action] = admin

  if (method === 'GET' && res === 'overview') {
    const today = studioNow(s).date
    const thisMonth = monthOf(today)
    const bks = s.bookings
    const closedMonths: string[] = []
    for (let i = 0; i < 3; i++) {
      const m = addMonths(thisMonth, i)
      if (!Object.entries(s.schedule).some(([d, w]) => monthOf(d) === m && d >= today && w.length > 0)) closedMonths.push(m)
    }
    const out: Overview = {
      today,
      todayBookings: bks.filter((x) => x.date === today && x.status !== 'canceled').sort(byTime).map((x) => fullBooking(x, p)),
      tomorrowCount: bks.filter((x) => x.date === addDays(today, 1) && x.status === 'confirmed').length,
      upcoming: bks
        .filter((x) => x.status === 'confirmed' && x.date > today && x.date <= addDays(today, 14))
        .sort(byTime)
        .slice(0, 12)
        .map((x) => fullBooking(x, p)),
      pendingRequests: [],
      counts: {
        pendingRequests: 0,
        activeTokens: s.tokens.filter((t) => tokenStatus(t) === 'active').length,
        week: bks.filter((x) => x.status === 'confirmed' && x.date >= today && x.date <= addDays(today, 6)).length,
        month: bks.filter((x) => live(x) && monthOf(x.date) === thisMonth).length,
        unread: 0,
      },
      closedMonths,
    }
    return out
  }

  /* tokens */
  if (res === 'tokens') {
    if (method === 'GET' && !id) return s.tokens.map((t) => fullToken(t, p))
    if (method === 'POST' && !id) {
      const code = newCode()
      const validity = int(b.validityHours ?? s.settings.tokenValidityHours, 'Validade', 1, 24 * 60)
      const token: PubToken = {
        id: uid(),
        codeHash: await sha256(code),
        status: 'active',
        durationMin: int(b.durationMin ?? s.settings.defaultDurationMin, 'Duração da sessão', 30, 720),
        dateFrom: isDate(b.dateFrom) ? b.dateFrom : null,
        dateTo: isDate(b.dateTo) ? b.dateTo : null,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + validity * 3_600_000).toISOString(),
        usedAt: null,
        bookingId: null,
      }
      await mutate('Novo token', (st) => {
        st.tokens.unshift(token)
      })
      const priv = readPrivate()
      priv.tokens[token.id] = { code, name: str(b.clientName, 80), phone: brPhone(b.clientPhone), note: str(b.note, 200) }
      writePrivate(priv)
      return fullToken(token, priv)
    }
    const t = s.tokens.find((x) => x.id === id)
    if (!t) throw err(404, 'NOT_FOUND', 'Token não encontrado.')
    if (method === 'POST' && action === 'revoke') {
      if (t.status === 'used') throw err(409, 'TOKEN_USED', 'Token já usado. Cancele o agendamento para liberar outro horário.')
      await mutate('Token cancelado', () => {
        t.status = 'revoked'
      })
      return fullToken(t, p)
    }
    if (method === 'POST' && action === 'extend') {
      if (t.status === 'used') throw err(409, 'TOKEN_USED', 'Token já usado.')
      const hours = int(b.hours ?? s.settings.tokenValidityHours, 'Horas', 1, 24 * 60)
      await mutate('Token reativado', () => {
        t.status = 'active'
        t.expiresAt = new Date(Math.max(Date.now(), Date.parse(t.expiresAt)) + hours * 3_600_000).toISOString()
      })
      return fullToken(t, p)
    }
    if (method === 'DELETE') {
      if (t.status === 'used') throw err(409, 'TOKEN_USED', 'Token já usado — ele fica no histórico do agendamento.')
      await mutate('Token apagado', (st) => {
        st.tokens = st.tokens.filter((x) => x.id !== t.id)
      })
      return { ok: true }
    }
  }

  /* agendamentos */
  if (res === 'bookings') {
    if (method === 'POST' && action === 'cancel') {
      const bk = s.bookings.find((x) => x.id === id)
      if (!bk) throw err(404, 'NOT_FOUND', 'Agendamento não encontrado.')
      if (bk.status === 'canceled') throw err(409, 'CANCELED', 'Este agendamento já foi cancelado.')
      await mutate('Agendamento cancelado', (st) => {
        bk.status = 'canceled'
        const t = st.tokens.find((x) => x.id === bk.tokenId)
        if (t && t.status === 'used' && b.reopenToken === true) reopen(st, t)
      })
      return { booking: fullBooking(bk, p), token: null }
    }
    if (method === 'GET') {
      const from = q.get('from') ?? ''
      const to = q.get('to') ?? ''
      return s.bookings.filter((x) => (!from || x.date >= from) && (!to || x.date <= to)).sort(byTime).map((x) => fullBooking(x, p))
    }
  }

  /* agenda */
  if (res === 'schedule') {
    if (method === 'GET') {
      const m = q.get('month') ?? ''
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw err(400, 'INVALID', 'Mês inválido.')
      const days: Record<string, TimeWindow[]> = {}
      for (const d of monthDates(m)) if (s.schedule[d]?.length) days[d] = s.schedule[d]
      const out: ScheduleMonth = {
        month: m,
        days,
        bookings: s.bookings.filter((x) => monthOf(x.date) === m && x.status !== 'canceled').sort(byTime).map((x) => fullBooking(x, p)),
      }
      return out
    }
    if (method === 'PUT') {
      if (!Array.isArray(b.dates) || b.dates.length === 0 || b.dates.length > 93) throw err(400, 'INVALID', 'Escolha de 1 a 93 dias.')
      const dates = [...new Set((b.dates as unknown[]).filter(isDate))]
      if (!Array.isArray(b.windows)) throw err(400, 'INVALID', 'Informe as janelas de horário.')
      let windows: TimeWindow[]
      try {
        windows = normalizeWindows((b.windows as { start: string; end: string }[]).map((w) => ({ start: w.start, end: w.end })))
      } catch (e) {
        throw err(400, 'INVALID', e instanceof Error ? e.message : 'Horários inválidos.')
      }
      const today = studioNow(s).date
      const result: ScheduleUpdateResult = { updated: 0, skipped: [] }
      await mutate('Agenda atualizada', (st) => {
        for (const day of dates) {
          if (day < today) {
            result.skipped.push({ date: day, reason: 'Dia já passou.' })
            continue
          }
          if (b.mode === 'skip-existing' && st.schedule[day]?.length) {
            result.skipped.push({ date: day, reason: 'Já estava aberto.' })
            continue
          }
          const booked = st.bookings.filter((x) => x.date === day && x.status === 'confirmed')
          const uncovered = booked.filter((x) => !windowsCover(windows, toMin(x.start), toMin(x.end)))
          if (uncovered.length) {
            result.skipped.push({
              date: day,
              reason: windows.length
                ? `Há ${uncovered.length} cliente(s) marcado(s) fora do novo horário.`
                : `Há ${uncovered.length} cliente(s) marcado(s) — cancele antes de fechar o dia.`,
            })
            continue
          }
          if (windows.length) st.schedule[day] = windows
          else delete st.schedule[day]
          result.updated += 1
        }
      })
      return result
    }
  }

  /* ajustes */
  if (res === 'settings') {
    if (method === 'GET' && !id) return s.settings
    if (method === 'PUT' && !id) {
      await mutate('Ajustes', (st) => {
        const t = st.settings
        if ('whatsapp' in b) t.whatsapp = brPhone(b.whatsapp)
        for (const k of ['instagram', 'hoursText', 'tagline'] as const) if (k in b) t[k] = str(b[k], 120)
        if ('about' in b) t.about = str(b.about, 3000)
        if ('minLeadHours' in b) t.minLeadHours = int(b.minLeadHours, 'Antecedência mínima', 0, 720)
        if ('cancelWindowHours' in b) t.cancelWindowHours = int(b.cancelWindowHours, 'Prazo para remarcar', 0, 720)
        if ('bufferMin' in b) t.bufferMin = int(b.bufferMin, 'Pausa entre sessões', 0, 180)
        if ('slotStepMin' in b) t.slotStepMin = int(b.slotStepMin, 'Intervalo entre inícios', 15, 240)
        if (b.openTemplate && typeof b.openTemplate === 'object') {
          const ot = b.openTemplate as { weekdays?: unknown; windows?: { start: string; end: string }[] }
          const weekdays = Array.isArray(ot.weekdays) ? [...new Set(ot.weekdays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : []
          let windows: TimeWindow[] = []
          try {
            windows = normalizeWindows((ot.windows ?? []).map((w) => ({ start: w.start, end: w.end })))
          } catch (e) {
            throw err(400, 'INVALID', e instanceof Error ? e.message : 'Horários inválidos.')
          }
          t.openTemplate = { weekdays, windows }
        }
      })
      return s.settings
    }
    if (method === 'POST' && id === 'password') {
      throw err(400, 'STATIC', 'Neste modo o acesso é pela chave do GitHub. Para trocar, crie uma chave nova no GitHub.')
    }
  }

  /* estilos e fotos */
  if (res === 'categories' && method === 'GET') return [...s.categories].sort((a, c) => a.order - c.order)

  if (res === 'works') {
    if (method === 'GET' && !id) return [...s.works].sort((a, c) => c.createdAt.localeCompare(a.createdAt)).map((w) => ({ ...w, imageUrl: withBase(w.imageUrl) }))
    if (method === 'POST' && !id) {
      const work: Work = {
        id: uid(),
        title: str(b.title, 80) || 'Novo trabalho',
        imageUrl: str(b.imageUrl, 400),
        categoryIds: Array.isArray(b.categoryIds) ? (b.categoryIds as unknown[]).filter((x): x is string => typeof x === 'string' && s.categories.some((c) => c.id === x)) : [],
        bodyArea: str(b.bodyArea, 60),
        featured: bool(b.featured),
        visible: bool(b.visible, true),
        createdAt: nowIso(),
      }
      if (!work.imageUrl) throw err(400, 'INVALID', 'Imagem inválida.')
      await mutate('Nova foto', (st) => {
        st.works.unshift(work)
      })
      return work
    }
    const w = s.works.find((x) => x.id === id)
    if (!w) throw err(404, 'NOT_FOUND', 'Trabalho não encontrado.')
    if (method === 'PATCH') {
      await mutate('Foto atualizada', () => {
        if ('title' in b) w.title = str(b.title, 80) || w.title
        if ('bodyArea' in b) w.bodyArea = str(b.bodyArea, 60)
        if ('featured' in b) w.featured = bool(b.featured, w.featured)
        if ('visible' in b) w.visible = bool(b.visible, w.visible)
        if (Array.isArray(b.categoryIds)) w.categoryIds = (b.categoryIds as unknown[]).filter((x): x is string => typeof x === 'string' && s.categories.some((c) => c.id === x))
      })
      return w
    }
    if (method === 'DELETE') {
      await mutate('Foto apagada', (st) => {
        st.works = st.works.filter((x) => x.id !== w.id)
      })
      return { ok: true }
    }
  }

  /* avisos */
  if (res === 'notices') {
    if (method === 'GET' && !id) return s.notices
    if (method === 'POST' && !id) {
      const text = str(b.text, 240)
      if (text.length < 3) throw err(400, 'INVALID', 'Aviso: escreva pelo menos 3 caracteres.')
      const n: Notice = { id: uid(), text, active: bool(b.active, true), createdAt: nowIso() }
      await mutate('Novo aviso', (st) => {
        st.notices.unshift(n)
      })
      return n
    }
    const n = s.notices.find((x) => x.id === id)
    if (!n) throw err(404, 'NOT_FOUND', 'Aviso não encontrado.')
    if (method === 'PATCH') {
      await mutate('Aviso atualizado', () => {
        if ('text' in b) n.text = str(b.text, 240) || n.text
        if ('active' in b) n.active = bool(b.active, n.active)
      })
      return n
    }
    if (method === 'DELETE') {
      await mutate('Aviso apagado', (st) => {
        st.notices = st.notices.filter((x) => x.id !== n.id)
      })
      return { ok: true }
    }
  }

  throw err(404, 'NOT_FOUND', 'Rota não encontrada.')
}

/** Demonstração: reduz a foto e guarda no navegador (data URL). */
export async function uploadStatic(file: File): Promise<string> {
  requireKey()
  const blob = await compressImage(file, 1000, 0.7)
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(err(400, 'INVALID', 'Não consegui ler a imagem.'))
    r.readAsDataURL(blob)
  })
}
