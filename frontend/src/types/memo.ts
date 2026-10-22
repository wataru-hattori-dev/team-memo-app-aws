/** メモ本体（API レスポンス／画面表示用） */
export type Memo = {
  memoId: string
  title: string
  body: string
  author: string
  createdAt: string
  updatedAt: string
}

/** POST /memos リクエスト Body */
export type CreateMemoRequest = {
  title: string
  body: string
  author: string
}

/** PUT /memos/{memoId} リクエスト Body（全置換） */
export type UpdateMemoRequest = {
  title: string
  body: string
  author: string
}

/** API エラー応答 `{ "message": "..." }` */
export type ApiErrorBody = {
  message: string
}
