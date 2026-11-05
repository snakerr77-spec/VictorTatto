import type { ApiErrorBody } from '../../shared/types'
import { compressImage } from './image'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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

/** Reduz a foto no navegador e envia (painel). Devolve a URL pública (/uploads/...). */
export async function uploadImage(file: File): Promise<string> {
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
