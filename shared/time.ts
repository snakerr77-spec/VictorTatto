// Helpers de data/hora sem fuso: tudo trabalha com strings "YYYY-MM-DD" e "HH:mm"
// (horário de parede do estúdio). O servidor é quem sabe "que horas são agora".

export const pad = (n: number) => String(n).padStart(2, '0')

export const toMin = (hhmm: string): number => {
  const [h = '0', m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export const fromMin = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

export const isDateStr = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export const isTimeStr = (s: unknown): s is string =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export const isMonthStr = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** Índice do dia (dias desde 1970) — permite comparar/somar datas sem fuso. */
export const dayIndex = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export const dateFromIndex = (idx: number): string => {
  const dt = new Date(idx * 86_400_000)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export const addDays = (date: string, n: number): string => dateFromIndex(dayIndex(date) + n)

/** 0 = domingo … 6 = sábado */
export const weekday = (date: string): number => (dayIndex(date) + 4) % 7

export const monthOf = (date: string): string => date.slice(0, 7)

export const daysInMonth = (month: string): number => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const monthDates = (month: string): string[] =>
  Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad(i + 1)}`)

export const addMonths = (month: string, n: number): string => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

/** Minutos de parede absolutos — serve para comparar "agora" com um horário de sessão. */
export const wallMinutes = (date: string, min: number): number => dayIndex(date) * 1440 + min
