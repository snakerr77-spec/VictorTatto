import type { Request, Response } from 'express'

/** Canal SSE para o painel receber avisos em tempo real. */
const clients = new Set<Response>()

export function connect(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 3000\n\n')
  res.write(`event: hello\ndata: {}\n\n`)
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  req.on('close', () => {
    clearInterval(ping)
    clients.delete(res)
  })
}

export function broadcast(event: string, data: unknown) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) res.write(frame)
}

export const listeners = () => clients.size
