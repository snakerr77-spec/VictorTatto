import { randomBytes, randomUUID } from 'node:crypto'

export const uid = (): string => randomUUID()

// Sem 0/O/1/I para não confundir quando o cliente digita o token.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 símbolos → sem viés no módulo de um byte

export const randomCode = (len: number): string =>
  Array.from(randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join('')

export const newTokenCode = (): string => `VICT-${randomCode(4)}-${randomCode(4)}`

/** Aceita "victor-abcd-2345", "ABCD2345", "VICT ABCD 2345"… e devolve "VICT-ABCD-2345" (ou null). */
export const normalizeCode = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  let raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.startsWith('VICT') && raw.length === 12) raw = raw.slice(4)
  if (!/^[A-Z2-9]{8}$/.test(raw)) return null
  return `VICT-${raw.slice(0, 4)}-${raw.slice(4)}`
}

export const nowIso = (): string => new Date().toISOString()

export const slugify = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'categoria'
