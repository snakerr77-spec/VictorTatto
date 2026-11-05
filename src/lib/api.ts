import type { ApiErrorBody } from '../../shared/types'
import { ApiError } from './errors'
import { compressImage } from './image'
import { STATIC } from './mode'

export { ApiError }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // GitHub Pages: não há servidor, então o "backend" roda no navegador e guarda os dados no GitHub.
  if (STATIC) {
    const { staticRequest } = await import('./static/backend')
    return (await staticRequest(method, path, body)) as T
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.')
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null
    throw new ApiError(res.status, data?.error ?? 'ERROR', data?.message ?? 'Algo deu errado. Tente novamente.')
  }
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
}

/** Reduz a foto no navegador e envia (painel). Devolve a URL pública da foto. */
export async function uploadImage(file: File): Promise<string> {
  if (STATIC) {
    const { uploadStatic } = await import('./static/backend')
    return uploadStatic(file)
  }
  const blob = await compressImage(file)
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null
    throw new ApiError(res.status, data?.error ?? 'ERROR', data?.message ?? 'Não consegui enviar a imagem.')
  }
  return ((await res.json()) as { url: string }).url
}

export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Algo deu errado.')
