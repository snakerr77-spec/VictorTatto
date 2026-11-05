import fs from 'node:fs'
import path from 'node:path'
import express, { type Request, type Response } from 'express'
import { UPLOAD_DIR } from './db'
import { bad } from './http'
import { uid } from './util'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const rawImage = (limit: string) => express.raw({ type: TYPES, limit })

function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}

/** Salva a imagem enviada (corpo cru) e devolve a URL pública. Confere o tipo pelos bytes, não pelo cabeçalho. */
export function saveUpload(req: Request, res: Response) {
  const buf: unknown = req.body
  if (!Buffer.isBuffer(buf)) throw bad('Envie uma imagem JPG, PNG ou WebP.')
  const ext = sniff(buf)
  if (!ext) throw bad('Esse arquivo não parece ser uma imagem válida.')
  const name = `${uid()}.${ext}`
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf)
  res.status(201).json({ url: `/uploads/${name}` })
}

/** Apaga um arquivo de /uploads (ignora URLs de outros lugares, como /seed). */
export function removeUpload(url: string) {
  if (!url.startsWith('/uploads/')) return
  fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }, () => {})
}
