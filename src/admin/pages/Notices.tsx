import * as React from 'react'
import { Loader2, Megaphone, Trash2 } from 'lucide-react'
import type { Notice } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { Empty, Field, PageTitle, Section, Switch, btnCls, btnGhost, inputCls, useLoad, useToast } from '../ui'

const SUGGESTIONS = ['Estarei de folga na próxima semana. Agenda reaberta em breve.', 'Agenda de dezembro aberta! Peça seu orçamento.', 'Hoje não haverá atendimento.']

export default function Notices() {
  const toast = useToast()
  const { data: notices, setData, reload } = useLoad(() => api.get<Notice[]>('/admin/notices'))
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/admin/notices', { text, active: true })
      setText('')
      toast('Aviso publicado no site.')
      await reload()
    } catch (err) {
      toast(errorMessage(err), true)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (n: Notice, active: boolean) => {
    setData((l) => (l ? l.map((x) => (x.id === n.id ? { ...x, active } : x)) : l))
    try {
      await api.patch(`/admin/notices/${n.id}`, { active })
      toast(active ? 'Aviso visível no site.' : 'Aviso ocultado.')
    } catch (err) {
      toast(errorMessage(err), true)
      void reload()
    }
  }

  const remove = async (n: Notice) => {
    if (!window.confirm('Apagar este aviso?')) return
    try {
      await api.del(`/admin/notices/${n.id}`)
      await reload()
    } catch (err) {
      toast(errorMessage(err), true)
    }
  }

  return (
    <>
      <PageTitle title="Avisos" />
      <p className="mb-6 max-w-2xl text-black/65">Avisos ativos aparecem como uma faixa branca no topo do site, para todo mundo. O visitante pode dispensar.</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Section title="Novo aviso">
          <form onSubmit={add} className="space-y-4">
            <Field label="Texto" hint={`${text.length}/240`}>
              <textarea rows={4} maxLength={240} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} required minLength={3} />
            </Field>
            <div className="flex flex-wrap gap-2" aria-label="Sugestões">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setText(s)} className={btnGhost + ' !normal-case !tracking-normal text-left'}>
                  {s}
                </button>
              ))}
            </div>
            <button type="submit" disabled={busy || text.trim().length < 3} className={btnCls + ' w-full'}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Megaphone className="size-4" aria-hidden />} Publicar aviso
            </button>
          </form>
        </Section>

        <Section title="Avisos">
          {!notices ? null : notices.length === 0 ? (
            <Empty>Nenhum aviso criado.</Empty>
          ) : (
            <ul className="divide-y divide-black/10">
              {notices.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <Switch checked={n.active} onChange={(v) => void toggle(n, v)} label={`Aviso ${n.active ? 'visível' : 'oculto'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={n.active ? '' : 'text-black/45'}>{n.text}</p>
                    <p className="mt-1 text-xs text-black/45">
                      {n.active ? 'Visível no site' : 'Oculto'} · {new Date(n.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button type="button" onClick={() => remove(n)} aria-label="Apagar aviso" className="grid size-10 shrink-0 place-items-center border border-black/40 hover:bg-black hover:text-white">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}
