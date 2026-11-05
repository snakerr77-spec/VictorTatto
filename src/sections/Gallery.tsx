import * as React from 'react'
import type { PourPhoto } from '@/components/ui/tattoo-pour-menu'
import { useSite, usePhotos } from '@/hooks/site'

const STEP = 20

export function Gallery({ onOpen }: { onOpen: (photo: PourPhoto) => void }) {
  const { site } = useSite()
  const { all } = usePhotos(site)
  const [shown, setShown] = React.useState(STEP)
  return (
    <section id="galeria" className="bg-ink py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mb-10 flex items-end justify-between gap-6 md:mb-14">
          <h2 className="font-display text-6xl leading-[0.9] tracking-wide md:text-8xl">Todos os trabalhos</h2>
          <p className="hidden text-sm tracking-[0.25em] text-white/50 uppercase md:block">{all.length} fotos</p>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:gap-2 lg:grid-cols-4">
          {all.slice(0, shown).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p)}
                aria-label={`Ampliar: ${p.title}`}
                className="group relative block aspect-[3/4] w-full overflow-hidden bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <img
                  src={p.thumb}
                  alt={`${p.title} — ${p.area}`}
                  loading="lazy"
                  className="size-full object-cover grayscale transition duration-500 group-hover:scale-[1.04] group-hover:grayscale-0"
                />
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/80 px-3 py-2 text-left text-xs tracking-[0.18em] uppercase transition-transform group-hover:translate-y-0 group-focus-visible:translate-y-0">
                  {p.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {shown < all.length && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + STEP)}
              className="border border-white/50 px-9 py-4 text-[13px] tracking-[0.25em] uppercase transition-colors hover:bg-white hover:text-black"
            >
              Ver mais
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
