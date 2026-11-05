import * as React from 'react'
import type { SiteData } from '../../shared/types'
import { api, errorMessage } from '@/lib/api'
import type { PourCategory, PourPhoto } from '@/components/ui/tattoo-pour-menu'

interface SiteState {
  site: SiteData | null
  error: string | null
  reload: () => void
}

const SiteContext = React.createContext<SiteState>({ site: null, error: null, reload: () => {} })

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [site, setSite] = React.useState<SiteData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(() => {
    api
      .get<SiteData>('/site')
      .then((d) => {
        setSite(d)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  React.useEffect(reload, [reload])
  return <SiteContext.Provider value={{ site, error, reload }}>{children}</SiteContext.Provider>
}

export const useSite = () => React.useContext(SiteContext)

/** /works/12.jpg → /thumbs/12.jpg (as fotos enviadas pelo painel usam a própria imagem). */
export const thumbOf = (url: string): string => (url.startsWith('/works/') ? url.replace('/works/', '/thumbs/') : url)

export function usePhotos(site: SiteData | null) {
  return React.useMemo(() => {
    if (!site) return { all: [] as PourPhoto[], categories: [] as PourCategory[] }
    const toPhoto = (w: SiteData['works'][number]): PourPhoto => ({
      id: w.id,
      title: w.title,
      area: w.bodyArea,
      src: w.imageUrl,
      thumb: thumbOf(w.imageUrl),
    })
    const categories: PourCategory[] = site.categories
      .map((c) => {
        const list = site.works.filter((w) => w.categoryIds.includes(c.id))
        const sorted = [...list.filter((w) => w.featured), ...list.filter((w) => !w.featured)]
        return { id: c.id, name: c.name, description: c.description, photos: sorted.map(toPhoto) }
      })
      .filter((c) => c.photos.length)
    return { all: site.works.map(toPhoto), categories }
  }, [site])
}

export const waLink = (whatsapp: string, msg = 'Olá, Victor! Vim pelo site e quero fazer um orçamento.') =>
  `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`
