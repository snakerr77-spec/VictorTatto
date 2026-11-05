import { TattooPourMenu, type PourPhoto } from '@/components/ui/tattoo-pour-menu'
import { useSite, usePhotos } from '@/hooks/site'

export function Styles({ onOpen }: { onOpen: (photo: PourPhoto) => void }) {
  const { site } = useSite()
  const { categories } = usePhotos(site)
  return (
    <section id="estilos" className="bg-paper py-20 text-black md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mb-10 flex flex-col justify-between gap-4 md:mb-16 md:flex-row md:items-end">
          <h2 className="font-display text-6xl leading-[0.9] tracking-wide md:text-8xl">
            Escolha
            <br />o estilo
          </h2>
          <p className="max-w-xs text-[15px] leading-relaxed text-black/60">
            Passe o mouse (ou toque) em um estilo e veja os trabalhos entrarem em cena. Clique na foto para ampliar.
          </p>
        </div>
        {categories.length > 0 && <TattooPourMenu categories={categories} onOpen={(p) => onOpen(p)} />}
      </div>
    </section>
  )
}
