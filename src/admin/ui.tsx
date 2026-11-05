import * as React from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const inputCls =
  'w-full border border-black/30 bg-white px-3.5 py-3 text-base text-black outline-none transition-colors placeholder:text-black/35 focus:border-black'
export const btnCls =
  'inline-flex items-center justify-center gap-2 bg-black px-5 py-3 text-[12px] font-medium tracking-[0.18em] text-white uppercase transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 border border-black px-4 py-2.5 text-[12px] tracking-[0.18em] uppercase transition-colors hover:bg-black hover:text-white disabled:opacity-40'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs tracking-[0.22em] uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/50">{hint}</span>}
    </label>
  )
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 md:mb-8">
      <h1 className="font-display text-5xl leading-none tracking-wide md:text-6xl">{title}</h1>
      {children}
    </div>
  )
}

export function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border border-black/15 bg-white p-4 sm:p-6', className)}>
      {title && <h2 className="mb-4 font-display text-2xl tracking-wide">{title}</h2>}
      {children}
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-black/25 px-4 py-6 text-center text-sm text-black/55">{children}</p>
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 border border-black transition-colors', checked ? 'bg-black' : 'bg-white')}
    >
      <span className={cn('absolute top-0.5 size-5 transition-all', checked ? 'left-[22px] bg-white' : 'left-0.5 bg-black')} />
    </button>
  )
}

// ---------- avisos rápidos (toast) ----------

interface ToastItem {
  id: number
  text: string
  error: boolean
}
const ToastCtx = React.createContext<(text: string, error?: boolean) => void>(() => {})
export const useToast = () => React.useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])
  const push = React.useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l, { id, text, error }])
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), error ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-28" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.error ? 'alert' : 'status'} className={cn('pointer-events-auto flex max-w-md items-start gap-3 border px-4 py-3 text-sm shadow-lg', t.error ? 'border-black bg-white text-black' : 'border-black bg-black text-white')}>
            {t.error ? <X className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Carrega dados do painel e refaz sob demanda. */
export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState('')
  const toast = useToast()
  const run = React.useCallback(async () => {
    try {
      setData(await load())
      setError('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar.'
      setError(msg)
      toast(msg, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  React.useEffect(() => {
    void run()
  }, [run])
  return { data, error, reload: run, setData }
}
