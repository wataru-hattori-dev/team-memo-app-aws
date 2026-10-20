/** メモ本体（API レスポンス／画面表示用） */
export type Memo = {
  memoId: string
  title: string
  body: string
  author: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** POST /memos リクエスト Body */
export type CreateMemoRequest = {
  title: string
  body: string
  author: string
  tags?: string[]
}

/** PUT /memos/{memoId} リクエスト Body（全置換） */
export type UpdateMemoRequest = {
  title: string
  body: string
  author: string
  tags?: string[]
}

/** API エラー応答 `{ "message": "..." }` */
export type ApiErrorBody = {
  message: string
}
