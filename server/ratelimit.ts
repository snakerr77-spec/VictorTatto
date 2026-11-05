import { HttpError } from './http'

/** Limitador em memória por chave (IP). `check` barra quando estourou; `add` registra uma tentativa. */
export function createLimiter(max: number, windowMs: number, message: string) {
  const hits = new Map<string, { n: number; reset: number }>()

  const current = (key: string, now: number) => {
    const h = hits.get(key)
    return h && h.reset > now ? h : undefined
  }

  return {
    check(key: string) {
      const h = current(key, Date.now())
      if (h && h.n >= max) throw new HttpError(429, 'RATE_LIMIT', message)
    },
    add(key: string) {
      const now = Date.now()
      const h = current(key, now)
      if (h) h.n += 1
      else hits.set(key, { n: 1, reset: now + windowMs })
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k)
    },
    clear(key: string) {
      hits.delete(key)
    },
  }
}
