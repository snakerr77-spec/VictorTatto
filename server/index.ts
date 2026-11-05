import './env'
import fs from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { UPLOAD_DIR } from './db'
import { HttpError } from './http'
import { adminRouter } from './routes/admin'
import { publicRouter } from './routes/public'
import { startScheduler } from './scheduler'

const PORT = Number(process.env.PORT ?? 3011)
const DIST = path.resolve('dist')
const INDEX = path.join(DIST, 'index.html')

const app = express()
app.disable('x-powered-by')
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false, fallthrough: false }))

// JSON só nas rotas de API (uploads usam corpo cru, tratado na própria rota).
app.use('/api', express.json({ limit: '200kb' }))
app.use('/api/admin', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use('/api', publicRouter)
app.use('/api/admin', adminRouter)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' })
})

// Em produção o mesmo servidor entrega o site compilado (npm run build).
if (fs.existsSync(INDEX)) {
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      },
    }),
  )
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next()
    res.sendFile(INDEX)
  })
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message })
    return
  }
  const e = err as { type?: string; status?: number }
  if (e.type === 'entity.too.large') {
    res.status(413).json({ error: 'TOO_LARGE', message: 'Arquivo grande demais.' })
    return
  }
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID', message: 'Requisição inválida.' })
    return
  }
  if (e.status === 404) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Arquivo não encontrado.' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'SERVER', message: 'Algo deu errado. Tente novamente em instantes.' })
})

app.listen(PORT, () => {
  console.log(`\n  Victor Tattoo · servidor em http://localhost:${PORT}`)
  console.log(fs.existsSync(INDEX) ? '  Site compilado sendo servido daqui.\n' : '  (modo dev) site em http://localhost:5173\n')
  startScheduler()
})
