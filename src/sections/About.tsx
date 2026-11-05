import { useSite } from '@/hooks/site'

const pillars = [
  ['Realismo', 'Black & grey'],
  ['Lettering', 'Sob medida'],
  ['Fineline', 'Traço delicado'],
]

export function About() {
  const { site } = useSite()
  const s = site?.settings
  const paragraphs = (s?.about ?? '').split('\n\n').filter(Boolean)
  return (
    <section id="sobre" className="bg-paper py-20 text-black md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          {s?.ctaImage && (
            <img src={s.ctaImage} alt="Victor tatuando em sessão" loading="lazy" className="aspect-[4/5] w-full object-cover object-bottom grayscale" />
          )}
          <p className="absolute -bottom-4 right-4 bg-black px-4 py-2 font-gothic text-3xl text-white">Victor</p>
        </div>
        <div>
          <h2 className="font-display text-6xl leading-[0.9] tracking-wide md:text-8xl">
            Tatuagem é
            <br />
            para a vida toda
          </h2>
          <div className="mt-8 max-w-lg space-y-5 text-lg leading-relaxed text-black/70">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <ul className="mt-10 grid max-w-lg grid-cols-3 border-t border-black/20">
            {pillars.map(([a, b]) => (
              <li key={a} className="border-r border-black/20 py-5 pr-4 pl-4 first:pl-0 last:border-r-0">
                <p className="font-display text-2xl tracking-wide">{a}</p>
                <p className="text-xs tracking-[0.2em] text-black/55 uppercase">{b}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
