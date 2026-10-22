import { useState, type FormEvent } from 'react'
import { toUserErrorMessage } from '../api/client'
import { updateMemo } from '../api/memos'
import type { Memo } from '../types/memo'

type MemoEditFormProps = {
  memo: Memo
  onSuccess: (memo: Memo) => void
  onCancel: () => void
}

export function MemoEditForm({ memo, onSuccess, onCancel }: MemoEditFormProps) {
  const [title, setTitle] = useState(memo.title)
  const [body, setBody] = useState(memo.body)
  const [author, setAuthor] = useState(memo.author)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const updated = await updateMemo(memo.memoId, {
        title,
        body,
        author,
      })
      onSuccess(updated)
    } catch (err) {
      setErrorMessage(toUserErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 whitespace-pre-line rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">タイトル</span>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">本文</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            required
            rows={6}
            disabled={submitting}
            className="resize-y rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">作成者</span>
          <input
            type="text"
            name="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={100}
            required
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '更新中…' : '変更を保存'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            詳細へ戻る
          </button>
        </div>
      </form>
    </div>
  )
}
