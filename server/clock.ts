import { pad } from '../shared/time'

export interface LocalNow {
  date: string
  minutes: number
}

/** Data e minutos-do-dia no fuso do estúdio (o servidor pode estar em UTC). */
export function localNow(timeZone: string, at: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { date: `${get('year')}-${pad(get('month'))}-${pad(get('day'))}`, minutes: get('hour') * 60 + get('minute') }
}

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
