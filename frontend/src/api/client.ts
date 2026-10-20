import type { ApiErrorBody } from '../types/memo'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/\/$/, '')
  }
  return DEFAULT_BASE_URL
}

/** API / 通信エラーをユーザー向けの短い日本語一文にする */
export function toUserErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = err.message.trim()
    if (msg && /[\u3040-\u30ff\u3400-\u9fff]/.test(msg)) {
      return msg.endsWith('。') ? msg : `${msg}。`
    }
    switch (err.status) {
      case 400:
        return '入力内容を確認してください。'
      case 404:
        return 'メモが見つかりません。'
      case 405:
        return 'この操作はできません。'
      case 500:
        return 'サーバーでエラーが発生しました。'
      default:
        return '処理に失敗しました。'
    }
  }
  if (err instanceof TypeError) {
    return 'APIに接続できません。'
  }
  return '予期しないエラーが発生しました。'
}

type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

/**
 * 共通 fetch。成功時は JSON をパースして返す。
 * 204 等ボディなしは null を返す。
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return null as T
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      throw new ApiError(response.status, 'サーバーの応答が不正です。')
    }
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof (parsed as ApiErrorBody).message === 'string'
        ? (parsed as ApiErrorBody).message
        : `処理に失敗しました。（${response.status}）`
    throw new ApiError(response.status, message)
  }

  return parsed as T
}
