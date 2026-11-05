import * as React from 'react'
import { Copy, Loader2, MessageCircle, Plus, RotateCcw, Trash2, Ban } from 'lucide-react'
import type { AccessToken } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { durationLabel, waUrl } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Empty, Field, PageTitle, Section, btnCls, btnGhost, inputCls, useLoad, useToast } from '../ui'

const DURATIONS = [60, 120, 180, 240, 300, 360, 480]
const VALIDITY: [number, string][] = [
  [24, '24 horas'],
  [48, '48 horas'],
  [72, '3 dias'],
  [168, '7 dias'],
  [336, '14 dias'],
]

const STATUS: Record<AccessToken['status'], string> = {
  active: 'Ativo',
  used: 'Usado',
  revoked: 'Cancelado',
  expired: 'Expirado',
}

const brPhone = (p: string) => (p.startsWith('55') && p.length >= 12 ? p : `55${p}`)
const link = (code: string) => `${window.location.origin}/agendamento?token=${code}`
const message = (t: AccessToken) =>
  `Olá${t.clientName ? `, ${t.clientName.split(' ')[0]}` : ''}! Seu orçamento foi aprovado ✦\n\nSeu token de agendamento: *${t.code}*\nEscolha o dia e o horário por aqui: ${link(t.code)}\n\nO token vale até ${new Date(t.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`

export default function Tokens() {
  const toast = useToast()
  const { data: tokens, reload } = useLoad(() => api.get<AccessToken[]>('/admin/tokens'))
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [duration, setDuration] = React.useState(180)
  const [validity, setValidity] = React.useState(72)
  const [note, setNote] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [fresh, setFresh] = React.useState<AccessToken | null>(null)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const t = await api.post<AccessToken>('/admin/tokens', {
        clientName: name,
        clientPhone: phone,
        durationMin: duration,
        validityHours: validity,
        note,
        dateFrom: from || null,
        dateTo: to || null,
      })
      setFresh(t)
      setName('')
      setPhone('')
      setNote('')
      setFrom('')
      setTo('')
      toast('Token gerado.')
      void reload()
    } catch (err) {
      toast(errorMessage(err), true)
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast(ok)
      void reload()
    } catch (err) {
      toast(errorMessage(err), true)
    }
  }

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(ok)
    } catch {
      toast('Não consegui copiar. Selecione e copie manualmente.', true)
    }
  }

  const Actions = ({ t }: { t: AccessToken }) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btnGhost} onClick={() => copy(message(t), 'Mensagem copiada.')}>
        <Copy className="size-4" aria-hidden /> Copiar mensagem
      </button>
      {t.clientPhone && (
        <a className={btnCls} href={waUrl(brPhone(t.clientPhone), message(t))} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" aria-hidden /> Enviar no WhatsApp
        </a>
      )}
    </div>
  )

  return (
    <>
      <PageTitle title="Tokens" />
      <p className="mb-6 max-w-2xl text-black/65">
        Depois de combinar o orçamento, gere um token e envie ao cliente. Com ele, o cliente libera a agenda no site e escolhe o dia e o horário.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Section title="Novo token">
          <form onSubmit={create} className="space-y-4">
            <Field label="Nome do cliente">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="off" />
            </Field>
            <Field label="WhatsApp do cliente" hint="Com DDD. Usado para o botão de envio.">
              <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="(15) 99999-9999" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tempo de sessão">
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {durationLabel(d)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Token vale por">
                <select value={validity} onChange={(e) => setValidity(Number(e.target.value))} className={inputCls}>
                  {VALIDITY.map(([h, l]) => (
                    <option key={h} value={h}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Datas a partir de" hint="Opcional">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Datas até" hint="Opcional">
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Observação" hint="Ex.: fechamento de braço, 2ª sessão. Só você e o cliente veem.">
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </Field>
            <button type="submit" disabled={busy} className={cn(btnCls, 'w-full')}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} Gerar token
            </button>
          </form>

          {fresh && (
            <div className="mt-6 border-2 border-black p-4" role="status">
              <p className="text-xs tracking-[0.22em] uppercase">Token gerado</p>
              <p className="mt-2 break-all font-mono text-3xl tracking-widest">{fresh.code}</p>
              <p className="mt-1 text-xs text-black/55">
                Sessão de {durationLabel(fresh.durationMin)} · vale até {new Date(fresh.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <div className="mt-4">
                <Actions t={fresh} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Tokens gerados">
          {!tokens ? null : tokens.length === 0 ? (
            <Empty>Nenhum token ainda.</Empty>
          ) : (
            <ul className="divide-y divide-black/10">
              {tokens.map((t) => (
                <li key={t.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-lg tracking-widest">{t.code}</span>
                    <span className={cn('px-2 py-0.5 text-[10px] tracking-[0.2em] uppercase', t.status === 'active' ? 'bg-black text-white' : 'border border-black/40 text-black/60')}>{STATUS[t.status]}</span>
                    <span className="text-sm text-black/55">{durationLabel(t.durationMin)}</span>
                  </div>
                  <p className="mt-1 text-sm text-black/65">
                    {t.clientName || 'Sem nome'}
                    {t.note ? ` · ${t.note}` : ''}
                    {t.status === 'active' ? ` · vale até ${new Date(t.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.status === 'active' && (
                      <>
                        <button type="button" className={btnGhost} onClick={() => copy(message(t), 'Mensagem copiada.')}>
                          <Copy className="size-4" aria-hidden /> Copiar
                        </button>
                        {t.clientPhone && (
                          <a className={btnGhost} href={waUrl(brPhone(t.clientPhone), message(t))} target="_blank" rel="noreferrer">
                            <MessageCircle className="size-4" aria-hidden /> WhatsApp
                          </a>
                        )}
                        <button type="button" className={btnGhost} onClick={() => act(() => api.post(`/admin/tokens/${t.id}/revoke`), 'Token cancelado.')}>
                          <Ban className="size-4" aria-hidden /> Cancelar
                        </button>
                      </>
                    )}
                    {(t.status === 'expired' || t.status === 'revoked') && (
                      <button type="button" className={btnGhost} onClick={() => act(() => api.post(`/admin/tokens/${t.id}/extend`, { hours: 72 }), 'Token reativado por 3 dias.')}>
                        <RotateCcw className="size-4" aria-hidden /> Reativar
                      </button>
                    )}
                    {t.status !== 'used' && (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => window.confirm('Apagar este token?') && act(() => api.del(`/admin/tokens/${t.id}`), 'Token apagado.')}
                        aria-label="Apagar token"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}
