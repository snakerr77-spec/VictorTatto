import * as React from 'react'
import { Route, Routes, useLocation } from 'react-router'
import Home from '@/pages/Home'
import Booking from '@/pages/Booking'

const AdminApp = React.lazy(() => import('@/admin/AdminApp'))

/** Volta ao topo ao trocar de página (e rola até a âncora quando há #hash). */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  React.useEffect(() => {
    if (hash) {
      // espera o conteúdo da página montar
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 80)
      return () => clearTimeout(t)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agendamento" element={<Booking />} />
        <Route
          path="/admin/*"
          element={
            <React.Suspense fallback={<div className="min-h-svh bg-ink" />}>
              <AdminApp />
            </React.Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
