import { Link } from 'react-router'
import { ArrowDown } from 'lucide-react'
import { thumbOf, useSite, waLink } from '@/hooks/site'
import { STATIC } from '@/lib/mode'

export function Hero() {
  const { site } = useSite()
  const s = site?.settings
  const strip = (site?.works ?? []).filter((_, i) => i % 3 === 0).slice(0, 28)

  return (
    <section id="inicio" className="relative flex min-h-svh flex-col overflow-hidden bg-ink">
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pt-32 pb-10 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-28">
        <div>
          <p className="mb-6 text-[12px] tracking-[0.35em] text-white/60 uppercase">Tatuagem autoral · Black &amp; Grey</p>
          <h1 className="font-gothic text-[26vw] leading-[0.8] tracking-tight sm:text-[21vw] lg:text-[13rem]">Victor</h1>
          <p className="mt-3 font-display text-4xl tracking-[0.5em] text-white/90 sm:text-5xl">TATTOO</p>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-white/70">
            Realismo, lettering e fineline. Cada desenho nasce da sua ideia e é pensado para o seu corpo.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={waLink(s?.whatsapp ?? '')}
              target="_blank"
              rel="noreferrer"
              className="bg-white px-7 py-4 text-[13px] font-medium tracking-[0.22em] text-black uppercase transition-colors hover:bg-white/80"
            >
              Pedir orçamento
            </a>
            {!STATIC && (
              <Link
                to="/agendamento"
                className="border border-white/40 px-7 py-4 text-[13px] tracking-[0.22em] uppercase transition-colors hover:border-white hover:bg-white/10"
              >
                Já tenho meu token
              </Link>
            )}
            <a
              href="#estilos"
              aria-label="Ver trabalhos"
              className="grid size-[52px] place-items-center border border-white/40 transition-colors hover:border-white hover:bg-white/10"
            >
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="relative aspect-[3/4] overflow-hidden border border-white/20">
            {s?.heroImage && <img src={s.heroImage} alt="Tatuagem realista feita pelo Victor" className="size-full object-cover grayscale" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
          <p className="absolute -bottom-3 -left-6 bg-white px-4 py-2 font-display text-2xl tracking-wider text-black">Arte que fica</p>
        </div>
      </div>

      <div className="border-y border-white/15 py-3" aria-hidden>
        <div className="marquee-track flex w-max gap-3">
          {[...strip, ...strip].map((w, i) => (
            <img key={i} src={thumbOf(w.imageUrl)} alt="" loading="lazy" className="h-28 w-24 shrink-0 object-cover grayscale md:h-36 md:w-28" />
          ))}
        </div>
      </div>
    </section>
  )
}
