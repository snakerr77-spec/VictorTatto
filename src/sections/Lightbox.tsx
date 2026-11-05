import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PourPhoto } from '@/components/ui/tattoo-pour-menu'

interface LightboxProps {
  list: PourPhoto[]
  id: string | null
  onClose: () => void
  onChange: (id: string) => void
}

export function Lightbox({ list, id, onClose, onChange }: LightboxProps) {
  const i = list.findIndex((p) => p.id === id)
  const photo = list[i]
  const step = React.useCallback((d: number) => onChange(list[(i + d + list.length) % list.length].id), [i, list, onChange])

  React.useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [photo, onClose, step])

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={photo.title}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-5 py-4 text-sm tracking-[0.2em] uppercase">
            <span>
              {photo.title} <span className="text-white/50">· {photo.area}</span>
            </span>
            <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            <img
              src={photo.src}
              alt={`${photo.title} — ${photo.area}`}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                step(-1)
              }}
              aria-label="Anterior"
              className="absolute left-2 grid size-11 place-items-center bg-black/70 hover:bg-white hover:text-black md:left-6"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                step(1)
              }}
              aria-label="Próxima"
              className="absolute right-2 grid size-11 place-items-center bg-black/70 hover:bg-white hover:text-black md:right-6"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
