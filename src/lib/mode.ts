/** Build estático (GitHub Pages): sem servidor, então sem token, agenda e painel. */
export const STATIC = import.meta.env.VITE_STATIC === '1'

export const BASE: string = import.meta.env.BASE_URL

/** Prefixa caminhos absolutos (/works/1.jpg) com o base do site quando ele fica numa subpasta. */
export const withBase = (url: string): string => (url.startsWith('/') && BASE !== '/' ? BASE.replace(/\/$/, '') + url : url)
