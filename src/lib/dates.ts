import { monthDates, monthOf, addMonths, weekday } from '../../shared/time'

export { monthDates, monthOf, addMonths, weekday }

/** Mês atual (YYYY-MM) no relógio do navegador. */
export const currentMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const at = (date: string) => new Date(`${date}T12:00:00`)

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const monthLabel = (m: string): string => cap(at(`${m}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

export const longDate = (date: string): string =>
  cap(at(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))

export const shortDate = (date: string): string => at(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

export const WEEK_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Células de um mês: null para os vazios antes do dia 1. */
export const monthCells = (m: string): (string | null)[] => {
  const dates = monthDates(m)
  return [...Array<null>(weekday(dates[0])).fill(null), ...dates]
}

export const durationLabel = (min: number): string => {
  const h = Math.floor(min / 60)
  const r = min % 60
  return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r} min`
}

export const waUrl = (phone: string, text: string): string =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
