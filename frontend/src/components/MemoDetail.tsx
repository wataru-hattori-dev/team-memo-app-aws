import { useState } from 'react'
import { toUserErrorMessage } from '../api/client'
import { deleteMemo } from '../api/memos'
import type { Memo } from '../types/memo'

type MemoDetailProps = {
  memo: Memo
  onEditClick: () => void
  onBackClick: () => void
  onDeleted: () => void
}

/** ISO8601 → `YYYY-MM-DD   HH:mm`（ローカル時刻） */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}   ${hh}:${mm}`
}

export function MemoDetail({
  memo,
  onEditClick,
  onBackClick,
  onDeleted,
}: MemoDetailProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function requestDelete() {
    setErrorMessage(null)
    setConfirming(true)
  }

  function cancelDelete() {
    if (deleting) {
      return
    }
    setConfirming(false)
  }

  async function confirmDelete() {
    if (deleting) {
      return
    }
    setDeleting(true)
    setErrorMessage(null)
    try {
      await deleteMemo(memo.memoId)
      onDeleted()
    } catch (err) {
      setErrorMessage(toUserErrorMessage(err))
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">メモ詳細</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditClick}
            disabled={deleting}
            className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            編集
          </button>
          <button
            type="button"
            onClick={requestDelete}
            disabled={deleting}
            className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            削除
          </button>
          <button
            type="button"
            onClick={onBackClick}
            disabled={deleting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            一覧へ戻る
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-delete-confirm-title"
          className="mb-4 rounded border border-stone-300 bg-white px-4 py-4"
        >
          <p id="detail-delete-confirm-title" className="text-sm text-stone-800">
            「{memo.title}」を削除しますか？
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="rounded bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? '削除中…' : '削除する'}
            </button>
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleting}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <article className="border-b border-stone-200 bg-white px-4 py-5">
        <h3 className="text-xl font-semibold text-stone-900">{memo.title}</h3>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-stone-600">
          <dt className="text-stone-500">作成者</dt>
          <dd>{memo.author}</dd>
          <dt className="text-stone-500">作成日時</dt>
          <dd className="font-mono text-xs">{formatDateTime(memo.createdAt)}</dd>
          <dt className="text-stone-500">更新日時</dt>
          <dd className="font-mono text-xs">{formatDateTime(memo.updatedAt)}</dd>
        </dl>

        <div className="mt-6 border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-500">本文</p>
          <p className="mt-2 whitespace-pre-wrap text-stone-800">{memo.body}</p>
        </div>
      </article>
    </div>
  )
}
