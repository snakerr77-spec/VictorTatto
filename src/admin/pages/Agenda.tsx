import * as React from 'react'
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2, Unlock, X } from 'lucide-react'
import type { Booking, ScheduleMonth, ScheduleUpdateResult, Settings, TimeWindow } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { WEEK_LABELS, addMonths, currentMonth, durationLabel, longDate, monthCells, monthLabel, todayStr, weekday } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Empty, PageTitle, Section, btnCls, btnGhost, inputCls, useLoad, useToast } from '../ui'

const windowsText = (w: TimeWindow[]) => w.map((x) => `${x.start}–${x.end}`).join(' · ')

export default function Agenda() {
  const toast = useToast()
  const [month, setMonth] = React.useState(currentMonth())
  const [selected, setSelected] = React.useState<string[]>([])
  const [custom, setCustom] = React.useState<TimeWindow[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const { data: settings } = useLoad(() => api.get<Settings>('/admin/settings'))
  const { data, reload } = useLoad(() => api.get<ScheduleMonth>(`/admin/schedule?month=${month}`), [month])

  const today = todayStr()
  const cells = monthCells(month)
  const template = settings?.openTemplate

  const bookingsOf = (d: string): Booking[] => (data?.bookings ?? []).filter((b) => b.date === d)

  const toggle = (d: string) => setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))

  const apply = async (dates: string[], windows: TimeWindow[], opts: { skipExisting?: boolean; ok: string }) => {
    if (!dates.length) return
    setBusy(true)
    try {
      const r = await api.put<ScheduleUpdateResult>('/admin/schedule', { dates, windows, mode: opts.skipExisting ? 'skip-existing' : 'replace' })
      if (r.updated) toast(`${opts.ok} (${r.updated} ${r.updated === 1 ? 'dia' : 'dias'}).`)
      if (r.skipped.length) {
        const real = r.skipped.filter((s) => s.reason !== 'Já estava aberto.')
        if (real.length) toast(real.slice(0, 3).map((s) => `${s.date.slice(8)}/${s.date.slice(5, 7)}: ${s.reason}`).join(' '), true)
      }
      setSelected([])
      setCustom(null)
      await reload()
    } catch (e) {
      toast(errorMessage(e), true)
    } finally {
      setBusy(false)
    }
  }

  const openDefault = () => {
    if (!template?.windows.length) return toast('Defina o horário padrão em Ajustes.', true)
    void apply(selected, template.windows, { ok: 'Abertos no horário padrão' })
  }

  const openMonth = () => {
    if (!template?.windows.length || !template.weekdays.length) return toast('Defina os dias e o horário padrão em Ajustes.', true)
    const dates = cells.filter((d): d is string => !!d && d >= today && template.weekdays.includes(weekday(d)))
    void apply(dates, template.windows, { skipExisting: true, ok: 'Mês aberto' })
  }

  const cancel = async (b: Booking) => {
    if (!window.confirm(`Cancelar o horário de ${b.clientName} (${b.start})?`)) return
    try {
      await api.post(`/admin/bookings/${b.id}/cancel`, { reopenToken: true })
      toast('Horário cancelado. O token voltou a ficar ativo.')
      await reload()
    } catch (e) {
      toast(errorMessage(e), true)
    }
  }

  const detailDays = selected.length === 1 ? selected : []

  return (
    <>
      <PageTitle title="Agenda">
        <button type="button" className={btnGhost} onClick={openMonth} disabled={busy || !template}>
          <Unlock className="size-4" aria-hidden /> Abrir mês no horário padrão
        </button>
      </PageTitle>
      <p className="mb-6 max-w-2xl text-black/65">
        Só os dias <b>abertos</b> aparecem para o cliente. Toque nos dias para selecionar e escolha abrir ou <b>bloquear</b>. Dias com cliente marcado só fecham depois de cancelar o horário.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Section>
          <div className="mb-4 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" disabled={month <= currentMonth()} onClick={() => { setMonth(addMonths(month, -1)); setSelected([]) }} className="grid size-11 place-items-center border border-black/40 hover:bg-black hover:text-white disabled:opacity-25">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <h2 className="font-display text-3xl tracking-wide">{monthLabel(month)}</h2>
            <button type="button" aria-label="Próximo mês" onClick={() => { setMonth(addMonths(month, 1)); setSelected([]) }} className="grid size-11 place-items-center border border-black/40 hover:bg-black hover:text-white">
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEK_LABELS.map((w, i) => (
              <span key={i} className="py-1.5 text-center text-xs tracking-widest text-black/45">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />
              const w = data?.days[d]
              const open = !!w?.length
              const n = bookingsOf(d).length
              const past = d < today
              const on = selected.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  disabled={past}
                  aria-pressed={on}
                  aria-label={`${longDate(d)}: ${open ? `aberto, ${n} marcados` : 'fechado'}`}
                  onClick={() => toggle(d)}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center border text-base transition-colors sm:aspect-[5/4]',
                    past && 'border-transparent text-black/25',
                    !past && !open && 'border-black/15 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_6px)] text-black/50',
                    !past && open && 'border-black bg-white',
                    on && '!bg-black !text-white',
                    d === today && !on && 'underline underline-offset-4',
                  )}
                >
                  {Number(d.slice(8))}
                  {!past && open && <span className={cn('mt-0.5 text-[9px] leading-none tracking-wider uppercase', on ? 'text-white/70' : 'text-black/50')}>{n ? `${n} cli.` : 'aberto'}</span>}
                  {!past && !open && <Lock className="absolute right-1 bottom-1 size-3 opacity-40" aria-hidden />}
                </button>
              )
            })}
          </div>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/55">
            <span><span className="mr-1.5 inline-block size-3 border border-black align-middle" />Aberto</span>
            <span><span className="mr-1.5 inline-block size-3 border border-black/15 bg-black/10 align-middle" />Fechado / bloqueado</span>
            <span><span className="mr-1.5 inline-block size-3 bg-black align-middle" />Selecionado</span>
          </p>
        </Section>

        <div className="space-y-6">
          <Section title={selected.length ? `${selected.length} ${selected.length === 1 ? 'dia selecionado' : 'dias selecionados'}` : 'Ações'}>
            {!selected.length ? (
              <Empty>Toque nos dias do calendário para abrir ou bloquear.</Empty>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={openDefault} className={btnCls}>
                    <Unlock className="size-4" aria-hidden /> Abrir
                  </button>
                  <button type="button" disabled={busy} onClick={() => apply(selected, [], { ok: 'Bloqueados' })} className={btnCls}>
                    <Lock className="size-4" aria-hidden /> Bloquear
                  </button>
                </div>
                {template && <p className="text-xs text-black/55">Horário padrão: {windowsText(template.windows) || 'não definido'}</p>}
                {!custom ? (
                  <button type="button" className={cn(btnGhost, 'w-full')} onClick={() => setCustom(template?.windows.length ? template.windows.map((w) => ({ ...w })) : [{ start: '10:00', end: '18:00' }])}>
                    Definir horário personalizado
                  </button>
                ) : (
                  <div className="space-y-2 border border-black/20 p-3">
                    {custom.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" aria-label="Início" value={w.start} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={inputCls} />
                        <span>–</span>
                        <input type="time" aria-label="Fim" value={w.end} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={inputCls} />
                        {custom.length > 1 && (
                          <button type="button" aria-label="Remover faixa" onClick={() => setCustom(custom.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center border border-black/40">
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {custom.length < 3 && (
                        <button type="button" className={btnGhost} onClick={() => setCustom([...custom, { start: '14:00', end: '18:00' }])}>
                          <Plus className="size-4" aria-hidden /> Faixa
                        </button>
                      )}
                      <button type="button" disabled={busy} className={btnCls} onClick={() => apply(selected, custom, { ok: 'Horário aplicado' })}>
                        Aplicar
                      </button>
                      <button type="button" className={btnGhost} onClick={() => setCustom(null)} aria-label="Fechar">
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setSelected([])} className="text-xs tracking-[0.2em] underline underline-offset-4 uppercase">
                  Limpar seleção
                </button>
              </div>
            )}
          </Section>

          {detailDays.map((d) => {
            const list = bookingsOf(d)
            const w = data?.days[d]
            return (
              <Section key={d} title={longDate(d)}>
                <p className="mb-3 text-sm text-black/60">{w?.length ? `Aberto: ${windowsText(w)}` : 'Fechado / bloqueado'}</p>
                {list.length ? (
                  <ul className="divide-y divide-black/10">
                    {list.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <span className="w-14 font-display text-2xl tracking-wide">{b.start}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b.clientName}</p>
                          <p className="text-xs text-black/55">
                            {durationLabel(b.durationMin)} · {b.clientPhone}
                          </p>
                        </div>
                        <button type="button" onClick={() => cancel(b)} aria-label={`Cancelar ${b.clientName}`} className="grid size-10 place-items-center border border-black/40 hover:bg-black hover:text-white">
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>Ninguém marcado neste dia.</Empty>
                )}
              </Section>
            )
          })}
        </div>
      </div>
    </>
  )
}
