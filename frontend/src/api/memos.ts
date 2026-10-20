import { apiRequest } from './client'
import type { CreateMemoRequest, Memo, UpdateMemoRequest } from '../types/memo'

/** POST /memos — メモ新規作成 */
export function createMemo(payload: CreateMemoRequest): Promise<Memo> {
  return apiRequest<Memo>('/memos', {
    method: 'POST',
    body: payload,
  })
}

/** GET /memos — メモ一覧取得 */
export function listMemos(): Promise<Memo[]> {
  return apiRequest<Memo[]>('/memos', {
    method: 'GET',
  })
}

/** PUT /memos/{memoId} — メモ全置換更新 */
export function updateMemo(
  memoId: string,
  payload: UpdateMemoRequest,
): Promise<Memo> {
  return apiRequest<Memo>(`/memos/${encodeURIComponent(memoId)}`, {
    method: 'PUT',
    body: payload,
  })
}
