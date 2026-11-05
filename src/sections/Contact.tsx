import { Link } from 'react-router'
import { AtSign, MessageCircle } from 'lucide-react'
import { useSite, waLink } from '@/hooks/site'
const steps = [
  ['01', 'Orçamento', 'Chame no WhatsApp, conte a ideia, o local do corpo e mande referências. Eu passo valor e tempo de sessão.'],
  ['02', 'Token', 'Aprovado o orçamento, eu envio um código pessoal que libera a agenda para você.'],
  ['03', 'Agende', 'Digite o token aqui no site e escolha o dia e o horário que preferir.'],
]

export function Contact() {
  const { site } = useSite()
  const s = site?.settings
  const handle = (s?.instagram ?? '').replace(/^@/, '')
  return (
    <section id="contato" className="bg-ink py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="font-display text-[22vw] leading-[0.85] tracking-wide sm:text-[16vw] lg:text-[11rem]">
          Vamos
          <br />
          desenhar
        </h2>
        <ol className="mt-14 grid gap-px border border-white/15 bg-white/15 md:mt-20 md:grid-cols-3">
          {steps.map(([n, t, d]) => (
            <li key={n} className="bg-ink p-7 md:p-9">
              <p className="font-display text-5xl text-white/30">{n}</p>
              <p className="mt-4 font-display text-3xl tracking-wide">{t}</p>
              <p className="mt-2 text-white/60">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap gap-3">
          <a
            href={waLink(s?.whatsapp ?? '')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 bg-white px-8 py-4 text-[13px] font-medium tracking-[0.22em] text-black uppercase transition-colors hover:bg-white/80"
          >
            <MessageCircle className="size-4" aria-hidden /> Pedir orçamento
          </a>
          <Link
            to="/agendamento"
            className="inline-flex items-center gap-3 border border-white/40 px-8 py-4 text-[13px] tracking-[0.22em] uppercase transition-colors hover:border-white hover:bg-white/10"
          >
            Usar meu token
          </Link>
          {handle && (
            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 border border-white/40 px-8 py-4 text-[13px] tracking-[0.22em] uppercase transition-colors hover:border-white hover:bg-white/10"
            >
              <AtSign className="size-4" aria-hidden /> {handle}
            </a>
          )}
        </div>
      </div>
      <p className="mx-auto mt-20 flex max-w-7xl items-center justify-between border-t border-white/15 px-5 pt-6 text-xs tracking-[0.2em] text-white/40 uppercase md:px-8">
        <span>© {new Date().getFullYear()} Victor Tattoo</span>
        <Link to="/admin" className="hover:text-white">
          Área do tatuador
        </Link>
      </p>
    </section>
  )
}
