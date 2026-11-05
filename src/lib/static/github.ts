// Camada de acesso ao GitHub: o "banco" do modo Pages é o arquivo state.json na branch `data` do repositório.
import { ApiError } from '../errors'

export const REPO: string = import.meta.env.VITE_GH_REPO ?? 'snakerr77-spec/VictorTatto'
export const DATA_BRANCH = 'data'
// VITE_GH_API / VITE_GH_RAW só existem para testar contra um GitHub falso; em produção valem os endereços reais.
const API = `${import.meta.env.VITE_GH_API ?? 'https://api.github.com'}/repos/${REPO}`
const RAW = import.meta.env.VITE_GH_RAW ?? 'https://raw.githubusercontent.com'
const KEY_STORAGE = 'vt_gh_key'

export const rawUrl = (path: string) => `${RAW}/${REPO}/${DATA_BRANCH}/${path}`

export const getKey = (): string => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}
export const setKey = (key: string) => {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    // sem localStorage: a sessão vale só até recarregar a página
  }
}

/** UTF-8 → base64 (btoa não aceita acentos direto). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function gh(path: string, init: RequestInit = {}, key = getKey()): Promise<Response> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o GitHub. Verifique sua internet e tente de novo.')
  }
  if (res.status === 401 || res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (res.status === 403 && remaining === '0') throw new ApiError(429, 'RATE', 'Limite de acessos ao GitHub atingido. Tente em alguns minutos.')
    throw new ApiError(401, 'UNAUTHORIZED', 'A chave do GitHub não é válida ou não tem permissão neste repositório.')
  }
  return res
}

/** Confere se a chave consegue gravar neste repositório. */
export async function checkKey(key: string): Promise<void> {
  const res = await gh('', {}, key)
  if (!res.ok) throw new ApiError(401, 'UNAUTHORIZED', 'Chave inválida ou sem acesso a este repositório.')
  const info = (await res.json()) as { permissions?: { push?: boolean } }
  if (!info.permissions?.push) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Essa chave não tem permissão de escrita (Contents: Read and write) neste repositório.')
  }
}

export interface RemoteFile {
  text: string
  sha: string
}

/** Lê um arquivo da branch de dados com a chave do admin (sem cache). null se não existir. */
export async function readFile(path: string): Promise<RemoteFile | null> {
  const res = await gh(`/contents/${path}?ref=${DATA_BRANCH}&t=${Date.now()}`)
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(res.status, 'GITHUB', 'Não consegui ler os dados no GitHub.')
  const j = (await res.json()) as { content: string; sha: string }
  return { text: fromBase64(j.content), sha: j.sha }
}

/** Cria a branch de dados (a partir da main) se ainda não existir. */
export async function ensureBranch(): Promise<void> {
  const has = await gh(`/git/ref/heads/${DATA_BRANCH}`)
  if (has.ok) return
  const main = await gh('/git/ref/heads/main')
  if (!main.ok) throw new ApiError(main.status, 'GITHUB', 'Não encontrei a branch main do repositório.')
  const sha = ((await main.json()) as { object: { sha: string } }).object.sha
  const made = await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha }) })
  if (!made.ok) throw new ApiError(made.status, 'GITHUB', 'Não consegui criar a branch de dados no GitHub.')
}

/** Grava (cria/atualiza) um arquivo na branch de dados. Devolve o novo sha. */
export async function writeFile(path: string, content: { text?: string; base64?: string }, sha: string | null, message: string): Promise<string> {
  const res = await gh(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      branch: DATA_BRANCH,
      content: content.base64 ?? toBase64(content.text ?? ''),
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.status === 409 || res.status === 422) {
    throw new ApiError(409, 'CONFLICT', 'Os dados mudaram em outro aparelho. Recarregue a página e tente de novo.')
  }
  if (!res.ok) throw new ApiError(res.status, 'GITHUB', 'Não consegui gravar no GitHub.')
  return ((await res.json()) as { content: { sha: string } }).content.sha
}

/** Leitura pública (visitantes): raw.githubusercontent, sem chave. null se a branch ainda não existe. */
export async function readPublic(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${rawUrl(path)}?t=${Math.floor(Date.now() / 60_000)}`)
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}
