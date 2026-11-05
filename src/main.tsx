import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/bebas-neue'
import '@fontsource/unifrakturcook/700.css'
import '@fontsource-variable/jost'
import './index.css'
import App from './App'
import { SiteProvider } from '@/hooks/site'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <App />
      </SiteProvider>
    </BrowserRouter>
  </StrictMode>,
)
