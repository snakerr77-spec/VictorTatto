import { Link } from 'react-router'
import { MessageCircle, X } from 'lucide-react'
import type { Booking, Overview } from '../../../shared/types'
import { api, errorMessage } from '@/lib/api'
import { durationLabel, monthLabel, shortDate, waUrl } from '@/lib/dates'
import { Empty, PageTitle, Section, btnCls, useLoad, useToast } from '../ui'

function BookingRow({ b, onCancel }: { b: Booking; onCancel: (b: Booking) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/10 py-3 last:border-b-0">
      <div className="w-24 shrink-0">
        <p className="font-display text-2xl leading-none tracking-wide">{b.start}</p>
        <p className="text-xs text-black/50">{shortDate(b.date)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{b.clientName}</p>
        <p className="text-xs text-black/55">
          {durationLabel(b.durationMin)}
          {b.notes ? ` · ${b.notes}` : ''}
        </p>
      </div>
      {b.clientPhone && (
        <a
          href={waUrl(b.clientPhone.startsWith('55') ? b.clientPhone : `55${b.clientPhone}`, `Olá, ${b.clientName.split(' ')[0]}! Sobre o seu horário de ${shortDate(b.date)} às ${b.start}.`)}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp de ${b.clientName}`}
          className="grid size-10 place-items-center border border-black/40 hover:bg-black hover:text-white"
        >
          <MessageCircle className="size-4" aria-hidden />
        </a>
      )}
      <button type="button" onClick={() => onCancel(b)} aria-label={`Cancelar ${b.clientName}`} className="grid size-10 place-items-center border border-black/40 hover:bg-black hover:text-white">
        <X className="size-4" aria-hidden />
      </button>
    </li>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const { data, reload } = useLoad(() => api.get<Overview>('/admin/overview'))

  const cancel = async (b: Booking) => {
    if (!window.confirm(`Cancelar o horário de ${b.clientName} (${shortDate(b.date)} às ${b.start})?`)) return
    try {
      await api.post(`/admin/bookings/${b.id}/cancel`, { reopenToken: true })
      toast('Horário cancelado. O token voltou a ficar ativo para o cliente remarcar.')
      void reload()
    } catch (e) {
      toast(errorMessage(e), true)
    }
  }

  if (!data) return <PageTitle title="Painel" />
  const closedNow = data.closedMonths.includes(data.today.slice(0, 7))

  return (
    <>
      <PageTitle title="Painel">
        <Link to="/admin/tokens" className={btnCls}>
          Gerar token
        </Link>
      </PageTitle>

      {closedNow && (
        <div className="mb-6 border border-black bg-black p-4 text-sm text-white sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p>
            A agenda de <b className="capitalize">{monthLabel(data.today.slice(0, 7))}</b> está fechada: nenhum cliente consegue marcar horário.
          </p>
          <Link to="/admin/agenda" className="mt-3 inline-block underline underline-offset-4 sm:mt-0">
            Abrir dias →
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        {[
          ['Tokens ativos', data.counts.activeTokens],
          ['Próx. 7 dias', data.counts.week],
          ['Neste mês', data.counts.month],
        ].map(([label, n]) => (
          <div key={label} className="border border-black/15 bg-white p-4">
            <p className="font-display text-5xl leading-none">{n}</p>
            <p className="mt-2 text-[11px] tracking-[0.18em] text-black/55 uppercase">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Hoje">
          {data.todayBookings.length ? (
            <ul>
              {data.todayBookings.map((b) => (
                <BookingRow key={b.id} b={b} onCancel={cancel} />
              ))}
            </ul>
          ) : (
            <Empty>Nenhum cliente hoje.</Empty>
          )}
        </Section>
        <Section title="Próximos 14 dias">
          {data.upcoming.length ? (
            <ul>
              {data.upcoming.map((b) => (
                <BookingRow key={b.id} b={b} onCancel={cancel} />
              ))}
            </ul>
          ) : (
            <Empty>Nada marcado nos próximos dias.</Empty>
          )}
        </Section>
      </div>
    </>
  )
}
