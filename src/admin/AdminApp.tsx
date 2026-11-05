import * as React from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router'
import { CalendarDays, Image as ImageIcon, KeyRound, LayoutDashboard, Loader2, LogOut, Megaphone, Settings as SettingsIcon } from 'lucide-react'
import { api, ApiError, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import Dock from '@/components/ui/dock'
import { btnCls, Field, inputCls, ToastProvider } from './ui'
import Dashboard from './pages/Dashboard'
import Tokens from './pages/Tokens'
import Agenda from './pages/Agenda'
import WorksAdmin from './pages/WorksAdmin'
import Notices from './pages/Notices'
import Settings from './pages/Settings'

const nav = [
  ['/admin', 'Painel', LayoutDashboard, true],
  ['/admin/tokens', 'Tokens', KeyRound, false],
  ['/admin/agenda', 'Agenda', CalendarDays, false],
  ['/admin/trabalhos', 'Fotos', ImageIcon, false],
  ['/admin/avisos', 'Avisos', Megaphone, false],
  ['/admin/ajustes', 'Ajustes', SettingsIcon, false],
] as const

export default function AdminApp() {
  const [state, setState] = React.useState<'loading' | 'out' | 'in'>('loading')
  const { pathname } = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    api
      .get('/admin/me')
      .then(() => setState('in'))
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? 'out' : 'out'))
  }, [])

  if (state === 'loading') {
    return (
      <div className="grid min-h-svh place-items-center bg-paper text-black">
        <Loader2 className="size-6 animate-spin" aria-label="Carregando" />
      </div>
    )
  }
  if (state === 'out') return <Login onDone={() => setState('in')} />

  const logout = async () => {
    await api.post('/admin/logout').catch(() => {})
    setState('out')
  }

  return (
    <ToastProvider>
      <div className="min-h-svh bg-paper pb-28 text-black">
        <header className="sticky top-0 z-30 border-b border-black/15 bg-paper/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:h-16 md:px-8">
            <Link to="/admin" className="font-gothic text-3xl leading-none">
              Victor
            </Link>
            <Link to="/" className="ml-auto text-xs tracking-[0.2em] uppercase underline-offset-4 hover:underline">
              Ver site
            </Link>
            <button type="button" onClick={logout} aria-label="Sair" className="grid size-10 place-items-center hover:bg-black/10">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="tokens" element={<Tokens />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="trabalhos" element={<WorksAdmin />} />
            <Route path="avisos" element={<Notices />} />
            <Route path="ajustes" element={<Settings />} />
          </Routes>
        </main>

        <nav aria-label="Painel" className="fixed inset-x-0 bottom-2 z-30 sm:bottom-4">
          <Dock
            className="py-0"
            activeLabel={nav.find(([to, , , end]) => (end ? pathname === to : pathname.startsWith(to)))?.[1] ?? null}
            items={nav.map(([to, label, icon]) => ({ icon, label, onClick: () => navigate(to) }))}
          />
        </nav>
      </div>
    </ToastProvider>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/admin/login', { password })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-ink px-5 text-white">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="font-gothic text-7xl leading-none">Victor</p>
        <p className="mt-2 text-xs tracking-[0.35em] text-white/60 uppercase">Painel do tatuador</p>
        <div className="mt-10 space-y-4 text-black">
          <Field label="Senha">
            <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </Field>
          {error && (
            <p role="alert" className="border-l-2 border-white bg-white/10 px-4 py-3 text-sm text-white">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !password} className={cn(btnCls, 'w-full !bg-white !text-black hover:!bg-white/80')}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Entrar
          </button>
        </div>
        <Link to="/" className="mt-8 inline-block text-xs tracking-[0.2em] text-white/50 uppercase hover:text-white">
          ← Voltar ao site
        </Link>
      </form>
    </div>
  )
}
