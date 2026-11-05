import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, Loader2, MessageCircle } from 'lucide-react'
import type { Booking } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { durationLabel, longDate, waUrl } from '@/lib/dates'
import { Empty, PageTitle, Section, btnCls, btnGhost } from '../ui'

/** Abre pelo link que o cliente manda no pedido de WhatsApp: o Victor confere e confirma com um toque. */
export default function ConfirmRequest() {
  const [p] = useSearchParams()
  const req = {
    code: p.get('c') ?? '',
    date: p.get('d') ?? '',
    start: p.get('s') ?? '',
    name: p.get('n') ?? '',
    phone: p.get('p') ?? '',
    email: p.get('e') ?? '',
    notes: p.get('o') ?? '',
  }
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [booking, setBooking] = React.useState<Booking | null>(null)

  if (!req.code || !req.date || !req.start) {
    return (
      <>
        <PageTitle title="Confirmar pedido" />
        <Empty>Este link está incompleto. Peça ao cliente para enviar o pedido de novo.</Empty>
      </>
    )
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await api.post<{ booking: Booking }>('/admin/bookings/confirm-request', req)
      setBooking(r.booking)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const phone = booking?.clientPhone || req.phone.replace(/\D/g, '')

  return (
    <>
      <PageTitle title="Confirmar pedido" />
      <Section className="max-w-xl">
        <p className="text-xs tracking-[0.22em] uppercase">{booking ? 'Horário confirmado' : 'Pedido de horário'}</p>
        <p className="mt-3 font-display text-4xl leading-none tracking-wide sm:text-5xl">{longDate(req.date)}</p>
        <p className="mt-1 font-display text-3xl tracking-wide">
          {req.start}
          {booking && <span className="text-black/45"> — {booking.end}</span>}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-black/15 pt-4 text-sm">
          <div>
            <dt className="text-black/50">Cliente</dt>
            <dd className="mt-0.5 text-base">{req.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-black/50">WhatsApp</dt>
            <dd className="mt-0.5 text-base">{req.phone || '—'}</dd>
          </div>
          {booking && (
            <div>
              <dt className="text-black/50">Duração</dt>
              <dd className="mt-0.5 text-base">{durationLabel(booking.durationMin)}</dd>
            </div>
          )}
          {req.notes && (
            <div className="col-span-2">
              <dt className="text-black/50">Observações</dt>
              <dd className="mt-0.5 text-base">{req.notes}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p role="alert" className="mt-5 border-l-2 border-black bg-black/5 px-4 py-3 text-[15px]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!booking ? (
            <button type="button" onClick={confirm} disabled={busy} className={btnCls}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />} Confirmar horário
            </button>
          ) : (
            <>
              {phone && (
                <a
                  className={btnCls}
                  target="_blank"
                  rel="noreferrer"
                  href={waUrl(phone.length <= 11 ? `55${phone}` : phone, `Olá, ${req.name.split(' ')[0]}! Seu horário está confirmado: ${longDate(req.date)} às ${req.start}. Até lá!`)}
                >
                  <MessageCircle className="size-4" aria-hidden /> Avisar o cliente
                </a>
              )}
              <Link to="/admin/agenda" className={btnGhost}>
                Ver agenda
              </Link>
            </>
          )}
        </div>
      </Section>
    </>
  )
}
