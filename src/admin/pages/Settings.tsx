import * as React from 'react'
import { Loader2 } from 'lucide-react'
import type { Settings as SettingsT, TimeWindow } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Field, PageTitle, Section, btnCls, inputCls, useLoad, useToast } from '../ui'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Settings() {
  const toast = useToast()
  const { data: loaded } = useLoad(() => api.get<SettingsT>('/admin/settings'))
  const [form, setForm] = React.useState<SettingsT | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')

  React.useEffect(() => {
    if (loaded) setForm(loaded)
  }, [loaded])

  if (!form) return <PageTitle title="Ajustes" />
  const set = <K extends keyof SettingsT>(k: K, v: SettingsT[K]) => setForm({ ...form, [k]: v })
  const win: TimeWindow[] = form.openTemplate.windows
  const setWin = (windows: TimeWindow[]) => set('openTemplate', { ...form.openTemplate, windows })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/admin/settings', {
        whatsapp: form.whatsapp,
        instagram: form.instagram,
        hoursText: form.hoursText,
        about: form.about,
        minLeadHours: form.minLeadHours,
        cancelWindowHours: form.cancelWindowHours,
        bufferMin: form.bufferMin,
        slotStepMin: form.slotStepMin,
        openTemplate: form.openTemplate,
      })
      toast('Ajustes salvos.')
    } catch (err) {
      toast(errorMessage(err), true)
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/admin/settings/password', { current, next })
      setCurrent('')
      setNext('')
      toast('Senha alterada.')
    } catch (err) {
      toast(errorMessage(err), true)
    }
  }

  return (
    <>
      <PageTitle title="Ajustes" />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="space-y-6 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          <Section title="Contato">
            <div className="space-y-4">
              <Field label="WhatsApp do Victor" hint="DDD + número. É para onde vão os pedidos de orçamento.">
                <input type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Instagram">
                <input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Texto “Sobre” do site" hint="Separe parágrafos com uma linha em branco.">
                <textarea rows={7} value={form.about} onChange={(e) => set('about', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Agenda">
            <div className="space-y-4">
              <Field label="Dias da semana abertos (padrão)">
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = form.openTemplate.weekdays.includes(i)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set('openTemplate', { ...form.openTemplate, weekdays: on ? form.openTemplate.weekdays.filter((x) => x !== i) : [...form.openTemplate.weekdays, i].sort() })}
                        className={cn('min-w-12 px-3 py-2.5 text-[12px] tracking-wider uppercase', on ? 'bg-black text-white' : 'border border-black/40')}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <div>
                <span className="mb-1.5 block text-xs tracking-[0.22em] uppercase">Horário de atendimento (padrão)</span>
                <div className="space-y-2">
                  {win.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" aria-label="Início" value={w.start} onChange={(e) => setWin(win.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={inputCls} />
                      <span>–</span>
                      <input type="time" aria-label="Fim" value={w.end} onChange={(e) => setWin(win.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={inputCls} />
                      {win.length > 1 && (
                        <button type="button" onClick={() => setWin(win.filter((_, j) => j !== i))} className="h-12 shrink-0 border border-black/40 px-3 text-xs uppercase">
                          Tirar
                        </button>
                      )}
                    </div>
                  ))}
                  {win.length < 3 && (
                    <button type="button" onClick={() => setWin([...win, { start: '14:00', end: '18:00' }])} className="text-xs tracking-[0.2em] underline underline-offset-4 uppercase">
                      + adicionar faixa (ex.: depois do almoço)
                    </button>
                  )}
                </div>
              </div>
              <Field label="Texto do horário no site">
                <input value={form.hoursText} onChange={(e) => set('hoursText', e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pausa entre sessões (min)">
                  <input type="number" min={0} max={180} value={form.bufferMin} onChange={(e) => set('bufferMin', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Início a cada (min)">
                  <input type="number" min={15} max={240} step={15} value={form.slotStepMin} onChange={(e) => set('slotStepMin', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Antecedência mínima (h)">
                  <input type="number" min={0} max={720} value={form.minLeadHours} onChange={(e) => set('minLeadHours', Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Cliente pode remarcar até (h antes)">
                  <input type="number" min={0} max={720} value={form.cancelWindowHours} onChange={(e) => set('cancelWindowHours', Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
            </div>
          </Section>
          <div className="lg:col-span-2">
            <button type="submit" disabled={busy} className={btnCls}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar ajustes
            </button>
          </div>
        </form>

        <Section title="Trocar senha do painel">
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Senha atual">
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
              <input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            </Field>
            <button type="submit" disabled={!current || next.length < 8} className={btnCls}>
              Alterar senha
            </button>
          </form>
        </Section>
      </div>
    </>
  )
}
