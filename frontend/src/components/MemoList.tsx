import { useEffect, useState } from 'react'
import { toUserErrorMessage } from '../api/client'
import { deleteMemo, listMemos } from '../api/memos'
import type { Memo } from '../types/memo'

type MemoListProps = {
  refreshKey: number
  onCreateClick: () => void
  onDetailClick: (memo: Memo) => void
}

function sortByUpdatedAtDesc(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) {
      return 0
    }
    return a.updatedAt < b.updatedAt ? 1 : -1
  })
}

/** ISO8601 → `YYYY-MM-DD   HH:mm`（ローカル時刻） */
function formatUpdatedAt(iso: string): string {
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

export function MemoList({
  refreshKey,
  onCreateClick,
  onDetailClick,
}: MemoListProps) {
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmMemo, setConfirmMemo] = useState<Memo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage(null)
      try {
        const items = await listMemos()
        if (!cancelled) {
          setMemos(sortByUpdatedAtDesc(items))
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        setErrorMessage(toUserErrorMessage(err))
        setMemos([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  function requestDelete(memo: Memo) {
    setDeleteError(null)
    setConfirmMemo(memo)
  }

  function cancelDelete() {
    if (deleting) {
      return
    }
    setConfirmMemo(null)
  }

  async function confirmDelete() {
    if (!confirmMemo || deleting) {
      return
    }
    const targetId = confirmMemo.memoId
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMemo(targetId)
      setMemos((current) => current.filter((memo) => memo.memoId !== targetId))
      setConfirmMemo(null)
    } catch (err) {
      setDeleteError(toUserErrorMessage(err))
      setConfirmMemo(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">メモ一覧</h2>
        <button
          type="button"
          onClick={onCreateClick}
          className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
        >
          新規作成
        </button>
      </div>

      {loading && (
        <p className="text-sm text-stone-600" role="status">
          読み込み中…
        </p>
      )}

      {!loading && errorMessage && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {!loading && deleteError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {deleteError}
        </div>
      )}

      {!loading && !errorMessage && memos.length === 0 && (
        <div
          role="status"
          className="rounded border border-dashed border-stone-300 bg-white px-4 py-8 text-center"
        >
          <p className="text-sm text-stone-700">メモはまだありません。</p>
          <button
            type="button"
            onClick={onCreateClick}
            className="mt-4 text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900"
          >
            最初のメモを作成する
          </button>
        </div>
      )}

      {!loading && !errorMessage && memos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {memos.map((memo) => (
            <li
              key={memo.memoId}
              className="border-b border-stone-200 bg-white px-4 py-4 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onDetailClick(memo)}
                className="w-full cursor-pointer rounded text-left transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <p className="font-medium text-stone-900">{memo.title}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-stone-600">
                  <dt className="text-stone-500">作成者</dt>
                  <dd>{memo.author}</dd>
                  <dt className="text-stone-500">更新日時</dt>
                  <dd className="font-mono text-xs">
                    {formatUpdatedAt(memo.updatedAt)}
                  </dd>
                </dl>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDetailClick(memo)}
                  className="rounded border border-stone-300 px-2.5 py-1 text-xs text-stone-700 transition hover:bg-stone-50"
                >
                  詳細
                </button>
                <button
                  type="button"
                  onClick={() => requestDelete(memo)}
                  disabled={deleting}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  削除
                </button>
              </div>
              {confirmMemo?.memoId === memo.memoId && (
                <div
                  role="dialog"
                  aria-labelledby={`list-delete-confirm-${memo.memoId}`}
                  className="mt-3 rounded border border-stone-300 bg-stone-50 px-4 py-4"
                >
                  <p
                    id={`list-delete-confirm-${memo.memoId}`}
                    className="text-sm text-stone-800"
                  >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
