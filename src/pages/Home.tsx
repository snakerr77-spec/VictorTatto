import * as React from 'react'
import { useSite, usePhotos } from '@/hooks/site'
import { Header } from '@/sections/Header'
import { Hero } from '@/sections/Hero'
import { Styles } from '@/sections/Styles'
import { Gallery } from '@/sections/Gallery'
import { About } from '@/sections/About'
import { Contact } from '@/sections/Contact'
import { Lightbox } from '@/sections/Lightbox'

export default function Home() {
  const { site, error } = useSite()
  const { all } = usePhotos(site)
  const [open, setOpen] = React.useState<string | null>(null)
  const close = React.useCallback(() => setOpen(null), [])

  if (error && !site) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div>
          <p className="font-gothic text-6xl">Victor</p>
          <p className="mt-4 text-white/70">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Styles onOpen={(p) => setOpen(p.id)} />
        <Gallery onOpen={(p) => setOpen(p.id)} />
        <About />
        <Contact />
      </main>
      <Lightbox list={all} id={open} onClose={close} onChange={setOpen} />
    </>
  )
}
