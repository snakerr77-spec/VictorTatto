import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { db } from './db'
import { HttpError } from './http'

const COOKIE = 'ft_admin'
const MAX_AGE_S = 60 * 60 * 24 * 14

const sign = (payload: string) => createHmac('sha256', db.meta.sessionSecret).update(payload).digest('base64url')

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

export function isAdmin(req: Request): boolean {
  const value = readCookie(req, COOKIE)
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expected = Buffer.from(sign(`admin.${exp}`))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function startSession(req: Request, res: Response) {
  const exp = String(Date.now() + MAX_AGE_S * 1000)
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${exp}.${sign(`admin.${exp}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`,
  )
}

export function endSession(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isAdmin(req)) throw new HttpError(401, 'UNAUTHORIZED', 'Faça login para continuar.')
  next()
}
