import { fromMin, toMin, wallMinutes } from '../shared/time'
import type { TimeWindow } from '../shared/types'

/** Intervalo ocupado dentro de um dia, em minutos desde 00:00. */
export interface Interval {
  start: number
  end: number
}

export interface AvailabilityInput {
  date: string
  windows: TimeWindow[]
  busy: Interval[]
  durationMin: number
  stepMin: number
  bufferMin: number
  now: { date: string; minutes: number }
  minLeadMin: number
}

/**
 * Horários de início livres num dia para uma sessão de `durationMin`.
 * - Começa em cada `stepMin` a partir do início de cada janela aberta.
 * - A sessão inteira precisa caber dentro da janela.
 * - Respeita `bufferMin` de intervalo antes/depois de outras sessões.
 * - Ignora o que já passou e o que está dentro da antecedência mínima.
 */
export function availableStarts(i: AvailabilityInput): string[] {
  const earliest = wallMinutes(i.now.date, i.now.minutes) + i.minLeadMin
  const out = new Set<number>()
  for (const w of i.windows) {
    const ws = toMin(w.start)
    const we = toMin(w.end)
    for (let s = ws; s + i.durationMin <= we; s += i.stepMin) {
      const e = s + i.durationMin
      if (wallMinutes(i.date, s) < earliest) continue
      const clash = i.busy.some((b) => s < b.end + i.bufferMin && e + i.bufferMin > b.start)
      if (!clash) out.add(s)
    }
  }
  return [...out].sort((a, b) => a - b).map(fromMin)
}

/** Ordena, valida e junta janelas que se tocam. Lança Error com mensagem em português. */
export function normalizeWindows(input: TimeWindow[]): TimeWindow[] {
  const list = input.map((w) => ({ s: toMin(w.start), e: toMin(w.end) }))
  for (const w of list) {
    if (!(w.s < w.e)) throw new Error('Cada janela precisa terminar depois de começar.')
    if (w.e - w.s < 30) throw new Error('Cada janela precisa ter pelo menos 30 minutos.')
  }
  list.sort((a, b) => a.s - b.s)
  const merged: { s: number; e: number }[] = []
  for (const w of list) {
    const last = merged.at(-1)
    if (last && w.s <= last.e) last.e = Math.max(last.e, w.e)
    else merged.push({ ...w })
  }
  return merged.map((w) => ({ start: fromMin(w.s), end: fromMin(w.e) }))
}

/** A sessão [start, end] (minutos) cabe inteira dentro de alguma janela? */
export const windowsCover = (windows: TimeWindow[], start: number, end: number): boolean =>
  windows.some((w) => toMin(w.start) <= start && end <= toMin(w.end))
