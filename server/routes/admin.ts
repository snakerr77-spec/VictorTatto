import { Router, type Request } from 'express'
import { addDays, addMonths, monthDates, monthOf, toMin, fromMin } from '../../shared/time'
import type {
  Booking,
  Category,
  Notice,
  Overview,
  ScheduleMonth,
  ScheduleUpdateResult,
  Settings,
  TimeWindow,
  Work,
} from '../../shared/types'
import { endSession, requireAdmin, startSession } from '../auth'
import { hashPassword, verifyPassword } from '../auth-crypto'
import { isValidTimeZone } from '../clock'
import { db, defaultSettings, save, tokenStatus, withStatus } from '../db'
import { bookingCode, brDate, createTokenRecord, reopenToken, studioNow } from '../domain'
import {
  bad,
  body,
  date as dateField,
  flag,
  HttpError,
  imageUrl,
  int,
  month as monthField,
  optDate,
  optEmail,
  optText,
  phone,
  text,
  time as timeField,
} from '../http'
import { connect } from '../hub'
import { pushNotification, sendExternal } from '../notify'
import { createLimiter } from '../ratelimit'
import { normalizeWindows, windowsCover } from '../schedule'
import { rawImage, removeUpload, saveUpload } from '../uploads'
import { newTokenCode, nowIso, slugify, uid } from '../util'

export const adminRouter = Router()

const loginLimiter = createLimiter(8, 15 * 60_000, 'Muitas tentativas de login. Aguarde 15 minutos.')
const ip = (req: Request) => req.ip ?? 'unknown'

adminRouter.post('/login', (req, res) => {
  loginLimiter.check(ip(req))
  const password = typeof body(req.body).password === 'string' ? (body(req.body).password as string) : ''
  if (!verifyPassword(password, db.meta.passwordHash)) {
    loginLimiter.add(ip(req))
    throw new HttpError(401, 'BAD_PASSWORD', 'Senha incorreta.')
  }
  loginLimiter.clear(ip(req))
  startSession(req, res)
  res.json({ ok: true })
})

adminRouter.post('/logout', (_req, res) => {
  endSession(res)
  res.json({ ok: true })
})

// Tudo abaixo exige sessão de admin.
adminRouter.use(requireAdmin)

adminRouter.get('/me', (_req, res) => {
  res.json({ ok: true })
})
adminRouter.get('/events', connect)

// ---------- helpers ----------

function mustFind<T extends { id: string }>(list: T[], id: string, what: string): T {
  const item = list.find((x) => x.id === id)
  if (!item) throw new HttpError(404, 'NOT_FOUND', `${what} não encontrado(a).`)
  return item
}

const byTime = (a: Booking, b: Booking) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

function uniqueCode(): string {
  for (;;) {
    const code = newTokenCode()
    if (!db.tokens.some((t) => t.code === code)) return code
  }
}

const isLive = (b: Booking) => b.status === 'confirmed' || b.status === 'done'

function findConflict(day: string, startMin: number, endMin: number, exceptId?: string): Booking | undefined {
  return db.bookings.find(
    (b) => b.id !== exceptId && b.date === day && isLive(b) && startMin < toMin(b.end) && endMin > toMin(b.start),
  )
}

function dateRange(b: Record<string, unknown>) {
  const dateFrom = optDate(b.dateFrom, 'Válido a partir de')
  const dateTo = optDate(b.dateTo, 'Válido até')
  if (dateFrom && dateTo && dateTo < dateFrom) throw bad('O período do token está invertido.')
  return { dateFrom, dateTo }
}

// ---------- visão geral ----------

adminRouter.get('/overview', (_req, res) => {
  const today = studioNow().date
  const thisMonth = monthOf(today)
  const todayBookings = db.bookings.filter((b) => b.date === today && b.status !== 'canceled').sort(byTime)
  const closedMonths: string[] = []
  for (let i = 0; i < 3; i++) {
    const m = addMonths(thisMonth, i)
    const hasOpenDay = Object.entries(db.schedule).some(([d, w]) => monthOf(d) === m && d >= today && w.length > 0)
    if (!hasOpenDay) closedMonths.push(m)
  }
  const out: Overview = {
    today,
    todayBookings,
    tomorrowCount: db.bookings.filter((b) => b.date === addDays(today, 1) && b.status === 'confirmed').length,
    upcoming: db.bookings
      .filter((b) => b.status === 'confirmed' && b.date > today && b.date <= addDays(today, 14))
      .sort(byTime)
      .slice(0, 12),
    pendingRequests: db.requests.filter((r) => r.status === 'pending').slice(0, 5),
    counts: {
      pendingRequests: db.requests.filter((r) => r.status === 'pending').length,
      activeTokens: db.tokens.filter((t) => tokenStatus(t) === 'active').length,
      week: db.bookings.filter((b) => b.status === 'confirmed' && b.date >= today && b.date <= addDays(today, 6)).length,
      month: db.bookings.filter((b) => isLive(b) && monthOf(b.date) === thisMonth).length,
      unread: db.notifications.filter((n) => !n.read).length,
    },
    closedMonths,
  }
  res.json(out)
})

// ---------- pedidos de orçamento ----------

adminRouter.get('/requests', (_req, res) => {
  res.json(db.requests)
})

adminRouter.patch('/requests/:id', (req, res) => {
  const r = mustFind(db.requests, req.params.id, 'Pedido')
  r.adminNotes = optText(body(req.body).adminNotes, 'Anotações', 1000)
  save()
  res.json(r)
})

adminRouter.post('/requests/:id/approve', (req, res) => {
  const r = mustFind(db.requests, req.params.id, 'Pedido')
  if (r.status === 'booked') throw new HttpError(409, 'ALREADY_BOOKED', 'Este cliente já tem horário agendado.')
  const b = body(req.body)
  const previous = r.tokenId ? db.tokens.find((t) => t.id === r.tokenId) : undefined
  if (previous && previous.status === 'active') previous.status = 'revoked'
  const token = createTokenRecord({
    requestId: r.id,
    clientName: r.name,
    clientPhone: r.phone,
    durationMin: int(b.durationMin ?? db.settings.defaultDurationMin, 'Duração da sessão', 30, 720),
    validityHours: int(b.validityHours ?? db.settings.tokenValidityHours, 'Validade', 1, 24 * 60),
    note: optText(b.note, 'Observação', 200),
    ...dateRange(b),
    code: uniqueCode(),
  })
  db.tokens.unshift(token)
  r.tokenId = token.id
  r.status = 'approved'
  save()
  res.status(201).json({ token: withStatus(token), request: r })
})

adminRouter.post('/requests/:id/decline', (req, res) => {
  const r = mustFind(db.requests, req.params.id, 'Pedido')
  if (r.status === 'booked') throw new HttpError(409, 'ALREADY_BOOKED', 'Este cliente já tem horário agendado.')
  const previous = r.tokenId ? db.tokens.find((t) => t.id === r.tokenId) : undefined
  if (previous && previous.status === 'active') previous.status = 'revoked'
  r.status = 'declined'
  save()
  res.json(r)
})

adminRouter.delete('/requests/:id', (req, res) => {
  const r = mustFind(db.requests, req.params.id, 'Pedido')
  for (const t of db.tokens) if (t.requestId === r.id) t.requestId = null
  for (const u of r.references) removeUpload(u)
  db.requests = db.requests.filter((x) => x.id !== r.id)
  save()
  res.json({ ok: true })
})

// ---------- tokens ----------

adminRouter.get('/tokens', (_req, res) => {
  res.json(db.tokens.map(withStatus))
})

adminRouter.post('/tokens', (req, res) => {
  const b = body(req.body)
  const digits = typeof b.clientPhone === 'string' && b.clientPhone.trim() ? phone(b.clientPhone, 'WhatsApp') : ''
  const token = createTokenRecord({
    requestId: null,
    clientName: optText(b.clientName, 'Nome do cliente', 80),
    clientPhone: digits,
    durationMin: int(b.durationMin ?? db.settings.defaultDurationMin, 'Duração da sessão', 30, 720),
    validityHours: int(b.validityHours ?? db.settings.tokenValidityHours, 'Validade', 1, 24 * 60),
    note: optText(b.note, 'Observação', 200),
    ...dateRange(b),
    code: uniqueCode(),
  })
  db.tokens.unshift(token)
  save()
  res.status(201).json(withStatus(token))
})

adminRouter.post('/tokens/:id/revoke', (req, res) => {
  const t = mustFind(db.tokens, req.params.id, 'Token')
  if (t.status === 'used') throw new HttpError(409, 'TOKEN_USED', 'Token já usado. Cancele o agendamento para liberar outro horário.')
  t.status = 'revoked'
  const r = t.requestId ? db.requests.find((x) => x.id === t.requestId) : undefined
  if (r && r.status === 'approved') r.status = 'pending'
  save()
  res.json(withStatus(t))
})

adminRouter.post('/tokens/:id/extend', (req, res) => {
  const t = mustFind(db.tokens, req.params.id, 'Token')
  if (t.status === 'used') throw new HttpError(409, 'TOKEN_USED', 'Token já usado.')
  const hours = int(body(req.body).hours ?? db.settings.tokenValidityHours, 'Horas', 1, 24 * 60)
  t.status = 'active'
  t.expiresAt = new Date(Math.max(Date.now(), Date.parse(t.expiresAt)) + hours * 3_600_000).toISOString()
  save()
  res.json(withStatus(t))
})

adminRouter.delete('/tokens/:id', (req, res) => {
  const t = mustFind(db.tokens, req.params.id, 'Token')
  if (t.status === 'used') throw new HttpError(409, 'TOKEN_USED', 'Token já usado — ele fica no histórico do agendamento.')
  const r = t.requestId ? db.requests.find((x) => x.id === t.requestId) : undefined
  if (r && r.tokenId === t.id) {
    r.tokenId = null
    if (r.status === 'approved') r.status = 'pending'
  }
  db.tokens = db.tokens.filter((x) => x.id !== t.id)
  save()
  res.json({ ok: true })
})

// ---------- agendamentos ----------

adminRouter.get('/bookings', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : ''
  const to = typeof req.query.to === 'string' ? req.query.to : ''
  const list = db.bookings.filter((b) => (!from || b.date >= from) && (!to || b.date <= to)).sort(byTime)
  res.json(list.slice(0, 500))
})

adminRouter.post('/bookings', (req, res) => {
  const b = body(req.body)
  const day = dateField(b.date, 'Data')
  const start = timeField(b.start, 'Horário')
  const durationMin = int(b.durationMin, 'Duração', 30, 720)
  const s = toMin(start)
  const e = s + durationMin
  if (e > 24 * 60) throw bad('A sessão passa da meia-noite.')
  const clash = findConflict(day, s, e)
  if (clash && !flag(b.force)) {
    throw new HttpError(409, 'CONFLICT', `Conflita com ${clash.clientName} (${clash.start}–${clash.end}).`)
  }
  const booking: Booking = {
    id: uid(),
    code: bookingCode(),
    status: 'confirmed',
    date: day,
    start,
    end: fromMin(e),
    durationMin,
    clientName: text(b.clientName, 'Nome', { min: 2, max: 80 }),
    clientPhone: typeof b.clientPhone === 'string' && b.clientPhone.trim() ? phone(b.clientPhone) : '',
    clientEmail: optEmail(b.clientEmail),
    categoryId: typeof b.categoryId === 'string' && db.categories.some((c) => c.id === b.categoryId) ? b.categoryId : '',
    bodyArea: optText(b.bodyArea, 'Região', 60),
    idea: optText(b.idea, 'Ideia', 1500),
    notes: optText(b.notes, 'Anotações', 500),
    requestId: null,
    tokenId: null,
    source: 'admin',
    createdAt: nowIso(),
  }
  db.bookings.push(booking)
  save()
  res.status(201).json(booking)
})

adminRouter.patch('/bookings/:id', (req, res) => {
  const booking = mustFind(db.bookings, req.params.id, 'Agendamento')
  const b = body(req.body)
  if (booking.status === 'canceled' && ('status' in b || 'date' in b || 'start' in b)) {
    throw new HttpError(409, 'CANCELED', 'Agendamento cancelado não pode ser alterado.')
  }
  if ('status' in b) {
    if (b.status !== 'confirmed' && b.status !== 'done' && b.status !== 'no_show') throw bad('Status inválido.')
    booking.status = b.status
  }
  if ('notes' in b) booking.notes = optText(b.notes, 'Anotações', 500)
  if ('clientName' in b) booking.clientName = text(b.clientName, 'Nome', { min: 2, max: 80 })
  if ('clientPhone' in b) booking.clientPhone = typeof b.clientPhone === 'string' && b.clientPhone.trim() ? phone(b.clientPhone) : ''
  if ('date' in b || 'start' in b) {
    const day = dateField(b.date ?? booking.date, 'Data')
    const start = timeField(b.start ?? booking.start, 'Horário')
    const s = toMin(start)
    const e = s + booking.durationMin
    if (e > 24 * 60) throw bad('A sessão passa da meia-noite.')
    const clash = findConflict(day, s, e, booking.id)
    if (clash && !flag(b.force)) {
      throw new HttpError(409, 'CONFLICT', `Conflita com ${clash.clientName} (${clash.start}–${clash.end}).`)
    }
    booking.date = day
    booking.start = start
    booking.end = fromMin(e)
    db.meta.reminded = db.meta.reminded.filter((id) => id !== booking.id)
  }
  save()
  res.json(booking)
})

adminRouter.post('/bookings/:id/cancel', (req, res) => {
  const booking = mustFind(db.bookings, req.params.id, 'Agendamento')
  if (booking.status === 'canceled') throw new HttpError(409, 'CANCELED', 'Este agendamento já foi cancelado.')
  booking.status = 'canceled'
  const token = booking.tokenId ? db.tokens.find((t) => t.id === booking.tokenId) : undefined
  if (token && token.status === 'used' && flag(body(req.body).reopenToken)) reopenToken(token)
  save()
  res.json({ booking, token: token ? withStatus(token) : null })
})

// ---------- agenda do mês ----------

adminRouter.get('/schedule', (req, res) => {
  const m = monthField(req.query.month)
  const days: Record<string, TimeWindow[]> = {}
  for (const d of monthDates(m)) {
    const w = db.schedule[d]
    if (w?.length) days[d] = w
  }
  const out: ScheduleMonth = {
    month: m,
    days,
    bookings: db.bookings.filter((b) => monthOf(b.date) === m && b.status !== 'canceled').sort(byTime),
  }
  res.json(out)
})

/** Abre/edita/fecha vários dias de uma vez. `windows` vazio = fechar. */
adminRouter.put('/schedule', (req, res) => {
  const b = body(req.body)
  if (!Array.isArray(b.dates) || b.dates.length === 0 || b.dates.length > 93) throw bad('Escolha de 1 a 93 dias.')
  const dates = [...new Set(b.dates.map((d) => dateField(d, 'Data')))]
  if (!Array.isArray(b.windows)) throw bad('Informe as janelas de horário.')
  let windows: TimeWindow[]
  try {
    windows = normalizeWindows(
      b.windows.map((w) => {
        const o = body(w)
        return { start: timeField(o.start, 'Início'), end: timeField(o.end, 'Fim') }
      }),
    )
  } catch (err) {
    throw bad(err instanceof Error ? err.message : 'Horários inválidos.')
  }
  const skipExisting = b.mode === 'skip-existing'
  const today = studioNow().date
  const result: ScheduleUpdateResult = { updated: 0, skipped: [] }

  for (const day of dates) {
    if (day < today) {
      result.skipped.push({ date: day, reason: 'Dia já passou.' })
      continue
    }
    if (skipExisting && db.schedule[day]?.length) {
      result.skipped.push({ date: day, reason: 'Já estava aberto.' })
      continue
    }
    const booked = db.bookings.filter((x) => x.date === day && x.status === 'confirmed')
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
    if (windows.length) db.schedule[day] = windows
    else delete db.schedule[day]
    result.updated += 1
  }
  save()
  res.json(result)
})

// ---------- categorias ----------

adminRouter.get('/categories', (_req, res) => {
  res.json([...db.categories].sort((a, b) => a.order - b.order))
})

function uniqueSlug(name: string, exceptId?: string): string {
  const base = slugify(name)
  let slug = base
  for (let i = 2; db.categories.some((c) => c.slug === slug && c.id !== exceptId); i++) slug = `${base}-${i}`
  return slug
}

adminRouter.post('/categories', (req, res) => {
  const b = body(req.body)
  const name = text(b.name, 'Nome', { max: 40 })
  const category: Category = {
    id: uid(),
    name,
    slug: uniqueSlug(name),
    description: optText(b.description, 'Descrição', 160),
    coverUrl: imageUrl(b.coverUrl, 'Capa', true),
    visible: flag(b.visible, true),
    showOnHome: flag(b.showOnHome, true),
    order: db.categories.reduce((max, c) => Math.max(max, c.order), -1) + 1,
  }
  db.categories.push(category)
  save()
  res.status(201).json(category)
})

adminRouter.post('/categories/reorder', (req, res) => {
  const ids = body(req.body).ids
  if (!Array.isArray(ids)) throw bad('Lista de categorias inválida.')
  ids.forEach((id, i) => {
    const c = db.categories.find((x) => x.id === id)
    if (c) c.order = i
  })
  save()
  res.json({ ok: true })
})

adminRouter.patch('/categories/:id', (req, res) => {
  const c = mustFind(db.categories, req.params.id, 'Categoria')
  const b = body(req.body)
  if ('name' in b) {
    c.name = text(b.name, 'Nome', { max: 40 })
    c.slug = uniqueSlug(c.name, c.id)
  }
  if ('description' in b) c.description = optText(b.description, 'Descrição', 160)
  if ('coverUrl' in b) c.coverUrl = imageUrl(b.coverUrl, 'Capa', true)
  if ('visible' in b) c.visible = flag(b.visible, c.visible)
  if ('showOnHome' in b) c.showOnHome = flag(b.showOnHome, c.showOnHome)
  save()
  res.json(c)
})

adminRouter.delete('/categories/:id', (req, res) => {
  const c = mustFind(db.categories, req.params.id, 'Categoria')
  for (const w of db.works) w.categoryIds = w.categoryIds.filter((id) => id !== c.id)
  db.categories = db.categories.filter((x) => x.id !== c.id)
  save()
  res.json({ ok: true })
})

// ---------- trabalhos (portfólio) ----------

adminRouter.get('/works', (_req, res) => {
  res.json([...db.works].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

const validCategoryIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && db.categories.some((c) => c.id === id)) : []

adminRouter.post('/works', (req, res) => {
  const b = body(req.body)
  const work: Work = {
    id: uid(),
    title: text(b.title, 'Título', { max: 80 }),
    imageUrl: imageUrl(b.imageUrl, 'Imagem'),
    categoryIds: validCategoryIds(b.categoryIds),
    bodyArea: optText(b.bodyArea, 'Região', 60),
    featured: flag(b.featured),
    visible: flag(b.visible, true),
    createdAt: nowIso(),
  }
  db.works.unshift(work)
  save()
  res.status(201).json(work)
})

adminRouter.patch('/works/:id', (req, res) => {
  const w = mustFind(db.works, req.params.id, 'Trabalho')
  const b = body(req.body)
  if ('title' in b) w.title = text(b.title, 'Título', { max: 80 })
  if ('imageUrl' in b) w.imageUrl = imageUrl(b.imageUrl, 'Imagem')
  if ('categoryIds' in b) w.categoryIds = validCategoryIds(b.categoryIds)
  if ('bodyArea' in b) w.bodyArea = optText(b.bodyArea, 'Região', 60)
  if ('featured' in b) w.featured = flag(b.featured, w.featured)
  if ('visible' in b) w.visible = flag(b.visible, w.visible)
  save()
  res.json(w)
})

adminRouter.delete('/works/:id', (req, res) => {
  const w = mustFind(db.works, req.params.id, 'Trabalho')
  db.works = db.works.filter((x) => x.id !== w.id)
  const stillUsed = db.works.some((x) => x.imageUrl === w.imageUrl) || db.categories.some((c) => c.coverUrl === w.imageUrl)
  if (!stillUsed) removeUpload(w.imageUrl)
  save()
  res.json({ ok: true })
})

adminRouter.post('/uploads', rawImage('15mb'), saveUpload)

// ---------- avisos do site ----------

adminRouter.get('/notices', (_req, res) => {
  res.json(db.notices)
})

adminRouter.post('/notices', (req, res) => {
  const b = body(req.body)
  const notice: Notice = {
    id: uid(),
    text: text(b.text, 'Aviso', { min: 3, max: 240 }),
    active: flag(b.active, true),
    createdAt: nowIso(),
  }
  db.notices.unshift(notice)
  save()
  res.status(201).json(notice)
})

adminRouter.patch('/notices/:id', (req, res) => {
  const n = mustFind(db.notices, req.params.id, 'Aviso')
  const b = body(req.body)
  if ('text' in b) n.text = text(b.text, 'Aviso', { min: 3, max: 240 })
  if ('active' in b) n.active = flag(b.active, n.active)
  save()
  res.json(n)
})

adminRouter.delete('/notices/:id', (req, res) => {
  const n = mustFind(db.notices, req.params.id, 'Aviso')
  db.notices = db.notices.filter((x) => x.id !== n.id)
  save()
  res.json({ ok: true })
})

// ---------- notificações ----------

adminRouter.get('/notifications', (_req, res) => {
  res.json({ items: db.notifications.slice(0, 80), unread: db.notifications.filter((n) => !n.read).length })
})

adminRouter.post('/notifications/read', (req, res) => {
  const ids = body(req.body).ids
  for (const n of db.notifications) if (!Array.isArray(ids) || ids.includes(n.id)) n.read = true
  save()
  res.json({ ok: true })
})

adminRouter.delete('/notifications', (_req, res) => {
  db.notifications = []
  save()
  res.json({ ok: true })
})

// ---------- configurações ----------

adminRouter.get('/settings', (_req, res) => {
  res.json(db.settings)
})

const TEXT_FIELDS: [keyof Settings, string, number][] = [
  ['studioName', 'Nome do estúdio', 60],
  ['tagline', 'Frase de efeito', 120],
  ['about', 'Sobre', 3000],
  ['instagram', 'Instagram', 60],
  ['tiktok', 'TikTok', 60],
  ['address', 'Endereço', 120],
  ['city', 'Cidade', 80],
  ['hoursText', 'Horário de atendimento', 80],
]

const INT_FIELDS: [keyof Settings, string, number, number][] = [
  ['since', 'Ano de fundação', 1900, 2100],
  ['slotStepMin', 'Intervalo entre inícios', 15, 240],
  ['bufferMin', 'Pausa entre sessões', 0, 180],
  ['minLeadHours', 'Antecedência mínima', 0, 720],
  ['tokenValidityHours', 'Validade do token', 1, 24 * 60],
  ['cancelWindowHours', 'Prazo para remarcar', 0, 24 * 30],
  ['defaultDurationMin', 'Duração padrão', 30, 720],
  ['reminderMin', 'Lembrete antes da sessão', 0, 720],
  ['daySummaryHour', 'Hora do resumo do dia', 0, 23],
]

adminRouter.put('/settings', (req, res) => {
  const b = body(req.body)
  const s = db.settings
  // Grava campo a campo depois de validar; `target` só serve para escrever nas chaves conhecidas acima.
  const target = s as unknown as Record<string, unknown>
  for (const [key, label, max] of TEXT_FIELDS) {
    if (key in b) target[key] = key === 'studioName' ? text(b[key], label, { max }) : optText(b[key], label, max)
  }
  for (const [key, label, min, max] of INT_FIELDS) {
    if (key in b) target[key] = int(b[key], label, min, max)
  }
  if ('heroImage' in b) s.heroImage = imageUrl(b.heroImage, 'Foto da capa', true) || defaultSettings().heroImage
  if ('ctaImage' in b) s.ctaImage = imageUrl(b.ctaImage, 'Foto da faixa', true) || defaultSettings().ctaImage
  if ('whatsapp' in b) s.whatsapp = typeof b.whatsapp === 'string' && b.whatsapp.trim() ? phone(b.whatsapp) : ''
  if ('timezone' in b) {
    if (typeof b.timezone !== 'string' || !isValidTimeZone(b.timezone)) throw bad('Fuso horário inválido.')
    s.timezone = b.timezone
  }
  if ('openTemplate' in b) {
    const t = body(b.openTemplate)
    const weekdays = Array.isArray(t.weekdays) ? [...new Set(t.weekdays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))] : []
    let windows: TimeWindow[] = []
    try {
      windows = normalizeWindows(
        (Array.isArray(t.windows) ? t.windows : []).map((w) => {
          const o = body(w)
          return { start: timeField(o.start, 'Início'), end: timeField(o.end, 'Fim') }
        }),
      )
    } catch (err) {
      throw bad(err instanceof Error ? err.message : 'Horários inválidos.')
    }
    s.openTemplate = { weekdays: weekdays.sort(), windows }
  }
  if ('notify' in b) {
    const n = body(b.notify)
    s.notify = {
      ntfyTopic: optText(n.ntfyTopic, 'Tópico ntfy', 80).replace(/[^\w-]/g, ''),
      telegramBotToken: optText(n.telegramBotToken, 'Token do bot', 120),
      telegramChatId: optText(n.telegramChatId, 'Chat ID', 40),
    }
  }
  save()
  res.json(s)
})

adminRouter.post('/settings/password', (req, res) => {
  const b = body(req.body)
  const current = typeof b.current === 'string' ? b.current : ''
  if (!verifyPassword(current, db.meta.passwordHash)) throw new HttpError(403, 'BAD_PASSWORD', 'Senha atual incorreta.')
  const next = text(b.next, 'Nova senha', { min: 8, max: 100 })
  db.meta.passwordHash = hashPassword(next)
  save()
  res.json({ ok: true })
})

adminRouter.post('/settings/notify-test', async (_req, res) => {
  const { ntfyTopic, telegramBotToken, telegramChatId } = db.settings.notify
  if (!ntfyTopic && !(telegramBotToken && telegramChatId)) {
    throw bad('Configure o ntfy ou o Telegram e salve antes de testar.')
  }
  const out = await sendExternal('Teste — Victor Tattoo', 'Se você recebeu isto, os avisos no celular estão funcionando ✦')
  if (!out.ok) throw new HttpError(502, 'NOTIFY_FAILED', `Não consegui enviar: ${out.error ?? 'erro desconhecido'}`)
  res.json(out)
})

// ---------- atalhos para o painel ----------

/** Cria um aviso de teste no painel (útil para ver o alerta ao vivo). */
adminRouter.post('/notifications/test', (_req, res) => {
  const now = studioNow()
  pushNotification({
    kind: 'system',
    title: 'Aviso de teste',
    body: `Tudo certo por aqui — ${brDate(now.date)}, ${fromMin(now.minutes)}.`,
    href: '/admin',
  })
  res.json({ ok: true })
})

