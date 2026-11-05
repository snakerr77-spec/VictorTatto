import { isDateStr, isMonthStr, isTimeStr } from '../shared/time'

export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const bad = (message: string, code = 'INVALID'): HttpError => new HttpError(400, code, message)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const body = (v: unknown): Record<string, unknown> => (isObj(v) ? v : {})

interface TextOpts {
  min?: number
  max?: number
}

/** Texto obrigatório (aparado). */
export function text(v: unknown, label: string, { min = 1, max = 500 }: TextOpts = {}): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min) throw bad(min <= 1 ? `Preencha: ${label}.` : `${label}: mínimo de ${min} caracteres.`)
  if (s.length > max) throw bad(`${label}: máximo de ${max} caracteres.`)
  return s
}

/** Texto opcional — vazio vira "". */
export function optText(v: unknown, label: string, max = 500): string {
  if (v === undefined || v === null || v === '') return ''
  return text(v, label, { min: 0, max })
}

export function int(v: unknown, label: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw bad(`${label}: informe um número entre ${min} e ${max}.`)
  }
  return n
}

export const flag = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback)

export function date(v: unknown, label: string): string {
  if (!isDateStr(v)) throw bad(`${label}: data inválida.`)
  return v
}

export const optDate = (v: unknown, label: string): string | null => (v === null || v === undefined || v === '' ? null : date(v, label))

export function time(v: unknown, label: string): string {
  if (!isTimeStr(v)) throw bad(`${label}: horário inválido.`)
  return v
}

export function month(v: unknown, label = 'Mês'): string {
  if (!isMonthStr(v)) throw bad(`${label}: formato esperado AAAA-MM.`)
  return v
}

/** WhatsApp/telefone → só dígitos (10 a 13). */
export function phone(v: unknown, label = 'WhatsApp'): string {
  const digits = (typeof v === 'string' ? v : '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) throw bad(`${label}: informe DDD + número.`)
  return digits
}

export function optEmail(v: unknown): string {
  const s = optText(v, 'E-mail', 120)
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('E-mail inválido.')
  return s
}

const IMG_URL = /^(\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)|\/(seed|works)\/[\w.-]+\.(jpg|png|webp))$/

export function imageUrl(v: unknown, label: string, allowEmpty = false): string {
  if ((v === '' || v === undefined || v === null) && allowEmpty) return ''
  if (typeof v !== 'string' || !IMG_URL.test(v)) throw bad(`${label}: imagem inválida.`)
  return v
}

export function stringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').slice(0, max)
}
