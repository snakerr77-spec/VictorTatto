import * as React from 'react'
import { Link } from 'react-router'
import { Megaphone, X } from 'lucide-react'
import { useSite } from '@/hooks/site'
import { BASE } from '@/lib/mode'

const links = [
  [`${BASE}#estilos`, 'Estilos'],
  [`${BASE}#galeria`, 'Trabalhos'],
  [`${BASE}#sobre`, 'Sobre'],
  [`${BASE}#contato`, 'Contato'],
] as const

/** Faixa de avisos fixa no topo; publica a própria altura em --notice-h para o menu descer. */
function Notices() {
  const { site } = useSite()
  const ref = React.useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = React.useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('hiddenNotices') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const list = (site?.notices ?? []).filter((n) => !hidden.includes(n.id))

  React.useLayoutEffect(() => {
    const root = document.documentElement
    const el = ref.current
    if (!el) {
      root.style.setProperty('--notice-h', '0px')
      return
    }
    const sync = () => root.style.setProperty('--notice-h', `${el.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--notice-h', '0px')
    }
  }, [list.length])

  if (!list.length) return null

  const dismiss = (id: string) => {
    const next = [...hidden, id]
    setHidden(next)
    try {
      sessionStorage.setItem('hiddenNotices', JSON.stringify(next))
    } catch {
      // sem sessionStorage: o aviso só some até recarregar
    }
  }

  return (
    <div ref={ref} role="region" aria-label="Avisos" className="fixed inset-x-0 top-0 z-50 bg-white text-black">
      {list.map((n) => (
        <div key={n.id} className="mx-auto flex max-w-7xl items-start gap-3 border-b border-black/10 px-5 py-2 text-[13px] leading-snug last:border-b-0 md:items-center md:px-8">
          <Megaphone className="mt-0.5 size-4 shrink-0 md:mt-0" aria-hidden />
          <p className="flex-1">{n.text}</p>
          <button type="button" onClick={() => dismiss(n.id)} aria-label="Dispensar aviso" className="-mr-1 grid size-7 shrink-0 place-items-center hover:bg-black/10">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Header() {
  return (
    <>
      <Notices />
      <header className="fixed inset-x-0 top-[var(--notice-h,0px)] z-40 text-white mix-blend-difference">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-8">
          <Link to="/" className="font-gothic text-3xl leading-none md:text-4xl" aria-label="Victor Tattoo — início">
            Victor
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-9 text-[13px] tracking-[0.22em] uppercase lg:flex">
            {links.map(([href, label]) => (
              <a key={href} href={href} className="transition-opacity hover:opacity-60">
                {label}
              </a>
            ))}
          </nav>
          <Link
            to="/agendamento"
            className="border border-white px-4 py-2 text-[12px] tracking-[0.22em] uppercase transition-colors hover:bg-white hover:text-black"
          >
            Tenho um token
          </Link>
        </div>
      </header>
    </>
  )
}
