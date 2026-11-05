import { Router, type Request } from 'express'
import { monthDates } from '../../shared/time'
import type {
  AccessToken,
  AvailabilityResponse,
  Booking,
  PublicSettings,
  QuoteRequest,
  SiteData,
  ValidateResponse,
} from '../../shared/types'
import { db, save, tokenStatus } from '../db'
import {
  bookingCode,
  brDate,
  clientCanCancel,
  publicBooking,
  publicToken,
  reopenToken,
  startsFor,
  studioNow,
  protocolOf,
} from '../domain'
import { bad, body, date as dateField, HttpError, imageUrl, month as monthField, optEmail, optText, phone, stringList, text, time as timeField } from '../http'
import { pushNotification } from '../notify'
import { createLimiter } from '../ratelimit'
import { rawImage, saveUpload } from '../uploads'
import { nowIso, normalizeCode, uid } from '../util'

export const publicRouter = Router()

const ip = (req: Request) => req.ip ?? 'unknown'

const uploadLimiter = createLimiter(30, 3_600_000, 'Muitos envios de imagem. Tente novamente mais tarde.')
const requestLimiter = createLimiter(6, 3_600_000, 'Você já enviou vários pedidos. Aguarde um pouco antes de tentar de novo.')
const tokenLimiter = createLimiter(15, 600_000, 'Muitas tentativas de token. Aguarde alguns minutos e tente de novo.')

// ---------- conteúdo do site ----------

export const publicSettings = (): PublicSettings => {
  const s = db.settings
  return {
    studioName: s.studioName,
    since: s.since,
    tagline: s.tagline,
    about: s.about,
    heroImage: s.heroImage,
    ctaImage: s.ctaImage,
    whatsapp: s.whatsapp,
    instagram: s.instagram,
    tiktok: s.tiktok,
    address: s.address,
    city: s.city,
    hoursText: s.hoursText,
    cancelWindowHours: s.cancelWindowHours,
  }
}

publicRouter.get('/site', (_req, res) => {
  const data: SiteData = {
    settings: publicSettings(),
    categories: db.categories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    works: db.works.filter((w) => w.visible).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notices: db.notices.filter((n) => n.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
  res.json(data)
})

// ---------- uploads de referência (pedido de orçamento) ----------

publicRouter.post(
  '/uploads',
  (req, _res, next) => {
    uploadLimiter.check(ip(req))
    uploadLimiter.add(ip(req))
    next()
  },
  rawImage('6mb'),
  saveUpload,
)

// ---------- pedido de orçamento ----------

publicRouter.post('/requests', (req, res) => {
  requestLimiter.check(ip(req))
  const b = body(req.body)
  const name = text(b.name, 'Nome', { min: 2, max: 80 })
  const phoneDigits = phone(b.phone)
  const email = optEmail(b.email)
  const categoryId = typeof b.categoryId === 'string' && db.categories.some((c) => c.id === b.categoryId) ? b.categoryId : ''
  const bodyArea = text(b.bodyArea, 'Região do corpo', { max: 60 })
  const size = optText(b.size, 'Tamanho', 60)
  const idea = text(b.idea, 'Sua ideia', { min: 10, max: 1500 })
  const references = stringList(b.references, 4)
    .map((u) => imageUrl(u, 'Referência'))
    .filter((u) => u.startsWith('/uploads/'))
  if (b.consent !== true) throw bad('Confirme que você tem 18 anos ou mais para enviar o pedido.')

  const request: QuoteRequest = {
    id: uid(),
    createdAt: nowIso(),
    status: 'pending',
    name,
    phone: phoneDigits,
    email,
    categoryId,
    bodyArea,
    size,
    firstTattoo: b.firstTattoo === true,
    idea,
    references,
    adminNotes: '',
    tokenId: null,
  }
  db.requests.unshift(request)
  requestLimiter.add(ip(req))
  save()
  pushNotification({
    kind: 'request',
    title: 'Novo pedido de orçamento',
    body: `${name} · ${bodyArea}${size ? ` · ${size}` : ''}`,
    href: '/admin/pedidos',
  })
  res.status(201).json({ id: request.id, protocol: protocolOf(request.id) })
})

// ---------- agendamento com token ----------

function loadToken(req: Request): AccessToken {
  tokenLimiter.check(ip(req))
  const code = normalizeCode(body(req.body).code)
  const token = code ? db.tokens.find((t) => t.code === code) : undefined
  if (!token) {
    tokenLimiter.add(ip(req))
    throw new HttpError(404, 'TOKEN_INVALID', 'Token não encontrado. Confira o código e tente de novo.')
  }
  const status = tokenStatus(token)
  if (status === 'revoked') throw new HttpError(403, 'TOKEN_REVOKED', 'Este token foi cancelado. Fale com o estúdio para receber um novo.')
  if (status === 'expired') throw new HttpError(410, 'TOKEN_EXPIRED', 'Este token expirou. Peça um novo ao estúdio.')
  tokenLimiter.clear(ip(req))
  return token
}

function activeToken(req: Request): AccessToken {
  const token = loadToken(req)
  if (token.status !== 'active') throw new HttpError(409, 'TOKEN_USED', 'Este token já foi usado em um agendamento.')
  return token
}

const inTokenRange = (t: AccessToken, day: string) => (!t.dateFrom || day >= t.dateFrom) && (!t.dateTo || day <= t.dateTo)

publicRouter.post('/booking/validate', (req, res) => {
  const token = loadToken(req)
  if (token.status === 'used') {
    const booking = db.bookings.find((b) => b.id === token.bookingId)
    if (!booking || booking.status === 'canceled') {
      throw new HttpError(409, 'TOKEN_USED', 'Este token já foi usado. Fale com o estúdio.')
    }
    const out: ValidateResponse = { state: 'used', booking: publicBooking(booking), canCancel: clientCanCancel(booking) }
    res.json(out)
    return
  }
  const out: ValidateResponse = { state: 'active', token: publicToken(token) }
  res.json(out)
})

publicRouter.post('/booking/availability', (req, res) => {
  const token = activeToken(req)
  const m = monthField(body(req.body).month)
  const today = studioNow().date
  const days: Record<string, string[]> = {}
  for (const day of monthDates(m)) {
    if (day < today || !inTokenRange(token, day)) continue
    const starts = startsFor(day, token.durationMin)
    if (starts.length) days[day] = starts
  }
  const out: AvailabilityResponse = { month: m, days }
  res.json(out)
})

publicRouter.post('/booking/confirm', (req, res) => {
  const token = activeToken(req)
  const b = body(req.body)
  const day = dateField(b.date, 'Data')
  const start = timeField(b.start, 'Horário')
  if (!inTokenRange(token, day)) throw bad('Este token não vale para o dia escolhido.')
  if (!startsFor(day, token.durationMin).includes(start)) {
    throw new HttpError(409, 'SLOT_TAKEN', 'Esse horário acabou de ser ocupado. Escolha outro.')
  }
  const name = text(b.name, 'Nome', { min: 2, max: 80 })
  const phoneDigits = phone(b.phone)
  const email = optEmail(b.email)
  const notes = optText(b.notes, 'Observações', 300)

  const [h = 0, m = 0] = start.split(':').map(Number)
  const endMin = h * 60 + m + token.durationMin
  const linked = token.requestId ? db.requests.find((r) => r.id === token.requestId) : undefined

  const booking: Booking = {
    id: uid(),
    code: bookingCode(),
    status: 'confirmed',
    date: day,
    start,
    end: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
    durationMin: token.durationMin,
    clientName: name,
    clientPhone: phoneDigits,
    clientEmail: email,
    categoryId: linked?.categoryId ?? '',
    bodyArea: linked?.bodyArea ?? '',
    idea: linked?.idea ?? '',
    notes,
    requestId: token.requestId,
    tokenId: token.id,
    source: 'token',
    createdAt: nowIso(),
  }
  db.bookings.push(booking)
  token.status = 'used'
  token.usedAt = nowIso()
  token.bookingId = booking.id
  if (!token.clientName) token.clientName = name
  if (linked) linked.status = 'booked'
  save()

  const today = studioNow().date
  pushNotification({
    kind: 'booking',
    title: day === today ? 'Novo cliente HOJE' : 'Novo agendamento',
    body: `${name} · ${brDate(day)} às ${start} (${Math.round(token.durationMin / 60 * 10) / 10}h)`,
    href: `/admin/agenda?data=${day}`,
  })
  res.status(201).json({ booking: publicBooking(booking) })
})

publicRouter.post('/booking/cancel', (req, res) => {
  const token = loadToken(req)
  const booking = db.bookings.find((x) => x.id === token.bookingId)
  if (token.status !== 'used' || !booking || booking.status !== 'confirmed') {
    throw new HttpError(409, 'NOT_CANCELABLE', 'Não há agendamento ativo neste token.')
  }
  if (!clientCanCancel(booking)) {
    throw new HttpError(
      403,
      'TOO_LATE',
      `Só é possível remarcar sozinho com ${db.settings.cancelWindowHours}h de antecedência. Fale com o estúdio pelo WhatsApp.`,
    )
  }
  booking.status = 'canceled'
  reopenToken(token)
  save()
  pushNotification({
    kind: 'canceled',
    title: 'Cliente cancelou o horário',
    body: `${booking.clientName} · ${brDate(booking.date)} às ${booking.start} — o token voltou a ficar ativo para remarcar.`,
    href: `/admin/agenda?data=${booking.date}`,
  })
  res.json({ ok: true })
})
