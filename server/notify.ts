import type { AdminNotification } from '../shared/types'
import { db, pushLimited, save } from './db'
import { broadcast } from './hub'
import { nowIso, uid } from './util'

type NewNotification = Pick<AdminNotification, 'kind' | 'title' | 'body' | 'href'>

/** Registra no painel, avisa quem está com o painel aberto (SSE) e manda para ntfy/Telegram se configurados. */
export function pushNotification(n: NewNotification): AdminNotification {
  const notification: AdminNotification = { id: uid(), createdAt: nowIso(), read: false, ...n }
  pushLimited(db.notifications, notification, 150)
  save()
  broadcast('notification', notification)
  void sendExternal(notification.title, notification.body)
  return notification
}

const timeout = () => AbortSignal.timeout(8000)

export async function sendExternal(title: string, body: string): Promise<{ ok: boolean; channels: string[]; error?: string }> {
  const { ntfyTopic, telegramBotToken, telegramChatId } = db.settings.notify
  const channels: string[] = []
  try {
    if (ntfyTopic.trim()) {
      const res = await fetch('https://ntfy.sh/', {
        method: 'POST',
        signal: timeout(),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: ntfyTopic.trim(), title, message: body || title, priority: 4, tags: ['needle'] }),
      })
      if (!res.ok) throw new Error(`ntfy respondeu ${res.status}`)
      channels.push('ntfy')
    }
    if (telegramBotToken.trim() && telegramChatId.trim()) {
      const res = await fetch(`https://api.telegram.org/bot${telegramBotToken.trim()}/sendMessage`, {
        method: 'POST',
        signal: timeout(),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId.trim(), text: `${title}\n${body}`.trim() }),
      })
      if (!res.ok) throw new Error(`Telegram respondeu ${res.status}`)
      channels.push('telegram')
    }
    return { ok: true, channels }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.warn('[notify] falha ao enviar aviso externo:', error)
    return { ok: false, channels, error }
  }
}
