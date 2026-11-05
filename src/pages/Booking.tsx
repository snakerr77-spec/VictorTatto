import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, ChevronLeft, ChevronRight, KeyRound, Loader2, MessageCircle } from 'lucide-react'
import type { AvailabilityResponse, PublicBooking, PublicToken, ValidateResponse } from '../../shared/types'
import { api, ApiError, errorMessage } from '@/lib/api'
import { WEEK_LABELS, addMonths, currentMonth, durationLabel, longDate, monthCells, monthLabel, todayStr, waUrl } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useSite } from '@/hooks/site'
import { BASE, STATIC } from '@/lib/mode'
import { Header } from '@/sections/Header'

const field =
  'w-full border border-black/30 bg-white px-4 py-3 text-base text-black outline-none transition-colors placeholder:text-black/35 focus:border-black'
const primary =
  'inline-flex items-center justify-center gap-2 bg-black px-7 py-4 text-[13px] font-medium tracking-[0.2em] text-white uppercase transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40'
const ghost =
  'inline-flex items-center justify-center gap-2 border border-black px-6 py-3.5 text-[13px] tracking-[0.2em] uppercase transition-colors hover:bg-black hover:text-white disabled:opacity-40'

type Stage =
  | { name: 'code' }
  | { name: 'pick'; token: PublicToken }
  | { name: 'booked'; booking: PublicBooking; canCancel: boolean; fresh: boolean }

export default function Booking() {
  const { site } = useSite()
  const [params] = useSearchParams()
  const [code, setCode] = React.useState(params.get('token') ?? '')
  const [stage, setStage] = React.useState<Stage>({ name: 'code' })
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const whatsapp = site?.settings.whatsapp ?? ''

  const validate = React.useCallback(async (value: string) => {
    if (!value.trim()) return
    setBusy(true)
    setError('')
    try {
      const r = await api.post<ValidateResponse>('/booking/validate', { code: value })
      setStage(r.state === 'active' ? { name: 'pick', token: r.token } : { name: 'booked', booking: r.booking, canCancel: r.canCancel, fresh: false })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  // Link enviado pelo Victor já traz o token: valida sozinho.
  React.useEffect(() => {
    const t = params.get('token')
    if (t) void validate(t)
  }, [params, validate])

  return (
    <div className="min-h-svh bg-paper text-black">
      <Header />
      <main className="mx-auto max-w-5xl px-5 pt-32 pb-24 md:px-8 md:pt-40">
        <p className="text-[12px] tracking-[0.35em] text-black/55 uppercase">Agendamento</p>
        <h1 className="mt-2 font-display text-6xl leading-[0.9] tracking-wide md:text-8xl">Escolha seu horário</h1>

        {stage.name === 'code' && (
          <form
            className="mt-10 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              void validate(code)
            }}
          >
            <p className="mb-5 text-lg leading-relaxed text-black/70">
              Depois que o orçamento é aprovado, o Victor envia um código pessoal. Digite abaixo para liberar a agenda.
            </p>
            <label htmlFor="token" className="mb-2 block text-xs tracking-[0.25em] uppercase">
              Seu token
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="token"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VICT-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={cn(field, 'font-mono tracking-widest sm:flex-1')}
              />
              <button type="submit" disabled={busy || !code.trim()} className={primary}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />} Liberar
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-4 border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
                {error}
              </p>
            )}
            <p className="mt-8 text-sm text-black/55">
              Ainda não tem token?{' '}
              {whatsapp ? (
                <a className="underline underline-offset-4" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá, Victor! Quero pedir um orçamento.')}`} target="_blank" rel="noreferrer">
                  Peça um orçamento pelo WhatsApp
                </a>
              ) : (
                'Peça um orçamento pelo WhatsApp.'
              )}
            </p>
          </form>
        )}

        {stage.name === 'pick' && (
          <Picker
            code={code}
            token={stage.token}
            whatsapp={whatsapp}
            onDone={(booking) => setStage({ name: 'booked', booking, canCancel: true, fresh: true })}
            onBack={() => setStage({ name: 'code' })}
          />
        )}

        {stage.name === 'booked' && (
          <Booked
            code={code}
            booking={stage.booking}
            canCancel={stage.canCancel}
            fresh={stage.fresh}
            whatsapp={whatsapp}
            onCanceled={() => void validate(code)}
          />
        )}
      </main>
    </div>
  )
}

function Picker({
  code,
  token,
  whatsapp,
  onDone,
  onBack,
}: {
  code: string
  token: PublicToken
  whatsapp: string
  onDone: (b: PublicBooking) => void
  onBack: () => void
}) {
  const [month, setMonth] = React.useState(currentMonth())
  const [days, setDays] = React.useState<Record<string, string[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [date, setDate] = React.useState<string | null>(null)
  const [start, setStart] = React.useState<string | null>(null)
  const [name, setName] = React.useState(token.clientName)
  const [phone, setPhone] = React.useState(token.clientPhone)
  const [email, setEmail] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [waHref, setWaHref] = React.useState('')
  const firstLoad = React.useRef(true)

  React.useEffect(() => setWaHref(''), [date, start])

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .post<AvailabilityResponse>('/booking/availability', { code, month })
      .then((r) => {
        if (!alive) return
        setDays(r.days)
        setLoading(false)
        // primeira abertura: pula para o primeiro mês que tenha vaga (até 3 meses à frente)
        if (firstLoad.current && !Object.keys(r.days).length && month < addMonths(currentMonth(), 3)) setMonth(addMonths(month, 1))
        else firstLoad.current = false
      })
      .catch((e) => {
        if (!alive) return
        setError(errorMessage(e))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [code, month])

  const cells = monthCells(month)
  const today = todayStr()
  const noneThisMonth = !loading && !Object.keys(days).length
  const times = date ? (days[date] ?? []) : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !start) return
    if (STATIC) {
      // GitHub Pages não tem servidor: o pedido vai por WhatsApp e o Victor confirma pelo painel (link abaixo).
      const confirmUrl = `${window.location.origin}${BASE}admin/confirmar?${new URLSearchParams({ c: code, d: date, s: start, n: name, p: phone, e: email, o: notes })}`
      setWaHref(
        waUrl(
          whatsapp,
          `Olá, Victor! Sou ${name}.\nQuero agendar ${longDate(date)} às ${start} (token ${code}).\nMeu WhatsApp: ${phone}${notes ? `\nObs.: ${notes}` : ''}\n\nPara confirmar (Victor): ${confirmUrl}`,
        ),
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await api.post<{ booking: PublicBooking }>('/booking/confirm', { code, date, start, name, phone, email, notes })
      onDone(r.booking)
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        setStart(null)
        api.post<AvailabilityResponse>('/booking/availability', { code, month }).then((r) => setDays(r.days)).catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-black/15 py-4 text-sm">
        <span>
          Olá{token.clientName ? `, ${token.clientName.split(' ')[0]}` : ''}! Token liberado.
        </span>
        <span className="text-black/55">Sessão de {durationLabel(token.durationMin)}</span>
        {token.note && <span className="text-black/55">{token.note}</span>}
        <button type="button" onClick={onBack} className="ml-auto underline underline-offset-4">
          Trocar token
        </button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <section aria-label="Escolha o dia">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={month <= currentMonth()}
              aria-label="Mês anterior"
              className="grid size-11 place-items-center border border-black/40 transition-colors hover:bg-black hover:text-white disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-black"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <h2 className="font-display text-3xl tracking-wide">{monthLabel(month)}</h2>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Próximo mês"
              className="grid size-11 place-items-center border border-black/40 transition-colors hover:bg-black hover:text-white"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_LABELS.map((w, i) => (
              <span key={i} className="py-2 text-xs tracking-widest text-black/45">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />
              const free = !!days[d]?.length
              const on = d === date
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!free}
                  aria-pressed={on}
                  aria-label={`${longDate(d)}${free ? '' : ' — indisponível'}`}
                  onClick={() => {
                    setDate(d)
                    setStart(null)
                  }}
                  className={cn(
                    'aspect-square text-base transition-colors',
                    on ? 'bg-black text-white' : free ? 'border border-black/40 hover:bg-black hover:text-white' : 'text-black/25',
                    d === today && !on && 'underline underline-offset-4',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              )
            })}
          </div>
          <div className="mt-3 min-h-6 text-sm text-black/55" aria-live="polite">
            {loading ? 'Carregando horários…' : noneThisMonth ? 'Sem datas livres neste mês. Veja o próximo.' : 'Dias com borda têm horário livre.'}
          </div>
        </section>

        <section aria-label="Horário e dados">
          {!date ? (
            <p className="border border-dashed border-black/30 p-8 text-black/55">Escolha um dia no calendário para ver os horários.</p>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div>
                <h2 className="font-display text-3xl tracking-wide">{longDate(date)}</h2>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Horários livres">
                  {times.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={t === start}
                      onClick={() => setStart(t)}
                      className={cn('min-w-20 px-4 py-3 text-base transition-colors', t === start ? 'bg-black text-white' : 'border border-black/40 hover:bg-black hover:text-white')}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {start && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="n" className="mb-1.5 block text-xs tracking-[0.25em] uppercase">
                      Nome completo
                    </label>
                    <input id="n" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="p" className="mb-1.5 block text-xs tracking-[0.25em] uppercase">
                        WhatsApp
                      </label>
                      <input id="p" required type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(15) 99999-9999" className={field} />
                    </div>
                    <div>
                      <label htmlFor="e" className="mb-1.5 block text-xs tracking-[0.25em] uppercase">
                        E-mail <span className="text-black/45 normal-case tracking-normal">(opcional)</span>
                      </label>
                      <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="o" className="mb-1.5 block text-xs tracking-[0.25em] uppercase">
                      Observações <span className="text-black/45 normal-case tracking-normal">(opcional)</span>
                    </label>
                    <textarea id="o" rows={3} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
                  </div>
                  {error && (
                    <p role="alert" className="border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
                      {error}
                    </p>
                  )}
                  {waHref ? (
                    <div className="space-y-3 border border-black p-5" role="status">
                      <p className="text-[15px]">Falta só um passo: envie o pedido ao Victor pelo WhatsApp. Ele confirma o horário e te responde por lá.</p>
                      <a href={waHref} target="_blank" rel="noreferrer" className={cn(primary, 'w-full sm:w-auto')}>
                        <MessageCircle className="size-4" aria-hidden /> Enviar pedido no WhatsApp
                      </a>
                      <p className="text-xs text-black/55">O horário só fica reservado depois que o Victor confirmar.</p>
                    </div>
                  ) : (
                    <button type="submit" disabled={busy} className={cn(primary, 'w-full sm:w-auto')}>
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />}{' '}
                      {STATIC ? 'Pedir' : 'Confirmar'} {date.slice(8)}/{date.slice(5, 7)} às {start}
                    </button>
                  )}
                </div>
              )}
              {!start && error && (
                <p role="alert" className="border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
                  {error}
                </p>
              )}
            </form>
          )}
          {!date && error && (
            <p role="alert" className="mt-4 border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
              {error}
            </p>
          )}
          {whatsapp && (
            <p className="mt-8 text-sm text-black/55">
              Nenhum dia serve?{' '}
              <a className="underline underline-offset-4" href={waUrl(whatsapp, 'Olá, Victor! Nenhuma data do site serviu pra mim. Podemos combinar outra?')} target="_blank" rel="noreferrer">
                Fale com o Victor
              </a>
              .
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function Booked({
  code,
  booking,
  canCancel,
  fresh,
  whatsapp,
  onCanceled,
}: {
  code: string
  booking: PublicBooking
  canCancel: boolean
  fresh: boolean
  whatsapp: string
  onCanceled: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const cancel = async () => {
    if (!window.confirm('Cancelar este horário? Você poderá escolher outro com o mesmo token.')) return
    setBusy(true)
    setError('')
    try {
      await api.post('/booking/cancel', { code })
      onCanceled()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 max-w-2xl">
      <div className="border border-black p-6 sm:p-9">
        <p className="text-xs tracking-[0.3em] uppercase">{fresh ? 'Horário confirmado' : 'Você já tem um horário'}</p>
        <p className="mt-4 font-display text-5xl leading-none tracking-wide sm:text-6xl">{longDate(booking.date)}</p>
        <p className="mt-2 font-display text-4xl tracking-wide">
          {booking.start} <span className="text-black/45">— {booking.end}</span>
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-black/15 pt-5 text-sm">
          <div>
            <dt className="text-black/50">Nome</dt>
            <dd className="mt-0.5 text-base">{booking.clientName}</dd>
          </div>
          <div>
            <dt className="text-black/50">Protocolo</dt>
            <dd className="mt-0.5 font-mono text-base">{booking.code}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {whatsapp && (
          <a
            className={primary}
            target="_blank"
            rel="noreferrer"
            href={waUrl(whatsapp, `Olá, Victor! Aqui é ${booking.clientName}. Meu horário: ${longDate(booking.date)} às ${booking.start} (protocolo ${booking.code}).`)}
          >
            <MessageCircle className="size-4" aria-hidden /> Avisar o Victor
          </a>
        )}
        {canCancel && (
          <button type="button" onClick={cancel} disabled={busy} className={ghost}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Cancelar / remarcar
          </button>
        )}
        <Link to="/" className={ghost}>
          Voltar ao site
        </Link>
      </div>
      {!canCancel && <p className="mt-4 text-sm text-black/55">Para remarcar com pouca antecedência, fale com o Victor pelo WhatsApp.</p>}
      {error && (
        <p role="alert" className="mt-4 border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
          {error}
        </p>
      )}
    </div>
  )
}
