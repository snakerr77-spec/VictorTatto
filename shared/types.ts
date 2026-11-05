// Tipos compartilhados entre o servidor (server/) e o site/painel (src/).

/** Janela de horário aberta num dia. Formato "HH:mm" (24h). */
export interface TimeWindow {
  start: string
  end: string
}

export type RequestStatus = 'pending' | 'approved' | 'declined' | 'booked'
export type TokenStatus = 'active' | 'used' | 'revoked' | 'expired'
export type BookingStatus = 'confirmed' | 'done' | 'canceled' | 'no_show'

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  coverUrl: string
  visible: boolean
  /** Aparece na grade "Nossos Estilos" da home */
  showOnHome: boolean
  order: number
}

export interface Work {
  id: string
  title: string
  imageUrl: string
  categoryIds: string[]
  bodyArea: string
  featured: boolean
  visible: boolean
  createdAt: string
}

/** Aviso exibido no topo do site (ex.: agenda fechada, folga, promoção). */
export interface Notice {
  id: string
  text: string
  active: boolean
  createdAt: string
}

export interface QuoteRequest {
  id: string
  createdAt: string
  status: RequestStatus
  name: string
  phone: string
  email: string
  categoryId: string
  bodyArea: string
  size: string
  firstTattoo: boolean
  idea: string
  references: string[]
  adminNotes: string
  tokenId: string | null
}

export interface AccessToken {
  id: string
  code: string
  status: TokenStatus
  requestId: string | null
  clientName: string
  clientPhone: string
  durationMin: number
  note: string
  /** Restringe os dias que o cliente pode escolher (opcional) */
  dateFrom: string | null
  dateTo: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
  bookingId: string | null
}

export interface Booking {
  id: string
  code: string
  status: BookingStatus
  date: string
  start: string
  end: string
  durationMin: number
  clientName: string
  clientPhone: string
  clientEmail: string
  categoryId: string
  bodyArea: string
  idea: string
  notes: string
  requestId: string | null
  tokenId: string | null
  source: 'token' | 'admin'
  createdAt: string
}

export type NotificationKind = 'request' | 'booking' | 'canceled' | 'reminder' | 'summary' | 'system'

export interface AdminNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
  href: string
}

export interface NotifyChannels {
  ntfyTopic: string
  telegramBotToken: string
  telegramChatId: string
}

export interface OpenTemplate {
  weekdays: number[]
  windows: TimeWindow[]
}

export interface Settings {
  studioName: string
  since: number
  tagline: string
  about: string
  heroImage: string
  ctaImage: string
  whatsapp: string
  instagram: string
  tiktok: string
  address: string
  city: string
  hoursText: string
  timezone: string
  slotStepMin: number
  bufferMin: number
  minLeadHours: number
  tokenValidityHours: number
  cancelWindowHours: number
  defaultDurationMin: number
  reminderMin: number
  daySummaryHour: number
  openTemplate: OpenTemplate
  notify: NotifyChannels
}

export type PublicSettings = Pick<
  Settings,
  | 'studioName'
  | 'since'
  | 'tagline'
  | 'about'
  | 'heroImage'
  | 'ctaImage'
  | 'whatsapp'
  | 'instagram'
  | 'tiktok'
  | 'address'
  | 'city'
  | 'hoursText'
  | 'cancelWindowHours'
>

// ---------- Respostas da API pública ----------

export interface SiteData {
  settings: PublicSettings
  categories: Category[]
  works: Work[]
  notices: Notice[]
}

export interface PublicBooking {
  code: string
  status: BookingStatus
  date: string
  start: string
  end: string
  durationMin: number
  clientName: string
}

export interface PublicToken {
  clientName: string
  clientPhone: string
  durationMin: number
  note: string
  dateFrom: string | null
  dateTo: string | null
  expiresAt: string
  categoryId: string
  bodyArea: string
}

export type ValidateResponse =
  | { state: 'active'; token: PublicToken }
  | { state: 'used'; booking: PublicBooking; canCancel: boolean }

export interface AvailabilityResponse {
  month: string
  /** data (YYYY-MM-DD) → horários de início livres */
  days: Record<string, string[]>
}

// ---------- Respostas do painel ----------

export interface Overview {
  today: string
  todayBookings: Booking[]
  tomorrowCount: number
  upcoming: Booking[]
  pendingRequests: QuoteRequest[]
  counts: {
    pendingRequests: number
    activeTokens: number
    week: number
    month: number
    unread: number
  }
  /** Meses (YYYY-MM) sem nenhum dia aberto — a agenda ainda está fechada */
  closedMonths: string[]
}

export interface ScheduleMonth {
  month: string
  days: Record<string, TimeWindow[]>
  bookings: Booking[]
}

export interface ScheduleUpdateResult {
  updated: number
  skipped: { date: string; reason: string }[]
}

export interface ApiErrorBody {
  error: string
  message: string
}
